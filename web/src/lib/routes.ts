/**
 * URL state for the explorer pages. Every page setting lives in the path or the query string;
 * these pure functions parse it against the catalog and fall back to defaults.
 */
import {
  findGroup,
  findIndicator,
  findLevel,
  firstYear,
  groupsFor,
  indicatorsFor,
  isCohort,
  latestYear,
  levelsFor,
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

/** The cohort and indicator named in a path, or the defaults; `valid` is false when either had to be replaced. */
export function resolveIndicator(catalog: Catalog, cohortParam: string | undefined, indicatorParam: string | undefined): { cohort: Cohort; indicator: Indicator; valid: boolean } {
  const cohort = parseCohort(cohortParam) ?? DEFAULT_COHORT
  const indicator = findIndicator(catalog, cohort, indicatorParam) ?? findIndicator(catalog, cohort, DEFAULT_INDICATOR) ?? indicatorsFor(catalog, cohort)[0]
  return { cohort, indicator, valid: cohort === cohortParam && indicator.id === indicatorParam }
}

export type ExploreState = { cohort: Cohort; indicator: Indicator; yearSet: string; group: Group | null; level: Level | null }
export type TrendsState = { cohort: Cohort; indicator: Indicator; split: Group | null; yearA: number; yearB: number }
export type Resolved<T> = { redirect: string | null; state: T }

function withSearch(path: string, search: URLSearchParams): string {
  const query = search.toString()
  return query ? `${path}?${query}` : path
}

export function resolveExplore(catalog: Catalog, cohortParam: string | undefined, indicatorParam: string | undefined, search: URLSearchParams): Resolved<ExploreState> {
  const { cohort, indicator, valid } = resolveIndicator(catalog, cohortParam, indicatorParam)
  const yearParam = search.get('year')
  const yearSet = yearParam && yearSetsFor(indicator).includes(yearParam) ? yearParam : String(latestYear(indicator))
  const group = findGroup(catalog, cohort, search.get('group')) ?? null
  const level = group ? (findLevel(catalog, cohort, group, search.get('level')) ?? null) : null
  return {
    redirect: valid ? null : withSearch(`/explore/${cohort}/${indicator.id}`, search),
    state: { cohort, indicator, yearSet, group: level ? group : null, level },
  }
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
  const { cohort, indicator, valid } = resolveIndicator(catalog, cohortParam, indicatorParam)
  const split = splitGroups(catalog, cohort).find((g) => g.id === search.get('split')) ?? null
  let yearA = Number(search.get('a'))
  let yearB = Number(search.get('b'))
  if (!indicator.years.includes(yearA) || !indicator.years.includes(yearB) || yearA >= yearB) {
    yearA = firstYear(indicator)
    yearB = latestYear(indicator)
  }
  return { redirect: valid ? null : withSearch(`/trends/${cohort}/${indicator.id}`, search), state: { cohort, indicator, split, yearA, yearB } }
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
