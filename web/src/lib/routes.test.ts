import { readCatalog } from '../test/fixtures'
import { explorePath, resolveExplore, resolveTrends, splitGroups, trendsPath } from './routes'

const catalog = readCatalog()
const q = (s: string) => new URLSearchParams(s)

describe('resolveExplore', () => {
  it('accepts a valid cohort and indicator and defaults the rest', () => {
    const { redirect, state } = resolveExplore(catalog, 'teen', 'mde_py', q(''))
    expect(redirect).toBeNull()
    expect(state.cohort).toBe('teen')
    expect(state.indicator.id).toBe('mde_py')
    expect(state.yearSet).toBe('2024')
    expect(state.group).toBeNull()
    expect(state.level).toBeNull()
  })
  it('redirects an invalid cohort to the default cohort and indicator, keeping the query', () => {
    const { redirect } = resolveExplore(catalog, 'adults', 'mde_py', q('year=2023'))
    expect(redirect).toBe('/explore/teen/mde_py?year=2023')
  })
  it('redirects an invalid indicator to the default for that cohort', () => {
    expect(resolveExplore(catalog, 'young_adult', 'nope', q('')).redirect).toBe('/explore/young_adult/mde_py')
    expect(resolveExplore(catalog, 'teen', undefined, q('')).redirect).toBe('/explore/teen/mde_py')
  })
  it('redirects an indicator that exists only in the other cohort', () => {
    expect(resolveExplore(catalog, 'teen', 'spd_py', q('')).redirect).toBe('/explore/teen/mde_py')
  })
  it('keeps a valid year set and falls back to the latest year otherwise', () => {
    expect(resolveExplore(catalog, 'teen', 'mde_py', q('year=all')).state.yearSet).toBe('all')
    expect(resolveExplore(catalog, 'teen', 'mde_py', q('year=2022')).state.yearSet).toBe('2022')
    expect(resolveExplore(catalog, 'teen', 'mde_py', q('year=2019')).state.yearSet).toBe('2024')
    expect(resolveExplore(catalog, 'teen', 'nicotine_vape_py', q('year=2021')).state.yearSet).toBe('2024')
  })
  it('keeps a valid group level', () => {
    const { state } = resolveExplore(catalog, 'teen', 'mde_py', q('group=sex&level=female'))
    expect(state.group?.id).toBe('sex')
    expect(state.level?.id).toBe('female')
  })
  it('drops a group without a valid level, a crosses-only group, and the other cohort\'s age band', () => {
    expect(resolveExplore(catalog, 'teen', 'mde_py', q('group=sex')).state.group).toBeNull()
    expect(resolveExplore(catalog, 'teen', 'mde_py', q('group=sex&level=other')).state.group).toBeNull()
    expect(resolveExplore(catalog, 'teen', 'mde_py', q('group=race_ethnicity_5&level=white')).state.group).toBeNull()
    expect(resolveExplore(catalog, 'teen', 'mde_py', q('group=age_band&level=age_18_20')).state.group).toBeNull()
    expect(resolveExplore(catalog, 'teen', 'mde_py', q('group=education&level=some_college')).state.group).toBeNull()
    expect(resolveExplore(catalog, 'young_adult', 'mde_py', q('group=education&level=some_college')).state.level?.id).toBe('some_college')
  })
})

describe('explorePath and trendsPath', () => {
  it('build the URLs the pages read', () => {
    expect(explorePath('teen', 'mde_py')).toBe('/explore/teen/mde_py')
    expect(explorePath('teen', 'mde_py', { yearSet: '2024', group: 'sex', level: 'female' })).toBe('/explore/teen/mde_py?year=2024&group=sex&level=female')
    expect(explorePath('teen', 'mde_py', { group: 'sex', level: null })).toBe('/explore/teen/mde_py')
    expect(trendsPath('teen', 'suicide_thoughts', { split: 'sex' })).toBe('/trends/teen/suicide_thoughts?split=sex')
    expect(trendsPath('teen', 'mde_py', { split: null, yearA: 2022, yearB: 2024 })).toBe('/trends/teen/mde_py?a=2022&b=2024')
  })
})

describe('resolveTrends', () => {
  it('defaults to the first and latest collected years with no split', () => {
    const { redirect, state } = resolveTrends(catalog, 'teen', 'nicotine_vape_py', q(''))
    expect(redirect).toBeNull()
    expect(state.split).toBeNull()
    expect(state.yearA).toBe(2022)
    expect(state.yearB).toBe(2024)
  })
  it('redirects invalid paths', () => {
    expect(resolveTrends(catalog, 'nope', 'nope', q('split=sex')).redirect).toBe('/trends/teen/mde_py?split=sex')
  })
  it('accepts a split with at most five levels and ignores larger ones', () => {
    expect(resolveTrends(catalog, 'teen', 'mde_py', q('split=sex')).state.split?.id).toBe('sex')
    expect(resolveTrends(catalog, 'teen', 'mde_py', q('split=race_ethnicity')).state.split).toBeNull()
    expect(resolveTrends(catalog, 'teen', 'mde_py', q('split=race_ethnicity_5')).state.split).toBeNull()
  })
  it('accepts valid comparison years and rejects reversed or uncollected ones', () => {
    expect(resolveTrends(catalog, 'teen', 'mde_py', q('a=2022&b=2023')).state).toMatchObject({ yearA: 2022, yearB: 2023 })
    expect(resolveTrends(catalog, 'teen', 'mde_py', q('a=2023&b=2022')).state).toMatchObject({ yearA: 2021, yearB: 2024 })
    expect(resolveTrends(catalog, 'teen', 'nicotine_vape_py', q('a=2021&b=2024')).state).toMatchObject({ yearA: 2022, yearB: 2024 })
  })
})

describe('splitGroups', () => {
  it('offers the small standalone groups for each cohort', () => {
    const teen = splitGroups(catalog, 'teen').map((g) => g.id)
    expect(teen).toEqual(expect.arrayContaining(['sex', 'age_band', 'poverty', 'family_income', 'insurance', 'metro', 'parents_in_home']))
    expect(teen).not.toContain('race_ethnicity')
    expect(teen).not.toContain('education')
    const young = splitGroups(catalog, 'young_adult').map((g) => g.id)
    expect(young).toEqual(expect.arrayContaining(['education', 'employment']))
    expect(young).not.toContain('parents_in_home')
  })
})
