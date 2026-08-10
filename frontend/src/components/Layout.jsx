import { useState } from 'react'
import { Outlet, NavLink, Link } from 'react-router-dom'
import { useTheme } from '../hooks/useTheme'

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { themeMode, toggleTheme } = useTheme()

  const navItems = [
    { to: '/', label: 'Home' },
    { to: '/events', label: 'Events' },
    { to: '/transport', label: 'Transport' },
    { to: '/news', label: 'News' },
    { to: '/gallery', label: 'Gallery' }
  ]

  const renderThemeIcon = () => {
    if (themeMode === 'dark') {
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      )
    }
    if (themeMode === 'light') {
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/>
          <line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      )
    }
    // System theme icon
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
        <line x1="8" y1="21" x2="16" y2="21"/>
        <line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
    )
  }

  const getThemeTitle = () => {
    if (themeMode === 'dark') return 'Theme: Dark (click for light)'
    if (themeMode === 'light') return 'Theme: Light (click for system)'
    return 'Theme: System (click for dark)'
  }

  return (
    <div className="app-layout">
      <nav className="nav" role="navigation" aria-label="Main navigation">
        <div className="nav-inner">
          <Link to="/" className="nav-brand" id="nav-brand">
            Berlin Pulse
          </Link>

          <div className="nav-right-actions">
            <div className={`nav-links${menuOpen ? ' open' : ''}`} id="nav-links">
              {navItems.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                  onClick={() => setMenuOpen(false)}
                  id={`nav-link-${item.label.toLowerCase()}`}
                >
                  {item.label}
                </NavLink>
              ))}
              
              <button
                className="theme-toggle-btn icon-only"
                onClick={toggleTheme}
                title={getThemeTitle()}
                aria-label={getThemeTitle()}
                id="theme-toggle-btn"
              >
                {renderThemeIcon()}
              </button>
            </div>

            <button
              className="nav-mobile-toggle"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle navigation menu"
              aria-expanded={menuOpen}
              id="nav-mobile-toggle"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                {menuOpen ? (
                  <>
                    <line x1="6" y1="6" x2="18" y2="18" />
                    <line x1="6" y1="18" x2="18" y2="6" />
                  </>
                ) : (
                  <>
                    <line x1="4" y1="7" x2="20" y2="7" />
                    <line x1="4" y1="12" x2="20" y2="12" />
                    <line x1="4" y1="17" x2="20" y2="17" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>
      </nav>

      <main className="main-content" id="main">
        <Outlet />
      </main>
    </div>
  )
}
