import { useState, useEffect, useCallback, useMemo, memo } from 'react'
import { IconCalendar, IconMapPin, IconSearch } from '../components/Icons'
import EventDetailModal from '../components/EventDetailModal'
import './Events.css'

const API_BASE = import.meta.env.VITE_API_URL || 'https://gateway-service.calmdesert-277cde2b.switzerlandnorth.azurecontainerapps.io/api'

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'music', label: 'Music & Concerts', pattern: /musik|konzert|concert|jazz|rock|pop|oper|symphon|orchester|choir|singing|band|dj|electro/i },
  { id: 'theater', label: 'Theater & Stage', pattern: /theater|bühne|schauspiel|tanz|ballett|drama|komödie|musical|operette|performance/i },
  { id: 'art', label: 'Art & Exhibitions', pattern: /ausstellung|galerie|kunst|exhibition|museum|fotografie|malerei|sculpture|skulptur|design/i },
  { id: 'family', label: 'Kids & Family', pattern: /kinder|familie|jugend|ferien|workshop|spiel|lernen|kids|märchen/i },
  { id: 'talks', label: 'Talks & Workshops', pattern: /vortrag|lesung|diskussion|workshop|seminar|führung|talk|buch|literatur|diskurs/i }
]

// Memoized category tabs: counts recalculated only when masterEvents changes
const CategoryTabs = memo(function CategoryTabs({ categories, masterEvents, activeCategory, onCategoryChange }) {
  const counts = useMemo(() => {
    const result = {}
    for (const cat of categories) {
      if (cat.id === 'all') {
        result[cat.id] = masterEvents.length
      } else {
        result[cat.id] = masterEvents.filter(e => {
          const text = [
            e.attractions?.[0]?.referenceLabel?.de,
            e.title?.de,
            e.title?.en,
            e.description?.de,
            e.description?.en
          ].filter(Boolean).join(' ')
          return cat.pattern?.test(text)
        }).length
      }
    }
    return result
  }, [categories, masterEvents])

  return (
    <div className="events-categories" id="events-categories">
      {categories.map(cat => (
        <button
          key={cat.id}
          className={`events-category-btn${activeCategory === cat.id ? ' active' : ''}`}
          onClick={() => onCategoryChange(cat.id)}
          id={`events-cat-${cat.id}`}
        >
          <span>{cat.label}</span>
          {cat.id !== 'all' && (
            <span className="mono text-xs opacity-70" style={{ marginLeft: 4 }}>({counts[cat.id]})</span>
          )}
        </button>
      ))}
    </div>
  )
})

let eventsSessionCache = null

