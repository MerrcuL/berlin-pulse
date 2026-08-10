import { useState, useEffect } from 'react'
import { IconMapPin, IconGlobe } from './Icons'

const API_BASE = import.meta.env.VITE_API_URL || 'https://gateway-service.calmdesert-277cde2b.switzerlandnorth.azurecontainerapps.io/api'

const detailCache = new Map()

export default function EventDetailModal({ event, onClose }) {
  const attractionId = event.attractions?.[0]?.referenceId
  const cacheKey = attractionId ? `attr_${attractionId}` : (event.identifier ? `evt_${event.identifier}` : null)

  const [detail, setDetail] = useState(() => {
    if (cacheKey && detailCache.has(cacheKey)) {
      return detailCache.get(cacheKey)
    }
    return event
  })

  const isAlreadyLoaded = Boolean(event.description || (cacheKey && detailCache.has(cacheKey)))
  const [loadingDetail, setLoadingDetail] = useState(!isAlreadyLoaded)
  const [copied, setCopied] = useState(false)

  // Disable background scrolling when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [])

  // Fetch full details (attraction description, website) lazily when modal opens
  useEffect(() => {
    let isMounted = true

    if (cacheKey && detailCache.has(cacheKey)) {
      setDetail(detailCache.get(cacheKey))
      setLoadingDetail(false)
      return
    }

    if (!event.description && (event.identifier || attractionId)) {
      setLoadingDetail(true)
      
      const fetchUrl = attractionId 
        ? `${API_BASE}/events/attractions/${attractionId}`
        : `${API_BASE}/events/${event.identifier}`

      fetch(fetchUrl, { headers: { 'Accept': 'application/json' } })
        .then(res => res.json())
        .then(data => {
          if (!isMounted) return
          const attraction = data?.data?.attraction
          const singleEvent = data?.data?.event
          
          let merged = null
          if (attraction) {
            merged = {
              ...event,
              title: attraction.title || event.title,
              description: attraction.description || event.description,
              website: attraction.website || attraction.url || event.website
            }
          } else if (singleEvent) {
            merged = singleEvent
          }

          if (merged) {
            if (cacheKey) detailCache.set(cacheKey, merged)
            setDetail(merged)
          }
        })
        .catch(err => console.error('Failed to load event details:', err))
        .finally(() => {
          if (isMounted) setLoadingDetail(false)
        })
    } else {
      setLoadingDetail(false)
    }

    return () => { isMounted = false }
  }, [event, cacheKey, attractionId])

  const title = detail.attractions?.[0]?.referenceLabel?.de 
    || detail.attractions?.[0]?.referenceLabel?.en 
    || detail.title?.de 
    || detail.title?.en 
    || 'Kultur-Event'

  const description = detail.description?.de 
    || detail.description?.en 
    || detail.pleaseNote?.de 
    || (typeof detail.description === 'string' ? detail.description : null)

  const location = detail.locations?.[0]?.referenceLabel?.de 
    || detail.locations?.[0]?.referenceLabel?.en 
    || 'Berlin'

  const startDate = detail.schedule?.startDate
  const startTime = detail.schedule?.startTime || '10:00:00'
  const endDate = detail.schedule?.endDate || startDate
  const isFree = detail.admission?.ticketType === 'ticketType.freeOfCharge'
  
  const eventLink = detail.website || detail.admission?.admissionLink || detail.attractions?.[0]?.url || null

  const createGoogleCalendarUrl = () => {
    if (!startDate) return '#'
    const startIso = startDate.replace(/-/g, '') + 'T' + startTime.replace(/:/g, '')
    const endIso = (endDate || startDate).replace(/-/g, '') + 'T220000'
    const details = encodeURIComponent((description || title).slice(0, 300) + '\n\nEvent via Berlin Pulse')
    const loc = encodeURIComponent(location)
    const t = encodeURIComponent(title)
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${t}&dates=${startIso}/${endIso}&details=${details}&location=${loc}`
  }

  const handleCopyLink = () => {
    if (!eventLink) return
    navigator.clipboard.writeText(eventLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal event-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="badge badge-accent">Event</span>
              {isFree && <span className="badge badge-success">Free Entry</span>}
            </div>
            <button className="btn btn-ghost" onClick={onClose} aria-label="Close" style={{ padding: '2px 6px', fontSize: '1.1rem' }}>✕</button>
          </div>

          <h2 className="event-modal-title" style={{ margin: 0 }}>{title}</h2>
        </div>

        <div className="modal-body">
          <div className="event-modal-info-box">
            <div className="info-row">
              <span className="info-label">Date & Time</span>
              <span className="info-value mono">
                {startDate && new Date(startDate + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                {startTime && startTime !== '00:00:00' && ` um ${startTime.slice(0, 5)} Uhr`}
              </span>
            </div>

            {location && (
              <div className="info-row">
                <span className="info-label">Location / Venue</span>
                <span className="info-value">
                  <IconMapPin size={14} style={{ display: 'inline-block', marginRight: 6, verticalAlign: 'middle' }} />
                  {' '}
                  {location}
                </span>
              </div>
            )}

            <div className="info-row">
              <span className="info-label">Admission</span>
              <span className="info-value">
                {isFree ? 'Kostenlos (Free Admission)' : 'Tickets / Eintritt laut Veranstalter'}
              </span>
            </div>
          </div>

          <div className="event-modal-description mt-6">
            <h4 className="form-label">Description</h4>
            {loadingDetail ? (
              <div className="skeleton mt-2" style={{ height: 80, borderRadius: 4 }} />
            ) : description ? (
              <p className="text-sm leading-relaxed" style={{ whiteSpace: 'pre-line' }}>{description}</p>
            ) : (
              <p className="text-sm text-muted italic">Keine Beschreibung verfügbar.</p>
            )}
          </div>
        </div>

        <div className="modal-footer">
          {eventLink && (
            <button className="btn btn-secondary btn-sm" onClick={handleCopyLink}>
              {copied ? '✓ Link Copied' : 'Copy Event Link'}
            </button>
          )}

          <a
            href={createGoogleCalendarUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-sm"
          >
            + Add to Calendar
          </a>

          {eventLink && (
            <a
              href={eventLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary btn-sm"
              title="Official Website"
            >
              <IconGlobe size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 4 }} /> ↗
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
