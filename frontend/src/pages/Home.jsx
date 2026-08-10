import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useApi, useBerlinTime } from '../hooks/useApi'
import { WeatherIcon, IconCheckCircle, IconShuffle } from '../components/Icons'
import EventDetailModal from '../components/EventDetailModal'
import { GALLERY_ITEMS } from '../data/galleryImages'
import './Home.css'

// Azure Blob Storage URL (falls back to local /images/ for dev)
const BLOB_URL = import.meta.env.VITE_BLOB_URL || '/images'

const HERO_IMAGES = [
  { url: `${BLOB_URL}/hero/tower.webp`, title: 'Berlin TV Tower' },
  { url: `${BLOB_URL}/hero/gate.jpg`, title: 'Brandenburg Gate' },
  { url: `${BLOB_URL}/hero/bundestag.jpg`, title: 'Bundestag' },
  { url: `${BLOB_URL}/hero/bridge.jpg`, title: 'Oberbaum Bridge' },
  { url: `${BLOB_URL}/hero/bridge2.jpg`, title: 'Berlin Spree' }
]

export default function Home() {
  const { formatted: time, date } = useBerlinTime()
  const { data: weather } = useApi('/weather')
  const { data: newsData } = useApi('/news?limit=5')
  const { data: eventsData } = useApi('/events?pageSize=6')
  const { data: transportData } = useApi('/transport/disruptions')

  const [selectedEvent, setSelectedEvent] = useState(null)
  const [heroIndex, setHeroIndex] = useState(0)
  const [randomPhoto, setRandomPhoto] = useState(() => GALLERY_ITEMS[Math.floor(Math.random() * GALLERY_ITEMS.length)])

  const handleNextRandomPhoto = () => {
    const idx = Math.floor(Math.random() * GALLERY_ITEMS.length)
    setRandomPhoto(GALLERY_ITEMS[idx])
  }

  // Auto-rotate hero background images every 10 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setHeroIndex(prev => (prev + 1) % HERO_IMAGES.length)
    }, 10000)
    return () => clearInterval(timer)
  }, [])

  const articles = newsData?.articles || []
  const events = eventsData?.data?.events || []
  const disruptions = transportData?.disruptions || []

  return (
    <div className="page" id="page-home">
      {/* Hero Banner with Auto-rotating Background Photos */}
      <div className="dashboard-hero" id="dashboard-hero">
        <div className="hero-bg-container">
          {HERO_IMAGES.map((img, i) => (
            <div
              key={img.url}
              className={`hero-bg-slide${i === heroIndex ? ' active' : ''}`}
              style={{ backgroundImage: `url(${img.url})` }}
            />
          ))}
          <div className="hero-bg-overlay" />
        </div>

        <div className="hero-time-block">
          <div className="hero-time mono">{time}</div>
          <div className="hero-date">{date}</div>
          <div className="hero-location">
            <span>Berlin, Germany</span>
            <span>•</span>
            <span className="mono text-accent">52.5200° N, 13.4050° E</span>
          </div>
        </div>

        {weather?.current && (
          <div className="hero-weather">
            <span className="weather-icon">{WeatherIcon(weather.current.weatherCode)}</span>
            <span className="weather-temp mono">{weather.current.temperature}°C</span>
            <div className="weather-details">
              <span className="weather-desc">{weather.current.description}</span>
              <span className="weather-meta mono">Humidity: {weather.current.humidity}% • Wind: {weather.current.windSpeed} km/h</span>
            </div>
          </div>
        )}

        <div className="hero-indicators">
          {HERO_IMAGES.map((img, i) => (
            <button
              key={img.url}
              className={`hero-indicator${i === heroIndex ? ' active' : ''}`}
              onClick={() => setHeroIndex(i)}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      </div>

      {/* 5-Day Weather Forecast Strip */}
      {weather?.forecast && weather.forecast.length > 0 && (
        <div className="widget mt-6" id="widget-forecast" style={{ padding: 0 }}>
          <div className="forecast-strip">
            {weather.forecast.map((day, i) => (
              <div key={day.date} className={`forecast-day${i === 0 ? ' today' : ''}`}>
                <span className="forecast-label">
                  {i === 0 ? 'Today' : new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })}
                </span>
                <span className="forecast-icon">{WeatherIcon(day.weatherCode)}</span>
                <div className="forecast-temps mono">
                  <span className="forecast-high">{day.tempMax}°</span>
                  <span className="forecast-low">{day.tempMin}°</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Dashboard Grid */}
      <div className="dashboard-grid mt-6">
        {/* Transport Status Widget */}
        <div className="widget" id="widget-transport">
          <div className="widget-header">
            <div>
              <span className="widget-title">BVG Disruptions</span>
              {transportData?.count > 0 && (
                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-accent, #e2001a)', lineHeight: 1, marginTop: '0.15rem' }}>
                  {transportData.count} <span style={{ fontSize: '0.75rem', fontWeight: '400', opacity: 0.7 }}>active</span>
                </div>
              )}
            </div>
            <Link to="/transport" className="widget-link">View all →</Link>
          </div>
          <div className="widget-body">
            {disruptions.length > 0 ? (
              <div className="transport-alert-list">
                {disruptions.slice(0, 3).map((d, i) => (
                  <div key={d.id || i} className="transport-alert-item">
                    <div className="transport-alert-lines">
                      {d.lines?.slice(0, 3).map((line, j) => {
                        const lineName = typeof line === 'string' ? line : (line?.name || String(line || ''))
                        const lineCls = String(lineName).toLowerCase()
                        return (
                          <span key={j} className={`badge badge-${d.transportType} badge-${lineCls}`}>{lineName}</span>
                        )
                      })}
                      {(!d.lines || d.lines.length === 0) && (
                        <span className={`badge badge-${d.transportType}`}>{d.transportType}</span>
                      )}
                    </div>
                    <p className="transport-alert-text truncate">{d.title}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="widget-empty">
                <IconCheckCircle size={20} />
                <span>All services running normally</span>
              </div>
            )}
          </div>
        </div>

        {/* News Widget */}
        <div className="widget" id="widget-news">
          <div className="widget-header">
            <span className="widget-title">Berliner Zeitung</span>
            <Link to="/news" className="widget-link">Read more →</Link>
          </div>
          <div className="widget-body">
            {articles.length > 0 ? (
              <div className="news-list">
                {articles.slice(0, 5).map((article, i) => {
                  let formattedDate = ''
                  if (article.pubDate) {
                    try {
                      const d = new Date(article.pubDate)
                      if (!isNaN(d.getTime())) {
                        formattedDate = d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })
                      }
                    } catch (e) {}
                  }
                  return (
                    <a
                      key={article.id || i}
                      href={article.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="news-list-item"
                    >
                      <span className="news-list-index mono">{String(i + 1).padStart(2, '0')}</span>
                      <div className="news-list-content">
                        <h4 className="news-list-title">{article.title}</h4>
                        {formattedDate && (
                          <span className="news-list-date text-xs text-muted">
                            {formattedDate}
                          </span>
                        )}
                      </div>
                    </a>
                  )
                })}
              </div>
            ) : (
              <div className="skeleton" style={{ height: 160 }} />
            )}
          </div>
        </div>
      </div>

      {/* Events (2/3 width) + Berlin Snapshot (1/3 width) Row */}
      <div className="dashboard-grid-2-1 mt-6">
        {/* Events Preview (3x3 grid) */}
        <div className="widget" id="widget-events">
          <div className="widget-header">
            <span className="widget-title">Upcoming Events</span>
            <Link to="/events" className="widget-link">Discover →</Link>
          </div>
          <div className="widget-body">
            {events.length > 0 ? (
              <div className="events-preview-grid">
                {events.slice(0, 6).map(event => {
                  const title = event.attractions?.[0]?.referenceLabel?.de 
                    || event.attractions?.[0]?.referenceLabel?.en 
                    || event.title?.de 
                    || event.title?.en 
                    || 'Kultur-Event'
                  const location = event.locations?.[0]?.referenceLabel?.de || ''
                  const startDate = event.schedule?.startDate
                  const startTime = event.schedule?.startTime

                  let eventDay = ''
                  let eventMonth = ''
                  if (startDate) {
                    try {
                      const d = new Date(startDate.includes('T') ? startDate : `${startDate}T00:00:00`)
                      if (!isNaN(d.getTime())) {
                        eventDay = d.toLocaleDateString('de-DE', { day: 'numeric' })
                        eventMonth = d.toLocaleDateString('de-DE', { month: 'short' })
                      }
                    } catch (e) {}
                  }

                  return (
                    <div
                      key={event.identifier}
                      className="event-preview-card clickable"
                      onClick={() => setSelectedEvent(event)}
                    >
                      <div className="event-preview-date mono">
                        {eventDay && (
                          <>
                            <span className="event-preview-day">{eventDay}</span>
                            <span className="event-preview-month">{eventMonth}</span>
                          </>
                        )}
                      </div>
                      <div className="event-preview-info">
                        <h4 className="event-preview-title truncate">{title}</h4>
                        <div className="event-preview-meta text-xs text-muted">
                          {location && <span className="truncate">{location}</span>}
                          {startTime && startTime !== '00:00:00' && <span>{startTime.slice(0, 5)}</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="skeleton" style={{ height: 200 }} />
            )}
          </div>
        </div>

        {/* Berlin Snapshot Widget */}
        {randomPhoto && (
          <div className="widget" id="widget-gallery-snapshot" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="widget-header">
              <span className="widget-title">Berlin Snapshot</span>
              <div className="flex items-center gap-3">
                <button
                  className="widget-link"
                  onClick={handleNextRandomPhoto}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  <IconShuffle size={12} style={{ display: 'inline', marginRight: 4 }} /> Randomize
                </button>
              </div>
            </div>
            <div className="widget-body" style={{ padding: 0, flex: 1, display: 'flex' }}>
              <Link to="/gallery" className="home-snapshot-card" style={{ flex: 1, minHeight: 280 }}>
                <img src={randomPhoto.thumbUrl} alt="Berlin Snapshot" className="home-snapshot-img" />
                <div className="home-snapshot-overlay">
                  <span className="badge badge-accent mono">{randomPhoto.dateStr}</span>
                  <span className="text-xs text-muted mono">Click to view Gallery ({GALLERY_ITEMS.length}) →</span>
                </div>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Detailed Event Modal */}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  )
}
