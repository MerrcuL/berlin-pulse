import { Component, Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'

function lazyWithRetry(componentImport) {
  return lazy(async () => {
    const pageHasBeenReloaded = JSON.parse(
      window.sessionStorage.getItem('page_reloaded_for_chunk') || 'false'
    )
    try {
      const component = await componentImport()
      window.sessionStorage.setItem('page_reloaded_for_chunk', 'false')
      return component
    } catch (error) {
      if (!pageHasBeenReloaded) {
        window.sessionStorage.setItem('page_reloaded_for_chunk', 'true')
        // Cache-busting reload
        window.location.href = window.location.pathname + '?t=' + Date.now()
      }
      throw error
    }
  })
}

const Home = lazyWithRetry(() => import('./pages/Home'))
const Events = lazyWithRetry(() => import('./pages/Events'))
const Transport = lazyWithRetry(() => import('./pages/Transport'))
const News = lazyWithRetry(() => import('./pages/News'))
const Gallery = lazyWithRetry(() => import('./pages/Gallery'))

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('UI Render Error caught by ErrorBoundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
          <h2>Something went wrong loading this section.</h2>
          <p style={{ opacity: 0.7, margin: '1rem 0' }}>{this.state.error?.message || 'An unexpected rendering error occurred.'}</p>
          <button className="btn btn-primary" onClick={() => {
            window.sessionStorage.removeItem('page_reloaded_for_chunk')
            window.location.href = window.location.pathname + '?t=' + Date.now()
          }}>
            Reload Page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function PageFallback() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <div className="loading-spinner" />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="/events" element={<Events />} />
              <Route path="/transport" element={<Transport />} />
              <Route path="/news" element={<News />} />
              <Route path="/gallery" element={<Gallery />} />
            </Route>
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
