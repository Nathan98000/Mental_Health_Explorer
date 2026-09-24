import { readCatalog } from '../test/fixtures'
import { absoluteUrl, cohortFromLocation, exploreCohortPath, explorePath, resolveExplore, resolveTrends, splitGroups, trendsCohortPath, trendsPath } from './routes'

const catalog = readCatalog()
const q = (s: string) => new URLSearchParams(s)

describe('resolveExplore', () => {
  it('accepts a valid cohort and indicator and defaults the rest, with no notice', () => {
    const { normalized, notices, state } = resolveExplore(catalog, 'teen', 'mde_py', q(''))
    expect(normalized).toBe('/explore/teen/mde_py')
    expect(notices).toEqual([])
    expect(state.cohort).toBe('teen')
    expect(state.indicator.id).toBe('mde_py')
    expect(state.yearSet).toBe('2024')
    expect(state.group).toBeNull()
    expect(state.level).toBeNull()
  })
  it('keeps an explicit year in the canonical URL', () => {
    expect(resolveExplore(catalog, 'teen', 'mde_py', q('year=2023')).normalized).toBe('/explore/teen/mde_py?year=2023')
  })
  it('normalizes an invalid cohort to the default cohort and indicator, keeping the query', () => {
    const { normalized, notices } = resolveExplore(catalog, 'adults', 'mde_py', q('year=2023'))
    expect(normalized).toBe('/explore/teen/mde_py?year=2023')
    expect(notices).toEqual(["We couldn't find that age group; showing teens ages 12–17."])
  })
  it('normalizes an invalid indicator to the default for that cohort', () => {
    const bad = resolveExplore(catalog, 'young_adult', 'nope', q(''))
    expect(bad.normalized).toBe('/explore/young_adult/mde_py')
    expect(bad.notices).toEqual(["We couldn't find that measure; showing Major depressive episode in the past year."])
    const bare = resolveExplore(catalog, 'teen', undefined, q(''))
    expect(bare.normalized).toBe('/explore/teen/mde_py')
    expect(bare.notices).toEqual([])
  })
  it('normalizes an indicator that exists only in the other cohort', () => {
    expect(resolveExplore(catalog, 'teen', 'spd_py', q('')).normalized).toBe('/explore/teen/mde_py')
  })
  it('keeps a valid year set and falls back to the latest year otherwise, saying why', () => {
    expect(resolveExplore(catalog, 'teen', 'mde_py', q('year=all')).state.yearSet).toBe('all')
    expect(resolveExplore(catalog, 'teen', 'mde_py', q('year=2022')).state.yearSet).toBe('2022')
    const unknown = resolveExplore(catalog, 'teen', 'mde_py', q('year=2019'))
    expect(unknown.state.yearSet).toBe('2024')
    expect(unknown.normalized).toBe('/explore/teen/mde_py?year=2024')
    expect(unknown.notices).toEqual(["We couldn't find that year; showing 2024."])
    const notAsked = resolveExplore(catalog, 'teen', 'nicotine_vape_py', q('year=2021'))
    expect(notAsked.state.yearSet).toBe('2024')
    expect(notAsked.notices).toEqual(['Not available in 2021; showing 2024.'])
  })
  it('keeps a valid group level', () => {
    const { normalized, state } = resolveExplore(catalog, 'teen', 'mde_py', q('level=female&group=sex'))
    expect(state.group?.id).toBe('sex')
    expect(state.level?.id).toBe('female')
    expect(normalized).toBe('/explore/teen/mde_py?group=sex&level=female')
  })
  it("drops a group without a valid level, a crosses-only group, and the other cohort's age band", () => {
    const noLevel = resolveExplore(catalog, 'teen', 'mde_py', q('group=sex'))
    expect(noLevel.state.group).toBeNull()
    expect(noLevel.normalized).toBe('/explore/teen/mde_py')
    expect(noLevel.notices).toEqual(["We couldn't find that population; showing everyone."])
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
  it('absoluteUrl prefixes the origin and base path', () => {
    expect(absoluteUrl('/explore/teen/mde_py?year=2024')).toBe(`${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/explore/teen/mde_py?year=2024`)
  })
})

describe('resolveTrends', () => {
  it('defaults to the first and latest collected years with no split', () => {
    const { normalized, notices, state } = resolveTrends(catalog, 'teen', 'nicotine_vape_py', q(''))
    expect(normalized).toBe('/trends/teen/nicotine_vape_py')
    expect(notices).toEqual([])
    expect(state.split).toBeNull()
    expect(state.yearA).toBe(2022)
    expect(state.yearB).toBe(2024)
  })
  it('normalizes invalid paths and says what was replaced', () => {
    const { normalized, notices } = resolveTrends(catalog, 'nope', 'nope', q('split=sex'))
    expect(normalized).toBe('/trends/teen/mde_py?split=sex')
    expect(notices).toEqual(["We couldn't find that age group; showing teens ages 12–17.", "We couldn't find that measure; showing Major depressive episode in the past year."])
  })
  it('accepts a split with at most five levels and drops larger ones from the URL', () => {
    expect(resolveTrends(catalog, 'teen', 'mde_py', q('split=sex')).state.split?.id).toBe('sex')
    const large = resolveTrends(catalog, 'teen', 'mde_py', q('split=race_ethnicity'))
    expect(large.state.split).toBeNull()
    expect(large.normalized).toBe('/trends/teen/mde_py')
    expect(large.notices).toEqual(["We can't split this chart that way; showing all teens."])
    expect(resolveTrends(catalog, 'teen', 'mde_py', q('split=race_ethnicity_5')).state.split).toBeNull()
    expect(resolveTrends(catalog, 'teen', 'mde_py', q('split=')).notices).toEqual([])
  })
  it('accepts valid comparison years and rejects reversed or uncollected ones', () => {
    const ok = resolveTrends(catalog, 'teen', 'mde_py', q('a=2022&b=2023'))
    expect(ok.state).toMatchObject({ yearA: 2022, yearB: 2023 })
    expect(ok.normalized).toBe('/trends/teen/mde_py?a=2022&b=2023')
    const reversed = resolveTrends(catalog, 'teen', 'mde_py', q('a=2023&b=2022'))
    expect(reversed.state).toMatchObject({ yearA: 2021, yearB: 2024 })
    expect(reversed.normalized).toBe('/trends/teen/mde_py?a=2021&b=2024')
    expect(reversed.notices).toEqual(["We couldn't compare those years; showing 2021 to 2024."])
    const notAsked = resolveTrends(catalog, 'teen', 'nicotine_vape_py', q('a=2021&b=2024'))
    expect(notAsked.state).toMatchObject({ yearA: 2022, yearB: 2024 })
    expect(notAsked.notices).toEqual(['Not available in 2021; showing 2022 to 2024.'])
  })
})

describe('cohort switching', () => {
  it('keeps the year set and population when the other cohort has them', () => {
    const female = resolveExplore(catalog, 'teen', 'mde_py', q('year=2023&group=sex&level=female')).state
    expect(exploreCohortPath(catalog, female, 'young_adult')).toBe('/explore/young_adult/mde_py?year=2023&group=sex&level=female')
    const age = resolveExplore(catalog, 'teen', 'mde_py', q('group=age_band&level=age_14_15')).state
    expect(exploreCohortPath(catalog, age, 'young_adult')).toBe('/explore/young_adult/mde_py?year=2024')
    const teenOnly = resolveExplore(catalog, 'teen', 'liked_school', q('year=all')).state
    expect(exploreCohortPath(catalog, teenOnly, 'young_adult')).toBe('/explore/young_adult/mde_py?year=all')
  })
  it('keeps the split and compared years when the other cohort has them', () => {
    const bySex = resolveTrends(catalog, 'teen', 'suicide_thoughts', q('split=sex&a=2022&b=2024')).state
    expect(trendsCohortPath(catalog, bySex, 'young_adult')).toBe('/trends/young_adult/suicide_thoughts?split=sex&a=2022&b=2024')
    const byParents = resolveTrends(catalog, 'teen', 'mde_py', q('split=parents_in_home')).state
    expect(trendsCohortPath(catalog, byParents, 'young_adult')).toBe('/trends/young_adult/mde_py?a=2021&b=2024')
    const shortSeries = resolveTrends(catalog, 'young_adult', 'mh_treatment', q('a=2022&b=2023')).state
    expect(trendsCohortPath(catalog, shortSeries, 'teen')).toBe('/trends/teen/mh_treatment?a=2022&b=2023')
  })
  it('reads the cohort from the path or the overview query', () => {
    expect(cohortFromLocation('/explore/young_adult/mde_py', '')).toBe('young_adult')
    expect(cohortFromLocation('/trends/teen/mde_py', '?split=sex')).toBe('teen')
    expect(cohortFromLocation('/', '?cohort=young_adult')).toBe('young_adult')
    expect(cohortFromLocation('/methods', '')).toBeNull()
    expect(cohortFromLocation('/explore/nope/mde_py', '')).toBeNull()
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
