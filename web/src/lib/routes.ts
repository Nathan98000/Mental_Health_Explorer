/**
 * URL state for the explorer pages. Every page setting lives in the path or the query string;
 * these pure functions parse it against the catalog, fall back to defaults, give the canonical
 * URL for the resolved state (the pages replace the address bar with it) and say in plain words
 * what each fallback was (shown as one-line notices).
 */
import {
  cohortInfo,
  findGroup,
  findIndicator,
  findLevel,
  firstYear,
  groupsFor,
  indicatorsFor,
  isCohort,
  latestYear,
  levelsFor,
  SURVEY_YEARS,
  yearSetsFor,
  type Catalog,
  type Group,
  type Indicator,
  type Level,
} from './catalog'
import type { Cohort } from './data'

export const DEFAULT_COHORT: Cohort = 'teen'
export const DEFAULT_INDICATOR = 'mde_py'
/** Trends can be split by groups with at most this many levels (the 5-slot chart palette). */
export const MAX_SPLIT_LEVELS = 5

export function parseCohort(value: string | null | undefined): Cohort | null {
  return isCohort(value) ? value : null
}

function defaultIndicator(catalog: Catalog, cohort: Cohort, id: string | undefined): Indicator {
  return findIndicator(catalog, cohort, id) ?? findIndicator(catalog, cohort, DEFAULT_INDICATOR) ?? indicatorsFor(catalog, cohort)[0]
}

/** The cohort and indicator named in a path, or the defaults, with a notice for every named value that had to be replaced. */
export function resolveIndicator(catalog: Catalog, cohortParam: string | undefined, indicatorParam: string | undefined): { cohort: Cohort; indicator: Indicator; notices: string[] } {
  const cohort = parseCohort(cohortParam) ?? DEFAULT_COHORT
  const indicator = defaultIndicator(catalog, cohort, indicatorParam)
  const notices: string[] = []
  if (cohortParam !== undefined && cohortParam !== cohort) notices.push(`We couldn't find that age group; showing ${cohortInfo(catalog, cohort).phrase}.`)
  if (indicatorParam !== undefined && indicatorParam !== indicator.id) notices.push(`We couldn't find that measure; showing ${indicator.label}.`)
  return { cohort, indicator, notices }
}

export type ExploreState = { cohort: Cohort; indicator: Indicator; yearSet: string; group: Group | null; level: Level | null }
export type TrendsState = { cohort: Cohort; indicator: Indicator; split: Group | null; yearA: number; yearB: number }
/** `normalized` is the canonical URL of `state`; when the address bar differs the page replaces it and shows `notices`. */
export type Resolved<T> = { normalized: string; notices: string[]; state: T }

function withSearch(path: string, search: URLSearchParams): string {
  const query = search.toString()
  return query ? `${path}?${query}` : path
}

/** "Not available in 2021; showing 2024." when a requested year is not in the file for this measure, otherwise the generic fallback. */
function yearNotice(indicator: Indicator, requested: string[], fallback: string, showing: string): string {
  const missing = requested.map(Number).filter((y) => SURVEY_YEARS.includes(y) && !indicator.years.includes(y))
  return missing.length ? `Not available in ${missing.join(' and ')}; showing ${showing}.` : `${fallback}; showing ${showing}.`
}

export function resolveExplore(catalog: Catalog, cohortParam: string | undefined, indicatorParam: string | undefined, search: URLSearchParams): Resolved<ExploreState> {
  const { cohort, indicator, notices } = resolveIndicator(catalog, cohortParam, indicatorParam)
  const yearParam = search.get('year')
  const validYear = yearParam !== null && yearSetsFor(indicator).includes(yearParam)
  const yearSet = validYear ? yearParam : String(latestYear(indicator))
  if (yearParam !== null && !validYear) notices.push(yearNotice(indicator, [yearParam], "We couldn't find that year", yearSet))
  const groupParam = search.get('group')
  const group = findGroup(catalog, cohort, groupParam) ?? null
  const level = group ? (findLevel(catalog, cohort, group, search.get('level')) ?? null) : null
  if (groupParam !== null && !level) notices.push("We couldn't find that population; showing everyone.")
  const state: ExploreState = { cohort, indicator, yearSet, group: level ? group : null, level }
  const normalized = explorePath(cohort, indicator.id, { yearSet: yearParam !== null ? yearSet : undefined, group: state.group?.id, level: level?.id })
  return { normalized, notices, state }
}

