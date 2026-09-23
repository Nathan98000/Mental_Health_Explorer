import { useEffect, useState } from 'react'

export type ChartTheme = {
  surface: string
  ink: string
  ink2: string
  muted: string
  grid: string
  series: string[]
}

const FALLBACK: ChartTheme = {
  surface: '#fffdf8',
  ink: '#1e2240',
  ink2: '#4b4f6b',
  muted: '#6b6f86',
  grid: '#ede6da',
  series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'],
}

function readTheme(): ChartTheme {
  if (typeof window === 'undefined' || typeof getComputedStyle === 'undefined') return FALLBACK
  const css = getComputedStyle(document.documentElement)
  const get = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
  return {
    surface: get('--surface', FALLBACK.surface),
    ink: get('--ink', FALLBACK.ink),
    ink2: get('--ink-2', FALLBACK.ink2),
    muted: get('--muted', FALLBACK.muted),
    grid: get('--grid', FALLBACK.grid),
    series: FALLBACK.series.map((c, i) => get(`--series-${i + 1}`, c)),
  }
}

/**
 * Chart colors resolved from the CSS tokens. SVG attributes cannot use var(),
 * so charts read the computed values and re-render when the color scheme changes.
 */
export function useChartTheme(): ChartTheme {
  const [theme, setTheme] = useState<ChartTheme>(readTheme)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setTheme(readTheme())
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return theme
}
