import { useEffect, useState } from 'react'
import type { Group } from './catalog'

export type ChartTheme = {
  surface: string
  ink: string
  ink2: string
  muted: string
  grid: string
  line: string
  primary: string
  /** Categorical slots for unordered groups (sex, insurance, where they live…). */
  series: string[]
  /** Single-hue ramp, light to dark, for ordered groups (age, income…). */
  sequential: string[]
}

const FALLBACK: ChartTheme = {
  surface: '#fffdf8',
  ink: '#1e2240',
  ink2: '#4b4f6b',
  muted: '#6b6f86',
  grid: '#ede6da',
  line: '#ede6da',
  primary: '#c2410c',
  series: ['#2a78d6', '#eb6834', '#15915f', '#b57a00', '#d9598c'],
  sequential: ['#4a90e2', '#2a78d6', '#1d5fb0', '#164a8a', '#0f3563'],
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
    line: get('--line', FALLBACK.line),
    primary: get('--primary', FALLBACK.primary),
    series: FALLBACK.series.map((c, i) => get(`--series-${i + 1}`, c)),
    sequential: FALLBACK.sequential.map((c, i) => get(`--seq-${i + 1}`, c)),
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

/** Groups whose levels run from lowest to highest, drawn with the sequential ramp. */
export const ORDERED_GROUPS: readonly string[] = ['age_band', 'poverty', 'family_income', 'education']

export type PaletteKind = 'single' | 'categorical' | 'sequential'

/** Which palette a trend split takes: the primary color alone, the ramp for ordered groups, the categorical slots otherwise. */
export function paletteKind(split: Pick<Group, 'id'> | null | undefined): PaletteKind {
  if (!split) return 'single'
  return ORDERED_GROUPS.includes(split.id) ? 'sequential' : 'categorical'
}

/** One color per series: the primary color, evenly spaced steps of the ramp (light to dark), or the categorical slots. */
export function seriesColors(theme: ChartTheme, count: number, kind: PaletteKind): string[] {
  if (kind === 'single') return Array.from({ length: count }, () => theme.primary)
  if (kind === 'sequential') {
    const ramp = theme.sequential
    const last = ramp.length - 1
    return Array.from({ length: count }, (_, i) => ramp[count === 1 ? last : Math.round((i * last) / (count - 1))])
  }
  return Array.from({ length: count }, (_, i) => theme.series[i % theme.series.length])
}
