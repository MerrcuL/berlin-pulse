const express = require('express');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 4000;

const EVENTS_URL = process.env.EVENTS_SERVICE_URL || 'http://127.0.0.1:4001';
const TRANSPORT_URL = process.env.TRANSPORT_SERVICE_URL || 'http://127.0.0.1:4002';
const NEWS_URL = process.env.NEWS_SERVICE_URL || 'http://127.0.0.1:4003';
const WEATHER_URL = process.env.WEATHER_SERVICE_URL || 'http://127.0.0.1:4005';

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(cors());
app.use(compression());

// Request logging (dev-friendly short format)
app.use(morgan('[:date[clf]] :method :url :status :response-time ms'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'gateway', timestamp: new Date().toISOString() });
});

// Proxy to Events Service (/api/events -> EVENTS_URL/events)
app.use('/api/events', createProxyMiddleware({
  target: EVENTS_URL,
  changeOrigin: true,
  autoRewrite: true,
  pathRewrite: { '^/api/events': '/events' },
  proxyTimeout: 30000,
  timeout: 30000,
  on: {
    error: (err, req, res) => {
      console.error('[Gateway] Events proxy error:', err.message);
      if (!res.headersSent) res.status(502).json({ success: false, message: 'Events service unavailable' });
    }
  }
}));

// Proxy to Transport Service (/api/transport/disruptions -> TRANSPORT_URL/disruptions)
app.use('/api/transport', createProxyMiddleware({
  target: TRANSPORT_URL,
  changeOrigin: true,
  autoRewrite: true,
  pathRewrite: { '^/api/transport': '' },
  proxyTimeout: 30000,
  timeout: 30000,
  on: {
    error: (err, req, res) => {
      console.error('[Gateway] Transport proxy error:', err.message);
      if (!res.headersSent) res.status(502).json({ success: false, message: 'Transport service unavailable' });
    }
  }
}));

// Proxy to News Service (/api/news -> NEWS_URL/news)
app.use('/api/news', createProxyMiddleware({
  target: NEWS_URL,
  changeOrigin: true,
  autoRewrite: true,
  pathRewrite: { '^/api/news': '/news' },
  proxyTimeout: 30000,
  timeout: 30000,
  on: {
    error: (err, req, res) => {
      console.error('[Gateway] News proxy error:', err.message);
      if (!res.headersSent) res.status(502).json({ success: false, message: 'News service unavailable' });
    }
  }
}));

// Proxy to Weather Service (/api/weather -> WEATHER_URL/weather)
app.use('/api/weather', createProxyMiddleware({
  target: WEATHER_URL,
  changeOrigin: true,
  autoRewrite: true,
  pathRewrite: { '^/api/weather': '/weather' },
  proxyTimeout: 30000,
  timeout: 30000,
  on: {
    error: (err, req, res) => {
      console.error('[Gateway] Weather proxy error:', err.message);
      if (!res.headersSent) res.status(502).json({ success: false, message: 'Weather service unavailable' });
    }
  }
}));

// Global fallback error handler – ensures JSON is returned, never raw HTML
app.use((err, req, res, next) => {
  console.error('[Gateway] Unhandled error:', err.message);
  res.status(500).json({ success: false, message: 'Internal gateway error' });
});

app.listen(PORT, () => {
  console.log(`[Gateway] Running on port ${PORT}`);
});
