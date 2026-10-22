import { formatCount, formatDate, formatPct, formatRange, formatShare, formatSharePair, oneInN } from './format'

describe('formatPct', () => {
  it('rounds to whole percent by default', () => {
    expect(formatPct(0.1484)).toBe('15%')
  })
  it('supports decimals', () => {
    expect(formatPct(0.1484, 1)).toBe('14.8%')
  })
})

describe('formatShare', () => {
  it('uses whole percents from 10% up and one decimal below', () => {
    expect(formatShare(0.148)).toBe('15%')
    expect(formatShare(0.058)).toBe('5.8%')
    expect(formatShare(0.0999)).toBe('10%')
    expect(formatShare(0.1)).toBe('10%')
  })
  it('gives a pair one decimal when the two would read the same', () => {
    expect(formatSharePair(0.343, 0.338)).toEqual(['34.3%', '33.8%'])
    expect(formatSharePair(0.205, 0.148)).toEqual(['21%', '15%'])
  })
})

describe('formatRange', () => {
  it('formats a confidence interval', () => {
    expect(formatRange(0.1375, 0.1599)).toBe('13.8% to 16.0%')
  })
})

describe('oneInN', () => {
  it('turns a proportion into a plain-language ratio', () => {
    expect(oneInN(0.1484)).toBe('1 in 7')
    expect(oneInN(0.2054)).toBe('1 in 5')
  })
  it('declines for large or invalid values', () => {
    expect(oneInN(0.6)).toBeNull()
    expect(oneInN(0)).toBeNull()
  })
})

describe('formatCount', () => {
  it('adds thousands separators', () => {
    expect(formatCount(10917)).toBe('10,917')
  })
})

describe('formatDate', () => {
  it('writes the month in words and keeps the day in any time zone', () => {
    expect(formatDate('2026-09-23')).toBe('September 23, 2026')
    expect(formatDate('2026-01-01')).toBe('January 1, 2026')
    expect(formatDate('not a date')).toBe('not a date')
  })
})
