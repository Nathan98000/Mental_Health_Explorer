import { paletteKind, seriesColors, type ChartTheme } from './theme'

const theme: ChartTheme = {
  surface: '#fff',
  ink: '#000',
  ink2: '#111',
  muted: '#222',
  grid: '#333',
  line: '#444',
  primary: '#c2410c',
  series: ['#s1', '#s2', '#s3', '#s4', '#s5'],
  sequential: ['#q1', '#q2', '#q3', '#q4', '#q5'],
}

describe('series palettes', () => {
  it('uses the primary color for the no-split series', () => {
    expect(paletteKind(null)).toBe('single')
    expect(seriesColors(theme, 1, 'single')).toEqual(['#c2410c'])
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
