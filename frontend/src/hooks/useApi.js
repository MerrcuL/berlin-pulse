import { useState, useEffect, useCallback, useRef } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || 'https://gateway-service.calmdesert-277cde2b.switzerlandnorth.azurecontainerapps.io/api'

// Retry delays when a service isn't ready yet (202/5xx).
// Short intervals so each widget shows its data the moment IT individually responds,
// rather than all widgets waiting for the same slow retry cycle.
const RETRY_DELAYS = [500, 1000, 1500, 2500, 4000, 6000, 10000] // ~27s total

// HTTP status codes that are temporary and worth retrying (cold-start / upstream slow)
const RETRYABLE_STATUS = new Set([202, 502, 503, 504])

export function useApi(path, options = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const { method = 'GET', body = null, auto = true, transform } = options

  // Stabilize transform with a ref so callers can pass inline functions
  // without triggering infinite re-renders via the useCallback dep array
  const transformRef = useRef(transform)
  transformRef.current = transform

  const execute = useCallback(async (overrideBody, signal) => {
    setLoading(true)
    setError(null)

    const fetchOptions = {
      method,
      headers: { 'Accept': 'application/json' },
      signal
    }

    const requestBody = overrideBody || body
    if (requestBody) {
      fetchOptions.headers['Content-Type'] = 'application/json'
      fetchOptions.body = JSON.stringify(requestBody)
    }

    // Retry loop — handles 202 (loading) and 502/503/504 (gateway/upstream not ready yet)
    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      try {
        const res = await fetch(`${API_BASE}${path}`, fetchOptions)

        // Hard client error — don't retry
        if (!res.ok && !RETRYABLE_STATUS.has(res.status)) {
          throw new Error(`Request failed: ${res.status}`)
        }

        // For 5xx errors we can't always parse JSON — guard against it
        let result = null
        try {
          result = await res.json()
        } catch {
          result = null
        }

        // Service not ready yet — retry after a delay
        if (RETRYABLE_STATUS.has(res.status) || result?.loading === true) {
          if (attempt < RETRY_DELAYS.length) {
            const delay = RETRY_DELAYS[attempt]
            console.log(`[useApi] ${path} not ready (HTTP ${res.status}, attempt ${attempt + 1}), retrying in ${delay}ms…`)
            await new Promise((resolve, reject) => {
              const t = setTimeout(resolve, delay)
              // Abort cleanly if the component unmounts
              signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')) })
            })
            continue
          }
          // Exhausted retries — surface an error
          throw new Error('Service is taking too long to respond. Please refresh the page.')
        }

        if (transformRef.current) result = transformRef.current(result)

        setData(result)
        setLoading(false)
        return result
      } catch (err) {
        if (err.name === 'AbortError') {
          setLoading(false)
          return null
        }
        setError(err.message)
        setLoading(false)
        return null
      }
    }
  }, [path, method, body])

  useEffect(() => {
    if (!auto) return
    const controller = new AbortController()
    execute(null, controller.signal)
    return () => controller.abort()
  }, [auto, execute])

  return { data, loading, error, refetch: execute }
}

export function useInterval(callback, delay) {
  // Always call the latest callback without re-creating the interval
  const savedCallback = useRef(callback)
  savedCallback.current = callback

  useEffect(() => {
    if (delay === null) return
    const id = setInterval(() => savedCallback.current(), delay)
    return () => clearInterval(id)
  }, [delay])
}

export function useBerlinTime() {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const formatted = time.toLocaleTimeString('de-DE', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })

  const date = time.toLocaleDateString('de-DE', {
    timeZone: 'Europe/Berlin',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })

  return { time, formatted, date }
}
