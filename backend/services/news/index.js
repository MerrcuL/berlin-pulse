const express = require('express');
const cors = require('cors');
const RSSParser = require('rss-parser');

const app = express();
app.set('strict routing', false);
const PORT = process.env.PORT || 4003;

const RSS_URL = 'https://www.berliner-zeitung.de/feed.xml';
const FETCH_TIMEOUT_MS = 15000; // 15 seconds — RSS feeds can be slow

// rss-parser with request timeout so it can't hang indefinitely
const parser = new RSSParser({
  timeout: FETCH_TIMEOUT_MS,
  customFields: {
    item: [
      ['media:thumbnail', 'mediaThumbnail', { keepArray: false }],
      ['media:content', 'mediaContent', { keepArray: false }]
    ]
  }
});

// Cache + fetch semaphore
let cache = { data: null, timestamp: 0 };
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let fetching = false;

app.use(cors());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'news' });
});

async function fetchNews() {
  if (fetching) return;
  fetching = true;
  const now = Date.now();
  try {
    const feed = await parser.parseURL(RSS_URL);

    const articles = feed.items.map((item, index) => {
      let thumbnail = null;
      if (item.mediaThumbnail && item.mediaThumbnail.$) {
        thumbnail = item.mediaThumbnail.$.url;
      } else if (item.mediaContent && item.mediaContent.$) {
        thumbnail = item.mediaContent.$.url;
      } else if (item.enclosure && item.enclosure.url) {
        thumbnail = item.enclosure.url;
      }

      let description = item.contentSnippet || item.content || item.description || '';
      description = description.replace(/<[^>]*>/g, '').trim();

      return {
        id: item.guid || `article-${index}`,
        title: item.title || '',
        description,
        link: item.link || '',
        pubDate: item.pubDate || item.isoDate || '',
        thumbnail,
        categories: item.categories || []
      };
    });

    cache = { data: articles, timestamp: now };
    console.log('[News] Cache refreshed.');
  } catch (error) {
    console.error('[News] Fetch error:', error.message);
    throw error;
  } finally {
    fetching = false; // always release semaphore, even on timeout/error
  }
}

// GET /news – all articles
app.get(['/', '/news'], async (req, res) => {
  if (cache.data && (Date.now() - cache.timestamp) < CACHE_TTL) {
    return serveFromCache(req, res, cache.data, false);
  }
  if (cache.data) {
    if (!fetching) fetchNews().catch(e => console.error('[News] BG refresh error:', e.message));
    return serveFromCache(req, res, cache.data, true);
  }
  if (!fetching) fetchNews().catch(e => console.error('[News] Initial fetch error:', e.message));
  return res.status(202).json({ success: false, loading: true, message: 'News data is loading, please retry in a moment.' });
});

function serveFromCache(req, res, articles, stale) {
  const { limit, search } = req.query;
  let result = articles;

  if (search) {
    const q = search.toLowerCase();
    result = result.filter(a =>
      a.title.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q)
    );
  }

  if (limit) result = result.slice(0, parseInt(limit));

  res.setHeader('Cache-Control', stale ? `public, max-age=0, stale-while-revalidate=60` : `public, max-age=60, stale-while-revalidate=60`);
  res.json({
    success: true,
    count: result.length,
    articles: result,
    lastUpdated: cache.timestamp ? new Date(cache.timestamp).toISOString() : null
  });
}

app.listen(PORT, () => {
  console.log(`[News Service] Running on port ${PORT}`);
  fetchNews().catch(err => console.error('Initial news fetch failed:', err.message));
  setInterval(() => {
    fetchNews().catch(err => console.error('Background news fetch failed:', err.message));
  }, CACHE_TTL);
});
