import { formatCount, formatPct, formatRange, oneInN } from './format'

describe('formatPct', () => {
  it('rounds to whole percent by default', () => {
    expect(formatPct(0.1484)).toBe('15%')
  })
  it('supports decimals', () => {
    expect(formatPct(0.1484, 1)).toBe('14.8%')
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