export default function Events() {
  const [masterEvents, setMasterEvents] = useState(() => eventsSessionCache || [])
  const [loading, setLoading] = useState(() => !eventsSessionCache)
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [filterTime, setFilterTime] = useState('future') // 'future' | 'all' | 'today' | 'tomorrow' | 'dayAfter'
  const [filterFree, setFilterFree] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)

  const pageSize = 40

  // Memoize date strings so filteredEvents useMemo is not invalidated on every render
  const { todayStr, tomorrowStr, dayAfterTomorrowStr, dayAfterTomorrowLabel } = useMemo(() => {
    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)

    const tomorrowDate = new Date(now)
    tomorrowDate.setDate(now.getDate() + 1)
    const tomorrowStr = tomorrowDate.toISOString().slice(0, 10)

    const dayAfterTomorrowDate = new Date(now)
    dayAfterTomorrowDate.setDate(now.getDate() + 2)
    const dayAfterTomorrowStr = dayAfterTomorrowDate.toISOString().slice(0, 10)
    const dayAfterTomorrowLabel = dayAfterTomorrowDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
    return { todayStr, tomorrowStr, dayAfterTomorrowStr, dayAfterTomorrowLabel }
  }, [])

  // Fetch comprehensive master pool of events from backend API
  const fetchEvents = useCallback(async () => {
    if (eventsSessionCache) {
      setMasterEvents(eventsSessionCache)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const fetchWithRetry = async (url, options) => {
        const RETRY_DELAYS = [500, 1000, 1500, 2500, 4000, 6000, 10000]
        const RETRYABLE_STATUS = new Set([202, 502, 503, 504])
        for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
          const res = await fetch(url, options)
          if (!res.ok && RETRYABLE_STATUS.has(res.status)) {
            if (attempt < RETRY_DELAYS.length) {
              await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]))
              continue
            }
          }
          return res
        }
      }

      let res = await fetchWithRetry(
        `${API_BASE}/events/search?pageSize=400`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ inTheFuture: true })
        }
      )

      // Fallback to GET if POST search fails
      if (!res.ok) {
        res = await fetchWithRetry(`${API_BASE}/events?pageSize=400`, { headers: { 'Accept': 'application/json' } })
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()

      const allItems = data?.data?.events || []
      eventsSessionCache = allItems
      setMasterEvents(allItems)
    } catch (err) {
      console.error('Failed to fetch events:', err)
      setMasterEvents([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  // Filter master events first, BEFORE paginating
  const filteredEvents = useMemo(() => {
    let items = [...masterEvents]

    // Category filter
    if (activeCategory !== 'all') {
      const catObj = CATEGORIES.find(c => c.id === activeCategory)
      if (catObj?.pattern) {
        items = items.filter(e => {
          const text = [
            e.attractions?.[0]?.referenceLabel?.de,
            e.title?.de,
            e.title?.en,
            e.description?.de,
            e.description?.en,
            e.pleaseNote?.de
          ].filter(Boolean).join(' ')
          return catObj.pattern.test(text)
        })
      }
    }

    // Free entry filter
    if (filterFree) {
      items = items.filter(e => e.admission?.ticketType === 'ticketType.freeOfCharge')
    }

    // Time filters (Today / Tomorrow / Day After Tomorrow)
    if (filterTime === 'today') {
      items = items.filter(e => e.schedule?.startDate === todayStr)
    } else if (filterTime === 'tomorrow') {
      items = items.filter(e => e.schedule?.startDate === tomorrowStr)
    } else if (filterTime === 'dayAfter') {
      items = items.filter(e => e.schedule?.startDate === dayAfterTomorrowStr)
    }

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      items = items.filter(e => {
        const title = (e.attractions?.[0]?.referenceLabel?.de || e.title?.de || e.title?.en || '').toLowerCase()
        const desc = (e.description?.de || e.description?.en || e.pleaseNote?.de || '').toLowerCase()
        const loc = (e.locations?.[0]?.referenceLabel?.de || '').toLowerCase()
        return title.includes(q) || desc.includes(q) || loc.includes(q)
      })
    }

    return items
  }, [masterEvents, activeCategory, filterFree, filterTime, searchQuery, todayStr, tomorrowStr, dayAfterTomorrowStr])

  // Paginate AFTER filtering into full 40-item pages
  const totalCount = filteredEvents.length
  const totalPages = Math.ceil(totalCount / pageSize)
  const paginatedEvents = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredEvents.slice(start, start + pageSize)
  }, [filteredEvents, page, pageSize])

  // Reset page to 1 when filters change
  const handleCategoryChange = (catId) => {
    setActiveCategory(catId)
    setPage(1)
  }

  const handleSearchChange = (query) => {
    setSearchQuery(query)
    setPage(1)
  }

  const handleTimeChange = (timeMode) => {
    setFilterTime(filterTime === timeMode ? 'future' : timeMode)
    setPage(1)
  }

  const handleFreeChange = () => {
    setFilterFree(!filterFree)
    setPage(1)
  }

  return (
    <div className="page" id="page-events">
      <header className="page-header">
        <p className="page-subtitle">Discover</p>
        <h1 className="page-title">Events in Berlin</h1>
      </header>

      {/* Category Tabs – counts memoized to avoid re-filtering on every render */}
      <CategoryTabs
        categories={CATEGORIES}
        masterEvents={masterEvents}
        activeCategory={activeCategory}
        onCategoryChange={handleCategoryChange}
      />

      {/* Filters Bar */}
      <div className="filter-bar" id="events-filters">
        <input
          type="text"
          className="form-input search-input"
          placeholder="Search events, venues, topics..."
          value={searchQuery}
          onChange={e => handleSearchChange(e.target.value)}
          id="events-search"
        />

        <div className="filter-group">
          <button
            className={`btn btn-secondary btn-sm${filterTime === 'today' ? ' active' : ''}`}
            onClick={() => handleTimeChange('today')}
            id="filter-today"
          >
            Today
          </button>
          <button
            className={`btn btn-secondary btn-sm${filterTime === 'tomorrow' ? ' active' : ''}`}
            onClick={() => handleTimeChange('tomorrow')}
            id="filter-tomorrow"
          >
            Tomorrow
          </button>
          <button
            className={`btn btn-secondary btn-sm${filterTime === 'dayAfter' ? ' active' : ''}`}
            onClick={() => handleTimeChange('dayAfter')}
            id="filter-day-after"
          >
            {dayAfterTomorrowLabel}
          </button>
          <button
            className={`btn btn-secondary btn-sm${filterFree ? ' active' : ''}`}
            onClick={handleFreeChange}
            id="filter-free"
          >
            Free Entry
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card-grid card-grid-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="skeleton event-skeleton" />
          ))}
        </div>
      ) : paginatedEvents.length > 0 ? (
        <>
          <div className="events-count text-xs text-muted mb-4 mono">
            Showing {paginatedEvents.length} of {totalCount.toLocaleString()} matching events
          </div>
          <div className="card-grid card-grid-3" id="events-grid">
            {paginatedEvents.map(event => (
              <EventCard
                key={event.identifier}
                event={event}
                onClick={() => setSelectedEvent(event)}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination" id="events-pagination">
              <button
                className="pagination-btn"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                ←
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
                let pageNum
                if (totalPages <= 7) {
                  pageNum = i + 1
                } else if (page <= 4) {
                  pageNum = i + 1
                } else if (page >= totalPages - 3) {
                  pageNum = totalPages - 6 + i
                } else {
                  pageNum = page - 3 + i
                }
                return (
                  <button
                    key={pageNum}
                    className={`pagination-btn${pageNum === page ? ' active' : ''}`}
                    onClick={() => setPage(pageNum)}
                  >
                    {pageNum}
                  </button>
                )
              })}
              <button
                className="pagination-btn"
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                →
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon"><IconCalendar size={36} /></div>
          <h3 className="empty-state-title">No events found</h3>
          <p className="text-muted">Try adjusting your filters or search term.</p>
        </div>
      )}

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

