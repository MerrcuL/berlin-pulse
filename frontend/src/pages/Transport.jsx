import { useState, useMemo, memo } from 'react'
import { useApi } from '../hooks/useApi'
import {
  IconSubway,
  IconTram,
  IconBus,
  IconFerry,
  IconGrid,
  IconAlertTriangle,
  IconCheckCircle
} from '../components/Icons'
import './Transport.css'

const TRANSPORT_TYPES = [
  { id: 'all', label: 'All', iconComponent: IconGrid },
  { id: 'ubahn', label: 'U-Bahn', iconComponent: IconSubway, className: 'ubahn' },
  { id: 'tram', label: 'Tram', iconComponent: IconTram, className: 'tram' },
  { id: 'bus', label: 'Bus', iconComponent: IconBus, className: 'bus' },
  { id: 'ferry', label: 'Fähre', iconComponent: IconFerry, className: 'ferry' }
]

export default function Transport() {
  const [activeType, setActiveType] = useState('all')
  const [expandedId, setExpandedId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Always fetch complete list of disruptions so tab badge counts are always accurate
  const { data, loading, error, refetch } = useApi('/transport/disruptions')

  const allDisruptions = data?.disruptions || []
  const lastUpdated = data?.lastUpdated

  // Client-side filtering by type and search query (memoized)
  const filtered = useMemo(() => allDisruptions.filter(d => {
    // Type filter
    if (activeType !== 'all' && d.transportType !== activeType) {
      return false
    }
    // Search query filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const matchesTitle = d.title?.toLowerCase().includes(q)
      const matchesDesc = d.description?.toLowerCase().includes(q)
      const matchesLines = d.lines?.some(l => l.toLowerCase().includes(q))
      return matchesTitle || matchesDesc || matchesLines
    }
    return true
  }), [allDisruptions, activeType, searchQuery])

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    try {
      return new Date(dateStr).toLocaleDateString('de-DE', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="page" id="page-transport">
      <header className="page-header">
        <p className="page-subtitle">BVG Störungsmeldungen</p>
        <h1 className="page-title">Transport Disruptions</h1>
        {lastUpdated && (
          <p className="text-xs text-muted mt-2 mono">
            Last updated: {new Date(lastUpdated).toLocaleTimeString('de-DE')}
          </p>
        )}
      </header>

      {/* Type Filter Tabs */}
      <div className="transport-tabs" id="transport-type-filters">
        {TRANSPORT_TYPES.map(type => {
          const IconComp = type.iconComponent
          const count = type.id === 'all'
            ? allDisruptions.length
            : allDisruptions.filter(d => d.transportType === type.id).length

          return (
            <button
              key={type.id}
              className={`transport-tab${activeType === type.id ? ' active' : ''}${type.className ? ` tab-${type.className}` : ''}`}
              onClick={() => { setActiveType(type.id); setExpandedId(null) }}
              id={`transport-tab-${type.id}`}
            >
              <span className="transport-tab-icon"><IconComp size={16} /></span>
              <span className="transport-tab-label">{type.label}</span>
              <span className="transport-tab-count mono">{count}</span>
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div className="filter-bar">
        <input
          type="text"
          className="form-input search-input"
          placeholder="Search by line, station, or description..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          id="transport-search"
        />
        <button className="btn btn-ghost btn-sm" onClick={() => refetch()} id="transport-refresh">
          ↻ Refresh
        </button>
      </div>

      {/* Results */}
      {loading ? (
        <div className="disruption-list">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton disruption-skeleton" />
          ))}
        </div>
      ) : error ? (
        <div className="empty-state">
          <div className="empty-state-icon"><IconAlertTriangle size={36} /></div>
          <h3 className="empty-state-title">Failed to load disruptions</h3>
          <p className="text-muted">{error}</p>
          <button className="btn btn-secondary mt-4" onClick={() => refetch()}>Try again</button>
        </div>
      ) : filtered.length > 0 ? (
        <>
          <div className="disruption-summary text-xs text-muted mb-4 mono">
            Showing {filtered.length} of {allDisruptions.length} disruptions
          </div>
          <div className="disruption-list" id="disruption-list">
            {filtered.map((d, i) => (
              <DisruptionCard
                key={d.id || i}
                disruption={d}
                expanded={expandedId === (d.id || i)}
                onToggle={() => setExpandedId(expandedId === (d.id || i) ? null : (d.id || i))}
                formatDate={formatDate}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon"><IconCheckCircle size={36} /></div>
          <h3 className="empty-state-title">No disruptions</h3>
          <p className="text-muted">
            {activeType === 'all'
              ? 'All services are running normally.'
              : `No disruptions found for ${TRANSPORT_TYPES.find(t => t.id === activeType)?.label || activeType}.`}
          </p>
        </div>
      )}
    </div>
  )
}

const DisruptionCard = memo(function DisruptionCard({ disruption, expanded, onToggle, formatDate }) {
  const d = disruption
  const isPlanned = d.isPlanned || d.type?.toLowerCase().includes('planned')

  return (
    <article
      className={`disruption-card${expanded ? ' expanded' : ''}`}
      onClick={onToggle}
      id={`disruption-${d.id}`}
    >
      <div className="disruption-card-header">
        <div className="disruption-card-lines">
          {d.lines?.length > 0 ? (
            d.lines.slice(0, 5).map((line, i) => (
              <span key={i} className={`badge badge-${d.transportType} badge-${line.toLowerCase()}`}>{line}</span>
            ))
          ) : (
            <span className={`badge badge-${d.transportType}`}>{d.transportType}</span>
          )}
          {d.lines?.length > 5 && (
            <span className="badge">+{d.lines.length - 5}</span>
          )}
        </div>

        <div className="disruption-card-indicators">
          {isPlanned && (
            <span className="badge badge-warning">Planned</span>
          )}
          <span className="disruption-expand-icon">{expanded ? '−' : '+'}</span>
        </div>
      </div>

      <h3 className="disruption-card-title">{d.title}</h3>

      {(d.validFrom || d.validTo) && (
        <div className="disruption-card-dates text-xs text-muted mono">
          {d.validFrom && <span>From: {formatDate(d.validFrom)}</span>}
          {d.validTo && <span>Until: {formatDate(d.validTo)}</span>}
        </div>
      )}

      {expanded && d.description && (
        <div className="disruption-card-detail">
          <p className="disruption-card-desc" dangerouslySetInnerHTML={{ __html: d.description }} />
          {d.lastModified && (
            <p className="disruption-card-modified text-xs text-muted mono mt-4">
              Last modified: {formatDate(d.lastModified)}
            </p>
          )}
        </div>
      )}
    </article>
  )
})