export function explorePath(cohort: Cohort, indicator: string, options: { yearSet?: string; group?: string | null; level?: string | null } = {}): string {
  const search = new URLSearchParams()
  if (options.yearSet) search.set('year', options.yearSet)
  if (options.group && options.level) {
    search.set('group', options.group)
    search.set('level', options.level)
  }
  return withSearch(`/explore/${cohort}/${indicator}`, search)
}

/** Groups a trend chart can be split by: standalone groups with few enough levels for the cohort. */
export function splitGroups(catalog: Catalog, cohort: Cohort): Group[] {
  return groupsFor(catalog, cohort).filter((g) => levelsFor(catalog, cohort, g).length <= MAX_SPLIT_LEVELS)
}

export function resolveTrends(catalog: Catalog, cohortParam: string | undefined, indicatorParam: string | undefined, search: URLSearchParams): Resolved<TrendsState> {
  const { cohort, indicator, notices } = resolveIndicator(catalog, cohortParam, indicatorParam)
  const splitParam = search.get('split')
  const split = splitGroups(catalog, cohort).find((g) => g.id === splitParam) ?? null
  if (splitParam && !split) notices.push(`We can't split this chart that way; showing all ${cohortInfo(catalog, cohort).people}.`)
  const aParam = search.get('a')
  const bParam = search.get('b')
  let yearA = Number(aParam)
  let yearB = Number(bParam)
  const validYears = indicator.years.includes(yearA) && indicator.years.includes(yearB) && yearA < yearB
  if (!validYears) {
    yearA = firstYear(indicator)
    yearB = latestYear(indicator)
  }
  const asked = aParam !== null || bParam !== null
  if (asked && !validYears) notices.push(yearNotice(indicator, [aParam, bParam].filter((v): v is string => v !== null), "We couldn't compare those years", `${yearA} to ${yearB}`))
  const state: TrendsState = { cohort, indicator, split, yearA, yearB }
  const normalized = trendsPath(cohort, indicator.id, { split: split?.id ?? null, ...(asked ? { yearA, yearB } : {}) })
  return { normalized, notices, state }
}

export function trendsPath(cohort: Cohort, indicator: string, options: { split?: string | null; yearA?: number; yearB?: number } = {}): string {
  const search = new URLSearchParams()
  if (options.split) search.set('split', options.split)
  if (options.yearA !== undefined && options.yearB !== undefined) {
    search.set('a', String(options.yearA))
    search.set('b', String(options.yearB))
  }
  return withSearch(`/trends/${cohort}/${indicator}`, search)
}

/** The explorer URL for another cohort: the same measure, year set and population wherever that cohort has them too. */
export function exploreCohortPath(catalog: Catalog, state: ExploreState, cohort: Cohort): string {
  const indicator = defaultIndicator(catalog, cohort, state.indicator.id)
  const yearSet = yearSetsFor(indicator).includes(state.yearSet) ? state.yearSet : undefined
  const group = state.group ? findGroup(catalog, cohort, state.group.id) : undefined
  const level = group && state.level ? findLevel(catalog, cohort, group, state.level.id) : undefined
  return explorePath(cohort, indicator.id, { yearSet, group: level ? group?.id : null, level: level?.id })
}

/** The trends URL for another cohort: the same measure, split and compared years wherever that cohort has them too. */
export function trendsCohortPath(catalog: Catalog, state: TrendsState, cohort: Cohort): string {
  const indicator = defaultIndicator(catalog, cohort, state.indicator.id)
  const split = state.split && splitGroups(catalog, cohort).some((g) => g.id === state.split?.id) ? state.split.id : null
  const years = indicator.years.includes(state.yearA) && indicator.years.includes(state.yearB) ? { yearA: state.yearA, yearB: state.yearB } : {}
  return trendsPath(cohort, indicator.id, { split, ...years })
}

/** The cohort a location is about: the /explore or /trends path segment, or ?cohort= on the overview. */
export function cohortFromLocation(pathname: string, search: string): Cohort | null {
  const inPath = /^\/(?:explore|trends)\/([^/?]+)/.exec(pathname)
  return inPath ? parseCohort(inPath[1]) : parseCohort(new URLSearchParams(search).get('cohort'))
}

/** The absolute URL of a site path (origin + base path), for citations. */
export function absoluteUrl(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  return `${origin}${base}${path}`
}
