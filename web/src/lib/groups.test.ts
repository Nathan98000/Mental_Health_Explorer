import { makeShard, readCatalog } from '../test/fixtures'
import { niceMaxPct, pooledWouldHelp } from './groups'

const catalog = readCatalog()

describe('niceMaxPct', () => {
  it('picks the first nice maximum at or above the largest value', () => {
    expect(niceMaxPct([0.031, 0.072])).toBe(8)
    expect(niceMaxPct([0.12])).toBe(12)
    expect(niceMaxPct([0.121, 0.05])).toBe(16)
    expect(niceMaxPct([0.81])).toBe(100)
    expect(niceMaxPct([])).toBe(2)
  })
})

describe('pooledWouldHelp', () => {
  const years = [2021, 2022, 2023, 2024]
  it('is false when the pooled cells are suppressed too', () => {
    const shard = makeShard('teen', 'mde_py', years, [
      { yearSet: '2024', group: 'race_ethnicity', level: 'nhopi', p: null },
      { yearSet: 'all', group: 'race_ethnicity', level: 'nhopi', p: null },
    ])
    expect(pooledWouldHelp(catalog, 'teen', shard, '2024')).toBe(false)
  })
  it('is true when one becomes reported, and never for all years combined', () => {
    const shard = makeShard('teen', 'mde_py', years, [
      { yearSet: '2024', group: 'race_ethnicity', level: 'nhopi', p: null },
      { yearSet: 'all', group: 'race_ethnicity', level: 'nhopi', p: 0.15 },
    ])
    expect(pooledWouldHelp(catalog, 'teen', shard, '2024')).toBe(true)
    expect(pooledWouldHelp(catalog, 'teen', shard, 'all')).toBe(false)
  })
})
