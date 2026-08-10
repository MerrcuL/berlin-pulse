const express = require('express');
const cors = require('cors');

const app = express();
app.set('strict routing', false);
const PORT = process.env.PORT || 4001;

const KULTURDATEN_API = 'https://api-v2.kulturdaten.berlin/api';
const FETCH_TIMEOUT_MS = 15000; // 15 seconds per upstream request

// TTL-aware cache for attraction details (1 hour, max 500 entries)
const ATTRACTION_CACHE_TTL = 60 * 60 * 1000;
const ATTRACTION_CACHE_MAX = 500;
const attractionsCache = new Map();

function cacheGet(key) {
  const entry = attractionsCache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) { attractionsCache.delete(key); return undefined; }
  return entry.value;
}

function cacheSet(key, value) {
  if (attractionsCache.size >= ATTRACTION_CACHE_MAX) {
    attractionsCache.delete(attractionsCache.keys().next().value);
  }
  attractionsCache.set(key, { value, expiresAt: Date.now() + ATTRACTION_CACHE_TTL });
}

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'events' });
});

// Events List Cache + per-key semaphores
const eventsCache = new Map();
const eventsFetching = new Map();
const EVENTS_CACHE_TTL = 15 * 60 * 1000; // 15 minutes

// Helper: fetch with abort timeout
function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timeoutId));
}

async function fetchEventsList(page = 1, pageSize = 20) {
  const cacheKey = `${page}-${pageSize}`;
  if (eventsFetching.get(cacheKey)) return;
  eventsFetching.set(cacheKey, true);
  try {
    const url = `${KULTURDATEN_API}/events?page=${page}&pageSize=${pageSize}`;
    const response = await fetchWithTimeout(url, { headers: { 'Accept': 'application/json' } });
    if (!response.ok) throw new Error(`Kulturdaten API returned ${response.status}`);
    const data = await response.json();
    eventsCache.set(cacheKey, { data, timestamp: Date.now() });
    console.log(`[Events] Cache refreshed for page=${page} pageSize=${pageSize}`);
    return data;
  } finally {
    eventsFetching.set(cacheKey, false); // always release
  }
}

// GET /events – list events with pagination
app.get(['/', '/events'], (req, res) => {
  const { page = 1, pageSize = 20 } = req.query;
  const cacheKey = `${page}-${pageSize}`;
  const cached = eventsCache.get(cacheKey);
  const now = Date.now();

  if (cached && (now - cached.timestamp) < EVENTS_CACHE_TTL) {
    res.setHeader('Cache-Control', `public, max-age=60, stale-while-revalidate=120`);
    return res.json(cached.data);
  }
  if (cached) {
    if (!eventsFetching.get(cacheKey)) fetchEventsList(page, pageSize).catch(e => console.error('[Events] BG refresh error:', e.message));
    res.setHeader('Cache-Control', `public, max-age=0, stale-while-revalidate=120`);
    return res.json(cached.data);
  }
  if (!eventsFetching.get(cacheKey)) fetchEventsList(page, pageSize).catch(e => console.error('[Events] Initial fetch error:', e.message));
  return res.status(202).json({ success: false, loading: true, message: 'Events data is loading, please retry in a moment.' });
});

// POST /events/search
app.post('/events/search', async (req, res) => {
  try {
    const { page = 1, pageSize = 20 } = req.query;
    const url = `${KULTURDATEN_API}/events/search?page=${page}&pageSize=${pageSize}`;
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    if (!response.ok) throw new Error(`Kulturdaten API returned ${response.status}`);
    res.json(await response.json());
  } catch (error) {
    console.error('[Events] POST /events/search error:', error.message);
    res.status(502).json({ success: false, message: 'Failed to search events', error: error.message });
  }
});

// GET /events/:id
app.get('/events/:id', async (req, res) => {
  try {
    const response = await fetchWithTimeout(`${KULTURDATEN_API}/events/${req.params.id}`, {
      headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) throw new Error(`Kulturdaten API returned ${response.status}`);
    const data = await response.json();
    const event = data?.data?.event;
    if (event) {
      const attractionId = event.attractions?.[0]?.referenceId;
      if (attractionId) {
        let attraction = cacheGet(attractionId);
        if (!attraction) {
          const attRes = await fetchWithTimeout(`${KULTURDATEN_API}/attractions/${attractionId}`, {
            headers: { 'Accept': 'application/json' }
          });
          if (attRes.ok) {
            const attData = await attRes.json();
            attraction = attData?.data?.attraction;
            if (attraction) cacheSet(attractionId, attraction);
          }
        }
        if (attraction) {
          if (attraction.title) event.title = attraction.title;
          if (attraction.description) event.description = attraction.description;
          if (attraction.website || attraction.url) event.website = attraction.website || attraction.url;
          if (attraction.tags) event.tags = attraction.tags;
        }
      }
    }
    res.json(data);
  } catch (error) {
    console.error('[Events] GET /events/:id error:', error.message);
    res.status(502).json({ success: false, message: 'Failed to fetch event', error: error.message });
  }
});

// GET /attractions/:id
app.get('/attractions/:id', async (req, res) => {
  try {
    const attractionId = req.params.id;
    const cached = cacheGet(attractionId);
    if (cached) return res.json({ success: true, data: { attraction: cached } });
    const response = await fetchWithTimeout(`${KULTURDATEN_API}/attractions/${attractionId}`, {
      headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) throw new Error(`Kulturdaten API returned ${response.status}`);
    const data = await response.json();
    const attraction = data?.data?.attraction;
    if (attraction) cacheSet(attractionId, attraction);
    res.json(data);
  } catch (error) {
    console.error('[Events] GET /attractions/:id error:', error.message);
    res.status(502).json({ success: false, message: 'Failed to fetch attraction', error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`[Events Service] Running on port ${PORT}`);
  fetchEventsList(1, 6).catch(e => console.error('Events pre-warm failed for pageSize=6:', e.message));
  fetchEventsList(1, 20).catch(e => console.error('Events pre-warm failed for pageSize=20:', e.message));
  setInterval(() => {
    fetchEventsList(1, 6).catch(e => console.error('Events bg fetch failed:', e.message));
    fetchEventsList(1, 20).catch(e => console.error('Events bg fetch failed:', e.message));
  }, EVENTS_CACHE_TTL);
});
