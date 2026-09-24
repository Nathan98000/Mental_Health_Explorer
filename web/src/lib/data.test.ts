import { flatShard, jsonResponse, teenMdeShard } from '../test/fixtures'
import { clearCache, collectedYears, findCell, gapYears, loadJson, overallByYear, seriesByYear, trendTest, vsOverall } from './data'

const shard = teenMdeShard()

afterEach(() => {
  vi.unstubAllGlobals()
  clearCache()
})

describe('findCell', () => {
  it('finds overall and one-way cells by year set', () => {
    expect(findCell(shard, '2024')?.p).toBe(0.14837)
    expect(findCell(shard, 'all')?.n).toBe(43828)
    expect(findCell(shard, '2024', 'sex', 'female')).toMatchObject({ p: 0.21777, n: 5251, pop: 2667000, suppressed: false })
  })
  it('returns the suppressed cell with its reason', () => {
    expect(findCell(shard, '2024', 'race_ethnicity', 'nhopi')).toMatchObject({ p: null, suppressed: true, reason: 'fewer than 50 respondents' })
  })
  it('is undefined for a year set or level that is not in the shard', () => {
    expect(findCell(shard, '2020')).toBeUndefined()
    expect(findCell(shard, '2024', 'sex', 'other')).toBeUndefined()
  })
})

describe('series and gaps', () => {
  it('lists every collected year including suppressed ones', () => {
    expect(seriesByYear(shard, 'race_ethnicity', 'nhopi').map((d) => [d.year, d.cell.suppressed])).toEqual([[2021, true], [2022, true], [2023, true], [2024, true]])
    expect(overallByYear(shard).map((d) => d.year)).toEqual([2021, 2022, 2023, 2024])
  })
  it('skips suppressed points in overallByYear', () => {
    const partial = flatShard('teen', 'x', [2022, 2023, 2024])
    partial.cells.suppressed[1] = true
    partial.cells.p[1] = null
    expect(overallByYear(partial).map((d) => d.year)).toEqual([2022, 2024])
  })
  it('names the survey years an indicator was not asked in', () => {
    expect(gapYears([2022, 2023, 2024])).toEqual([2021])
    expect(gapYears([2021, 2022, 2023, 2024])).toEqual([])
    expect(gapYears([2022, 2023])).toEqual([2021, 2024])
  })
  it('reads collected years from availability.json', () => {
    const availability = { teen: { nicotine_vape_py: { '2021': { collected: false, n_valid: 0 }, '2022': { collected: true, n_valid: 11969 }, '2023': { collected: true, n_valid: 11572 }, '2024': { collected: true, n_valid: 11334 } } } }
    expect(collectedYears(availability, 'teen', 'nicotine_vape_py')).toEqual([2022, 2023, 2024])
    expect(collectedYears(availability, 'teen', 'missing')).toEqual([])
  })
})

describe('tests', () => {
  it('finds trend tests for the overall series and for a level', () => {
    expect(trendTest(shard, null, null, 2021, 2024)).toMatchObject({ diff: -0.057, pValue: 0 })
    expect(trendTest(shard, 'sex', 'female', 2021, 2024)).toMatchObject({ diff: -0.07975 })
    expect(trendTest(shard, 'race_ethnicity', 'nhopi', 2021, 2024)).toBeNull()
    expect(trendTest(shard, null, null, 2022, 2024)).toBeNull()
  })
  it('reads a level\'s comparison with everyone by its position in the group test', () => {
    expect(vsOverall(shard, '2024', 'sex', 'female')).toEqual({ overallSignificant: true, diff: 0.06939, pValue: 0 })
    expect(vsOverall(shard, '2024', 'sex', 'male')?.diff).toBe(-0.06627)
    expect(vsOverall(shard, '2024', 'sex', 'other')).toBeNull()
    expect(vsOverall(shard, '2024', 'metro', 'nonmetro')).toBeNull()
  })
})

describe('loadJson cache', () => {
  it('fetches each file once and keeps it in memory', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(loadJson('/a.json')).resolves.toEqual({ ok: true })
    await expect(loadJson('/a.json')).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('forgets a failed fetch so it can be retried', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ error: 1 }, 500)).mockResolvedValueOnce(jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(loadJson('/b.json')).rejects.toThrow(/500/)
    await expect(loadJson('/b.json')).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
