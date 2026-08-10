import { useState } from 'react'
import { useApi } from '../hooks/useApi'
import { IconNewspaper, IconSearch } from '../components/Icons'
import './News.css'

export default function News() {
  const [searchQuery, setSearchQuery] = useState('')
  const { data, loading, error, refetch } = useApi('/news')

  const articles = data?.articles || []
  const lastUpdated = data?.lastUpdated

  const filtered = searchQuery
    ? articles.filter(a => {
        const q = searchQuery.toLowerCase()
        return a.title?.toLowerCase().includes(q) || a.description?.toLowerCase().includes(q)
      })
    : articles

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return ''
    const now = new Date()
    const date = new Date(dateStr)
    const diff = now - date
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor(diff / (1000 * 60))

    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days === 1) return 'Yesterday'
    return `${days}d ago`
  }

  return (
    <div className="page" id="page-news">
      <header className="page-header">
        <p className="page-subtitle">Berliner Zeitung</p>
        <h1 className="page-title">News Feed</h1>
        {lastUpdated && (
          <p className="text-xs text-muted mt-2 mono">
            Feed updated: {new Date(lastUpdated).toLocaleTimeString('de-DE')}
          </p>
        )}
      </header>

      <div className="filter-bar">
        <input
          type="text"
          className="form-input search-input"
          placeholder="Search articles..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          id="news-search"
        />
        <button className="btn btn-ghost btn-sm" onClick={() => refetch()} id="news-refresh">
          ↻ Refresh
        </button>
      </div>

      {loading ? (
        <div className="news-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton news-skeleton" />
          ))}
        </div>
      ) : error ? (
        <div className="empty-state">
          <div className="empty-state-icon"><IconNewspaper size={36} /></div>
          <h3 className="empty-state-title">Failed to load news</h3>
          <p className="text-muted">{error}</p>
          <button className="btn btn-secondary mt-4" onClick={() => refetch()}>Try again</button>
        </div>
      ) : filtered.length > 0 ? (
        <div className="news-grid" id="news-grid">
          {filtered.map((article, i) => (
            <a
              key={article.id}
              href={article.link}
              target="_blank"
              rel="noopener noreferrer"
              className={`news-card${i === 0 ? ' news-card-featured' : ''}`}
              id={`news-${article.id}`}
            >
              {article.thumbnail && (
                <div className="news-card-image-wrapper">
                  <img
                    src={article.thumbnail}
                    alt=""
                    className="news-card-image"
                    loading="lazy"
                  />
                  <div className="news-card-image-overlay" />
                </div>
              )}
              <div className="news-card-content">
                <h3 className="news-card-title">{article.title}</h3>
                {article.description && (
                  <p className="news-card-desc">{article.description}</p>
                )}
                <div className="news-card-meta">
                  <span className="news-card-time mono">{formatTimeAgo(article.pubDate)}</span>
                  <span className="news-card-source">berliner-zeitung.de</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon"><IconSearch size={36} /></div>
          <h3 className="empty-state-title">No articles found</h3>
          <p className="text-muted">Try a different search term.</p>
        </div>
      )}
    </div>
  )
}