const EventCard = memo(function EventCard({ event, onClick }) {
  const title = event.attractions?.[0]?.referenceLabel?.de 
    || event.attractions?.[0]?.referenceLabel?.en 
    || event.title?.de 
    || event.title?.en 
    || 'Kultur-Event'

  const description = event.description?.de 
    || event.description?.en 
    || event.pleaseNote?.de 
    || ''

  const location = event.locations?.[0]?.referenceLabel?.de 
    || event.locations?.[0]?.referenceLabel?.en 
    || ''

  const startDate = event.schedule?.startDate
  const startTime = event.schedule?.startTime
  const endDate = event.schedule?.endDate
  const isFree = event.admission?.ticketType === 'ticketType.freeOfCharge'

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    try {
      return new Date(dateStr + 'T00:00:00').toLocaleDateString('de-DE', {
        day: 'numeric',
        month: 'short'
      })
    } catch {
      return dateStr
    }
  }

  return (
    <article
      className="card event-card clickable"
      onClick={onClick}
      id={`event-${event.identifier}`}
    >
      <div className="event-card-header">
        <div className="event-card-date-badge mono">
          {startDate && (
            <>
              <span className="event-card-day">
                {new Date(startDate + 'T00:00:00').toLocaleDateString('de-DE', { day: 'numeric' })}
              </span>
              <span className="event-card-month">
                {new Date(startDate + 'T00:00:00').toLocaleDateString('de-DE', { month: 'short' })}
              </span>
            </>
          )}
        </div>
        <div className="event-card-tags">
          {isFree && <span className="badge badge-success">Free</span>}
          {event.scheduleStatus === 'event.cancelled' && <span className="badge badge-danger">Cancelled</span>}
        </div>
      </div>

      <h3 className="event-card-title">{title}</h3>

      {description && (
        <p className="event-card-desc">{description.slice(0, 120)}{description.length > 120 ? '…' : ''}</p>
      )}

      <div className="event-card-footer">
        <div className="event-card-meta">
          {location && (
            <span className="event-card-location">
              <IconMapPin size={12} style={{ display: 'inline-block', marginRight: 6, verticalAlign: 'middle' }} />
              {' '}
              {location}
            </span>
          )}
          {startTime && startTime !== '00:00:00' && (
            <span className="event-card-time mono">
              {startTime.slice(0, 5)}
            </span>
          )}
          {endDate && endDate !== startDate && (
            <span className="event-card-range">
              → {formatDate(endDate)}
            </span>
          )}
        </div>

        <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); onClick() }}>
          Details →
        </button>
      </div>
    </article>
  )
})


