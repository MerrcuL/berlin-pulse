import { useState, useEffect } from 'react'

export function useTheme() {
  const [themeMode, setThemeModeState] = useState(() => {
    return localStorage.getItem('berlin_pulse_theme') || 'system'
  })

  useEffect(() => {
    const applyTheme = () => {
      let resolvedTheme = themeMode

      if (themeMode === 'system') {
        resolvedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
      }

      document.documentElement.setAttribute('data-theme', resolvedTheme)
    }

    applyTheme()

    // System theme change listener
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if (themeMode === 'system') {
        applyTheme()
      }
    }

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange)
    } else {
      mediaQuery.addListener(handleChange)
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange)
      } else {
        mediaQuery.removeListener(handleChange)
      }
    }
  }, [themeMode])

  const setThemeMode = (mode) => {
    localStorage.setItem('berlin_pulse_theme', mode)
    setThemeModeState(mode)
  }

  // Cycle through System -> Dark -> Light -> System
  const toggleTheme = () => {
    if (themeMode === 'system') setThemeMode('dark')
    else if (themeMode === 'dark') setThemeMode('light')
    else setThemeMode('system')
  }

  return { themeMode, setThemeMode, toggleTheme }
}
