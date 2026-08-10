const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4002;

const BVG_API = 'https://www.bvg.de/disruption-reports-service/disruptions/v1/de';
const FETCH_TIMEOUT_MS = 15000; // 15 seconds per BVG page request

// Cache + fetch semaphore
let cache = { data: null, timestamp: 0 };
const CACHE_TTL = 3 * 60 * 1000; // 3 minutes
let fetching = false;

app.use(cors());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'transport' });
});

// Fetch a single page from BVG API with timeout
async function fetchBvgPage(page = 1) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
      'Referer': 'https://www.bvg.de/de/verbindungen/stoerungsmeldungen'
    };
    const res = await fetch(`${BVG_API}?page=${page}`, { headers, signal: controller.signal });
    if (!res.ok) throw new Error(`BVG API returned HTTP ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

// Fetch ALL pages (1..numPages) from BVG API in parallel
async function fetchAllBvgData() {
  const page1 = await fetchBvgPage(1);
  if (!page1 || !page1.elements) return { elements: [] };

  const numPages = page1.numPages || 1;
  if (numPages <= 1) return page1;

  const pagePromises = [];
  for (let p = 2; p <= numPages; p++) {
    pagePromises.push(fetchBvgPage(p).catch(() => null));
  }

  const additionalPages = await Promise.all(pagePromises);
  const allElements = [...page1.elements];
  for (const pData of additionalPages) {
    if (pData && Array.isArray(pData.elements)) allElements.push(...pData.elements);
  }
  return { numPages, elements: allElements };
}

// Fetch disruptions with cache + semaphore
async function fetchDisruptions() {
  if (fetching) return;
  fetching = true;
  const now = Date.now();
  try {
    const raw = await fetchAllBvgData();
    cache = { data: raw, timestamp: now };
    console.log('[Transport] Cache refreshed.');
  } catch (error) {
    console.error('[Transport] Fetch error:', error.message);
    throw error;
  } finally {
    fetching = false; // always release semaphore
  }
}

// HTML entity lookup table for German + common entities
const HTML_ENTITIES = {
  '&auml;': 'ä', '&Auml;': 'Ä',
  '&ouml;': 'ö', '&Ouml;': 'Ö',
  '&uuml;': 'ü', '&Uuml;': 'Ü',
  '&szlig;': 'ß',
  '&amp;': '&', '&quot;': '"', '&#39;': "'",
  '&lt;': '<', '&gt;': '>', '&nbsp;': ' '
};
const ENTITY_REGEX = new RegExp(Object.keys(HTML_ENTITIES).join('|'), 'g');

function decodeHtml(html) {
  if (!html) return '';
  let text = html;
  text = text.replace(/<bds-signet-line[\s\S]*?line-id=['"]([^'"]+)['"][\s\S]*?><\/bds-signet-line>/gi, (match, lineId) => {
    let type = 'other';
    if (lineId.startsWith('U')) type = 'ubahn';
    else if (lineId.startsWith('S')) type = 'sbahn';
    else if (lineId.startsWith('M') || lineId.match(/^\d{1,3}$/)) type = 'tram';
    else if (lineId.startsWith('F')) type = 'ferry';
    if (type === 'tram' && (lineId.match(/^\d{3}$/) || lineId.startsWith('X') || lineId.startsWith('N'))) type = 'bus';
    return `<span class="badge badge-${type} badge-${lineId.toLowerCase()}">${lineId}</span>`;
  });
  text = text.replace(/<bds-[a-z0-9-]+[\s\S]*?><\/bds-[a-z0-9-]+>/gi, '');
  text = text.replace(/<bds-[a-z0-9-]+[\s\S]*?>/gi, '');
  text = text.replace(/<\/bds-[a-z0-9-]+>/gi, '');
  return text.trim();
}

function parseLinesAndType(item) {
  const lineNames = [];
  let transportType = 'other';
  if (item.lines && Array.isArray(item.lines)) {
    for (const lineObj of item.lines) {
      if (typeof lineObj === 'string') { lineNames.push(lineObj); continue; }
      if (lineObj.subway) { transportType = 'ubahn'; lineObj.subway.forEach(l => l.name && lineNames.push(l.name)); }
      if (lineObj.sbahn) { if (transportType === 'other') transportType = 'sbahn'; lineObj.sbahn.forEach(l => l.name && lineNames.push(l.name)); }
      if (lineObj.tram) { if (transportType === 'other') transportType = 'tram'; lineObj.tram.forEach(l => l.name && lineNames.push(l.name)); }
      if (lineObj.bus) { if (transportType === 'other') transportType = 'bus'; lineObj.bus.forEach(l => l.name && lineNames.push(l.name)); }
      if (lineObj.ferry) { if (transportType === 'other') transportType = 'ferry'; lineObj.ferry.forEach(l => l.name && lineNames.push(l.name)); }
      if (lineObj.regional) { lineObj.regional.forEach(l => l.name && lineNames.push(l.name)); }
    }
  }
  if (transportType === 'other') {
    const text = (item.content?.[0]?.headline || item.content?.[0]?.content || '').toLowerCase();
    if (text.match(/u-bahn|ubahn|\bu\d\b/)) transportType = 'ubahn';
    else if (text.match(/s-bahn|sbahn|\bs\d\b/)) transportType = 'sbahn';
    else if (text.match(/tram|straßenbahn|\bm\d\b/)) transportType = 'tram';
    else if (text.match(/bus|\b\d{3}\b/)) transportType = 'bus';
    else if (text.match(/fähr|ferry|\bf\d\b/)) transportType = 'ferry';
  }
  return { lines: [...new Set(lineNames)], transportType };
}

function normalizeDisruptions(raw) {
  if (!raw) return [];
  const elements = raw.elements || (Array.isArray(raw) ? raw : []);
  return elements.map((item, idx) => {
    const { lines, transportType } = parseLinesAndType(item);
    const contentObj = item.content?.[0] || {};
    let title = contentObj.headline || '';
    if (!title && item.stationOne) {
      title = `Störung: ${item.stationOne.displayName}`;
      if (item.stationTwo) title += ` - ${item.stationTwo.displayName}`;
    }
    if (!title && item.disruptionTypes?.[0]?.displayName) title = item.disruptionTypes[0].displayName;
    if (!title) title = 'Verkehrsmeldung';
    return {
      id: item.id || `disruption-${idx}`,
      messageType: item.messageType || 'TRAFFIC',
      disruptionType: item.disruptionTypes?.[0]?.displayName || 'Störung',
      lines, transportType, title,
      description: decodeHtml(contentObj.content || item.description || ''),
      validFrom: item.startDate || null,
      validTo: item.endDate || null,
      lastModified: item.modDate || null,
      isPlanned: item.scheduled || item.messageType === 'BAUARBEITEN' || false
    };
  }).filter(d => d.title || d.description);
}

// GET /disruptions
app.get(['/', '/disruptions', '/transport/disruptions'], (req, res) => {
  if (cache.data && (Date.now() - cache.timestamp) < CACHE_TTL) return serveDisruptions(req, res, false);
  if (cache.data) {
    if (!fetching) fetchDisruptions().catch(e => console.error('[Transport] BG refresh error:', e.message));
    return serveDisruptions(req, res, true);
  }
  if (!fetching) fetchDisruptions().catch(e => console.error('[Transport] Initial fetch error:', e.message));
  return res.status(202).json({ success: false, loading: true, message: 'Transport data is loading, please retry in a moment.' });
});

function serveDisruptions(req, res, stale) {
  const disruptions = normalizeDisruptions(cache.data);
  const { type, line } = req.query;
  let filtered = disruptions;
  if (type && type !== 'all') filtered = filtered.filter(d => d.transportType === type);
  if (line) {
    const lineLower = line.toLowerCase();
    filtered = filtered.filter(d => d.lines.some(l => l.toLowerCase().includes(lineLower)));
  }
  res.setHeader('Cache-Control', stale ? `public, max-age=0, stale-while-revalidate=60` : `public, max-age=60, stale-while-revalidate=60`);
  res.json({ success: true, count: filtered.length, disruptions: filtered, lastUpdated: cache.timestamp ? new Date(cache.timestamp).toISOString() : null });
}

// GET /summary
app.get(['/summary', '/disruptions/summary', '/transport/disruptions/summary'], (req, res) => {
  if (cache.data && (Date.now() - cache.timestamp) < CACHE_TTL) return serveSummary(req, res);
  if (cache.data) {
    if (!fetching) fetchDisruptions().catch(e => console.error('[Transport] BG refresh error:', e.message));
    return serveSummary(req, res);
  }
  if (!fetching) fetchDisruptions().catch(e => console.error('[Transport] Initial fetch error:', e.message));
  return res.status(202).json({ success: false, loading: true, message: 'Transport data is loading, please retry in a moment.' });
});

function serveSummary(req, res) {
  const disruptions = normalizeDisruptions(cache.data);
  const byType = { ubahn: 0, sbahn: 0, tram: 0, bus: 0, ferry: 0, other: 0 };
  for (const d of disruptions) {
    if (byType[d.transportType] !== undefined) byType[d.transportType]++;
    else byType.other++;
  }
  res.json({ success: true, total: disruptions.length, byType, lastUpdated: cache.timestamp ? new Date(cache.timestamp).toISOString() : null });
}

app.listen(PORT, () => {
  console.log(`[Transport Service] Running on port ${PORT}`);
  fetchDisruptions().catch(err => console.error('Initial transport fetch failed:', err.message));
  setInterval(() => {
    fetchDisruptions().catch(err => console.error('Background transport fetch failed:', err.message));
  }, CACHE_TTL);
});
