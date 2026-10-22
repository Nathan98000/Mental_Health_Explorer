import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { paletteKind, seriesColors, type ChartTheme } from './theme'

const theme: ChartTheme = {
  surface: '#fff',
  ink: '#000',
  ink2: '#111',
  muted: '#222',
  grid: '#333',
  line: '#444',
  primary: '#c2410c',
  data: '#0e6e6d',
  dataContext: '#8a8fa8',
  series: ['#s1', '#s2', '#s3', '#s4', '#s5'],
  sequential: ['#q1', '#q2', '#q3', '#q4', '#q5'],
}

describe('series palettes', () => {
  it('uses the data color for the no-split series', () => {
    expect(paletteKind(null)).toBe('single')
    expect(seriesColors(theme, 1, 'single')).toEqual(['#0e6e6d'])
  })
  it('uses evenly spaced steps of the single-hue ramp for ordered groups', () => {
    expect(paletteKind({ id: 'age_band' })).toBe('sequential')
    expect(paletteKind({ id: 'family_income' })).toBe('sequential')
    expect(seriesColors(theme, 3, 'sequential')).toEqual(['#q1', '#q3', '#q5'])
    expect(seriesColors(theme, 4, 'sequential')).toEqual(['#q1', '#q2', '#q4', '#q5'])
    expect(seriesColors(theme, 5, 'sequential')).toEqual(['#q1', '#q2', '#q3', '#q4', '#q5'])
  })
  it('uses the categorical slots otherwise', () => {
    expect(paletteKind({ id: 'sex' })).toBe('categorical')
    expect(seriesColors(theme, 2, 'categorical')).toEqual(['#s1', '#s2'])
  })
})

/** WCAG relative luminance of a #rrggbb color. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('color roles', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')
  const token = (name: string) => new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(css)?.[1] as string
  it('draws data in teal with enough contrast for text on the card surface', () => {
    expect(token('data')).toBe('#0e6e6d')
    expect(contrast(token('data'), token('surface'))).toBeGreaterThanOrEqual(4.5)
  })
  it('keeps the context color visible as a graphic on the card surface', () => {
    expect(contrast(token('data-context'), token('surface'))).toBeGreaterThanOrEqual(3)
  })
})
