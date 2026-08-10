import { useState, useEffect } from 'react'
import { GALLERY_ITEMS } from '../data/galleryImages'
import { IconSparkles, IconShuffle } from '../components/Icons'
import './Gallery.css'

export default function Gallery() {
  const [items, setItems] = useState(GALLERY_ITEMS)
  const [selectedIndex, setSelectedIndex] = useState(null)

  // Shuffle order function
  const handleShuffle = () => {
    const shuffled = [...items].sort(() => Math.random() - 0.5)
    setItems(shuffled)
  }

  // Surprise Me - open lightbox with random photo
  const handleSurpriseMe = () => {
    const randomIndex = Math.floor(Math.random() * items.length)
    setSelectedIndex(randomIndex)
  }

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (selectedIndex === null) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedIndex(null)
      } else if (e.key === 'ArrowLeft') {
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : items.length - 1))
      } else if (e.key === 'ArrowRight') {
        setSelectedIndex(prev => (prev < items.length - 1 ? prev + 1 : 0))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedIndex, items.length])

  return (
    <div className="page" id="page-gallery">
      <header className="page-header flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <p className="page-subtitle">Berlin Moments</p>
          <h1 className="page-title">Photo Gallery</h1>
        </div>

        <div className="flex items-center gap-3">
          <button className="btn btn-primary btn-sm" onClick={handleSurpriseMe} id="btn-surprise-me">
            <IconSparkles size={14} style={{ display: 'inline', marginRight: 4 }} /> Surprise Me
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleShuffle} id="btn-shuffle">
            <IconShuffle size={14} style={{ display: 'inline', marginRight: 4 }} /> Shuffle Order
          </button>
        </div>
      </header>

      {/* Photo Grid */}
      <div className="gallery-grid" id="gallery-grid">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="gallery-card"
            onClick={() => setSelectedIndex(index)}
            id={`gallery-item-${index}`}
          >
            <div className="gallery-img-wrapper">
              <img
                src={item.thumbUrl}
                alt={`Berlin photo ${item.dateStr}`}
                loading="lazy"
                className="gallery-img"
              />
              <div className="gallery-card-overlay">
                <span className="badge badge-accent mono">{item.dateStr}</span>
                <span className="gallery-view-hint">View Photo →</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Full-Screen Zoomable Lightbox Modal */}
      {selectedIndex !== null && (
        <GalleryLightbox
          items={items}
          currentIndex={selectedIndex}
          onClose={() => setSelectedIndex(null)}
          onNext={() => setSelectedIndex((selectedIndex + 1) % items.length)}
          onPrev={() => setSelectedIndex((selectedIndex - 1 + items.length) % items.length)}
        />
      )}
    </div>
  )
}

function GalleryLightbox({ items, currentIndex, onClose, onNext, onPrev }) {
  const current = items[currentIndex]
  const [zoomLevel, setZoomLevel] = useState(1) // 1x, 1.8x, 2.5x

  // Reset zoom when navigating to another image
  useEffect(() => {
    setZoomLevel(1)
  }, [currentIndex])

  const toggleZoom = () => {
    setZoomLevel(prev => (prev === 1 ? 1.8 : prev === 1.8 ? 2.5 : 1))
  }

  const zoomIn = (e) => {
    e.stopPropagation()
    setZoomLevel(prev => Math.min(prev + 0.5, 3))
  }

  const zoomOut = (e) => {
    e.stopPropagation()
    setZoomLevel(prev => Math.max(prev - 0.5, 1))
  }

  const resetZoom = (e) => {
    e.stopPropagation()
    setZoomLevel(1)
  }

  return (
    <div className="gallery-fullscreen-lightbox" onClick={onClose}>
      {/* Top Floating Control Bar */}
      <div className="lightbox-control-bar" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <span className="badge badge-accent mono">{current.dateStr}</span>
          <span className="text-xs text-muted mono">{currentIndex + 1} / {items.length}</span>
        </div>

        {/* Zoom Controls */}
        <div className="lightbox-zoom-toolbar flex items-center gap-2">
          <button
            className="btn btn-secondary btn-sm"
            onClick={zoomOut}
            disabled={zoomLevel <= 1}
            title="Zoom Out (-)"
          >
            −
          </button>
          <button
            className="btn btn-secondary btn-sm mono"
            onClick={resetZoom}
            title="Reset Zoom"
          >
            {Math.round(zoomLevel * 100)}%
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={zoomIn}
            disabled={zoomLevel >= 3}
            title="Zoom In (+)"
          >
            +
          </button>
        </div>

        <button className="btn btn-ghost" onClick={onClose} aria-label="Close" style={{ fontSize: '1.2rem', padding: '4px 10px' }}>
          ✕
        </button>
      </div>

      {/* Main Full-Screen Image View */}
      <div
        className={`lightbox-viewport${zoomLevel > 1 ? ' zoomed' : ''}`}
        onClick={e => e.stopPropagation()}
      >
        <button className="fullscreen-nav-btn prev" onClick={onPrev} aria-label="Previous photo">
          ‹
        </button>

        <div className="lightbox-img-wrapper" onClick={toggleZoom}>
          <img
            src={current.url}
            alt={`Berlin photo ${current.dateStr}`}
            className="fullscreen-img"
            style={{
              transform: `scale(${zoomLevel})`,
              cursor: zoomLevel > 1 ? 'zoom-out' : 'zoom-in'
            }}
          />
        </div>

        <button className="fullscreen-nav-btn next" onClick={onNext} aria-label="Next photo">
          ›
        </button>
      </div>
    </div>
  )
}
