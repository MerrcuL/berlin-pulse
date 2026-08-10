const express = require('express');
const cors = require('cors');

const app = express();
app.set('strict routing', false);
const PORT = process.env.PORT || 4005;

// Berlin coordinates
const BERLIN_LAT = 52.52;
const BERLIN_LON = 13.405;
const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
const FETCH_TIMEOUT_MS = 12000; // 12 seconds — if Open-Meteo hangs, give up and retry next cycle

// Cache + fetch semaphore
let cache = { data: null, timestamp: 0 };
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
let fetching = false;

app.use(cors());

// WMO Weather Codes to descriptions
const WMO_CODES = {
  0: { description: 'Clear sky', icon: '☀️' },
  1: { description: 'Mainly clear', icon: '🌤️' },
  2: { description: 'Partly cloudy', icon: '⛅' },
  3: { description: 'Overcast', icon: '☁️' },
  45: { description: 'Foggy', icon: '🌫️' },
  48: { description: 'Depositing rime fog', icon: '🌫️' },
  51: { description: 'Light drizzle', icon: '🌦️' },
  53: { description: 'Moderate drizzle', icon: '🌦️' },
  55: { description: 'Dense drizzle', icon: '🌧️' },
  56: { description: 'Light freezing drizzle', icon: '🌨️' },
  57: { description: 'Dense freezing drizzle', icon: '🌨️' },
  61: { description: 'Slight rain', icon: '🌧️' },
  63: { description: 'Moderate rain', icon: '🌧️' },
  65: { description: 'Heavy rain', icon: '🌧️' },
  66: { description: 'Light freezing rain', icon: '🌨️' },
  67: { description: 'Heavy freezing rain', icon: '🌨️' },
  71: { description: 'Slight snow', icon: '🌨️' },
  73: { description: 'Moderate snow', icon: '❄️' },
  75: { description: 'Heavy snow', icon: '❄️' },
  77: { description: 'Snow grains', icon: '❄️' },
  80: { description: 'Slight rain showers', icon: '🌦️' },
  81: { description: 'Moderate rain showers', icon: '🌧️' },
  82: { description: 'Violent rain showers', icon: '⛈️' },
  85: { description: 'Slight snow showers', icon: '🌨️' },
  86: { description: 'Heavy snow showers', icon: '❄️' },
  95: { description: 'Thunderstorm', icon: '⛈️' },
  96: { description: 'Thunderstorm with hail', icon: '⛈️' },
  99: { description: 'Thunderstorm with heavy hail', icon: '⛈️' }
};

function getWeatherInfo(code) {
  return WMO_CODES[code] || { description: 'Unknown', icon: '❓' };
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'weather',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// GET /weather – current weather + forecast for Berlin
app.get(['/', '/weather'], (req, res) => {
  if (cache.data && (Date.now() - cache.timestamp) < CACHE_TTL) {
    res.setHeader('Cache-Control', `public, max-age=60, stale-while-revalidate=120`);
    return res.json(cache.data);
  }
  if (cache.data) {
    if (!fetching) fetchWeather().catch(e => console.error('[Weather] BG refresh error:', e.message));
    res.setHeader('Cache-Control', `public, max-age=0, stale-while-revalidate=120`);
    return res.json(cache.data);
  }
  if (!fetching) fetchWeather().catch(e => console.error('[Weather] Initial fetch error:', e.message));
  return res.status(202).json({ success: false, loading: true, message: 'Weather data is loading, please retry in a moment.' });
});

async function fetchWeather() {
  if (fetching) return;
  fetching = true;
  const now = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const params = new URLSearchParams({
      latitude: BERLIN_LAT,
      longitude: BERLIN_LON,
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
      timezone: 'Europe/Berlin',
      forecast_days: '7'
    });

    const response = await fetch(`${OPEN_METEO_URL}?${params}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`Open-Meteo API returned ${response.status}`);

    const raw = await response.json();
    const current = {
      temperature: raw.current.temperature_2m,
      apparentTemperature: raw.current.apparent_temperature,
      humidity: raw.current.relative_humidity_2m,
      windSpeed: raw.current.wind_speed_10m,
      weatherCode: raw.current.weather_code,
      ...getWeatherInfo(raw.current.weather_code)
    };
    const forecast = raw.daily.time.map((date, i) => ({
      date,
      tempMax: raw.daily.temperature_2m_max[i],
      tempMin: raw.daily.temperature_2m_min[i],
      precipitationProbability: raw.daily.precipitation_probability_max[i],
      weatherCode: raw.daily.weather_code[i],
      ...getWeatherInfo(raw.daily.weather_code[i])
    }));
    cache = { data: { success: true, location: 'Berlin', current, forecast, lastUpdated: new Date().toISOString() }, timestamp: now };
    console.log('[Weather] Cache refreshed.');
  } catch (error) {
    console.error('[Weather] Fetch error:', error.message);
    throw error;
  } finally {
    clearTimeout(timeoutId);
    fetching = false;
  }
}

app.listen(PORT, () => {
  console.log(`[Weather Service] Running on port ${PORT}`);
  fetchWeather().catch(err => console.error('Initial weather fetch failed:', err.message));
  setInterval(() => {
    fetchWeather().catch(err => console.error('Background weather fetch failed:', err.message));
  }, CACHE_TTL);
});
