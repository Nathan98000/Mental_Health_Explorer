/**
 * Typed loader for the pipeline outputs served from public/data/ (copied from ../data by
 * scripts/sync-data.mjs). Shapes follow data/schema/*.schema.json. Every fetch is cached in
 * memory for the life of the page.
 */
import { SURVEY_YEARS, type Catalog } from './catalog'

export type Cohort = 'teen' | 'young_adult'

export type YearSet = { years: number[]; weight: string }

/** Column-wise cells: overall (group null), one-way levels (group2 null) and two-way crosses. */
export type EstimateCells = {
  year_set: string[]
  group: (string | null)[]
  level: (string | null)[]
  group2: (string | null)[]
  level2: (string | null)[]
  p: (number | null)[]
  lo: (number | null)[]
  hi: (number | null)[]
  se: (number | null)[]
  n: number[]
  pop: (number | null)[]
  suppressed: boolean[]
  reason: (string | null)[]
}

export type TrendTests = {
  group: (string | null)[]
  level: (string | null)[]
  year_a: number[]
  year_b: number[]
  diff: (number | null)[]
  se: (number | null)[]
  p_value: (number | null)[]
}

export type GroupTest = {
  year_set: string
  group: string
  levels: string[]
  tested: string[]
  f: number | null
  df: [number, number] | null
  p_value: number | null
  overall_significant: boolean
  vs_overall: { diff: (number | null)[]; p_value: (number | null)[] }
  pairwise_p: (number | null)[][]
}

export type EstimateShard = {
  cohort: Cohort
  indicator: string
  years: number[]
  year_sets: Record<string, YearSet>
  crosses: string[]
  cells: EstimateCells
  trend_tests: TrendTests
  group_tests: GroupTest[]
}

export type Cell = {
  yearSet: string
  group: string | null
  level: string | null
  group2: string | null
  level2: string | null
  p: number | null
  lo: number | null
  hi: number | null
  se: number | null
  n: number
  pop: number | null
  suppressed: boolean
  reason: string | null
}

/** An overall single-year estimate that is not suppressed. */
export type YearEstimate = { year: number; p: number; lo: number; hi: number; se: number; n: number; pop: number }

export type TrendTest = { yearA: number; yearB: number; diff: number; se: number; pValue: number }

export type YearAvailability = { collected: boolean; n_valid: number }
export type Availability = Record<string, Record<string, Record<string, YearAvailability>>>

export type Manifest = {
  generated: string
  pipeline_sha: string | null
  catalog_hash: string
  files: Record<string, { bytes: number; sha256: string }>
}

const cache = new Map<string, Promise<unknown>>()

/** Fetch a JSON file once; a failed fetch is forgotten so it can be retried. */
export function loadJson<T>(url: string): Promise<T> {
  const hit = cache.get(url)
  if (hit) return hit as Promise<T>
  const pending = fetch(url)
    .then(async (response) => {
      if (!response.ok) throw new Error(`Could not load ${url} (${response.status})`)
      return (await response.json()) as T
    })
    .catch((error: unknown) => {
      cache.delete(url)
      throw error
    })
  cache.set(url, pending)
  return pending
}

/** Forget every cached file (tests). */
export function clearCache(): void {
  cache.clear()
}

export function dataUrl(name: string): string {
  return `${import.meta.env.BASE_URL}data/${name}`
}

export function estimatesUrl(cohort: Cohort, indicator: string): string {
  return dataUrl(`estimates/${cohort}/${indicator}.json`)
}

export function loadEstimates(cohort: Cohort, indicator: string): Promise<EstimateShard> {
  return loadJson<EstimateShard>(estimatesUrl(cohort, indicator))
}

export function loadCatalog(): Promise<Catalog> {
  return loadJson<Catalog>(dataUrl('catalog.json'))
}

export function loadAvailability(): Promise<Availability> {
  return loadJson<Availability>(dataUrl('availability.json'))
}

export function loadManifest(): Promise<Manifest> {
  return loadJson<Manifest>(dataUrl('manifest.json'))
}

export function cellAt(shard: EstimateShard, i: number): Cell {
  const c = shard.cells
  return {
    yearSet: c.year_set[i],
    group: c.group[i],
    level: c.level[i],
    group2: c.group2[i],
    level2: c.level2[i],
    p: c.p[i],
    lo: c.lo[i],
    hi: c.hi[i],
    se: c.se[i],
    n: c.n[i],
    pop: c.pop[i],
    suppressed: c.suppressed[i],
    reason: c.reason[i],
  }
}

/** The overall (group null) or one-way cell for a year set, suppressed or not. */
export function findCell(shard: EstimateShard, yearSet: string, group: string | null = null, level: string | null = null): Cell | undefined {
  const c = shard.cells
  for (let i = 0; i < c.p.length; i++) {
    if (c.year_set[i] === yearSet && c.group[i] === group && c.level[i] === level && c.group2[i] === null) return cellAt(shard, i)
  }
  return undefined
}

export type YearPoint = { year: number; cell: Cell }

/** One cell per collected single year, in year order, suppressed ones included. */
export function seriesByYear(shard: EstimateShard, group: string | null = null, level: string | null = null): YearPoint[] {
  const out: YearPoint[] = []
  for (const year of [...shard.years].sort((a, b) => a - b)) {
    const cell = findCell(shard, String(year), group, level)
    if (cell) out.push({ year, cell })
  }
  return out
}

/** Overall estimates for each collected single year, in year order, skipping suppressed ones. */
export function overallByYear(shard: EstimateShard): YearEstimate[] {
  return seriesByYear(shard)
    .filter(({ cell }) => !cell.suppressed)
    .map(({ year, cell }) => ({ year, p: cell.p as number, lo: cell.lo as number, hi: cell.hi as number, se: cell.se as number, n: cell.n, pop: cell.pop as number }))
}

/** The year-vs-year test for the overall series or one level (diff = later minus earlier), or null when not testable. */
export function trendTest(shard: EstimateShard, group: string | null, level: string | null, yearA: number, yearB: number): TrendTest | null {
  const t = shard.trend_tests
  for (let i = 0; i < t.year_a.length; i++) {
    if (t.group[i] === group && t.level[i] === level && t.year_a[i] === yearA && t.year_b[i] === yearB) {
      const diff = t.diff[i]
      const se = t.se[i]
      const pValue = t.p_value[i]
      return diff === null || se === null || pValue === null ? null : { yearA, yearB, diff, se, pValue }
    }
  }
  return null
}

export function overallTrendTest(shard: EstimateShard, yearA: number, yearB: number): TrendTest | null {
  return trendTest(shard, null, null, yearA, yearB)
}

export function groupTest(shard: EstimateShard, yearSet: string, group: string): GroupTest | undefined {
  return shard.group_tests.find((g) => g.year_set === yearSet && g.group === group)
}

export type VsOverall = { overallSignificant: boolean; diff: number | null; pValue: number | null }

/** A level's difference from the overall estimate, to be read only when the group test is significant. */
export function vsOverall(shard: EstimateShard, yearSet: string, group: string, level: string): VsOverall | null {
  const test = groupTest(shard, yearSet, group)
  if (!test) return null
  const i = test.levels.indexOf(level)
  if (i < 0) return null
  return { overallSignificant: test.overall_significant, diff: test.vs_overall.diff[i], pValue: test.vs_overall.p_value[i] }
}

/** Survey years in which an indicator was not collected. */
export function gapYears(collectedYears: readonly number[], allYears: readonly number[] = SURVEY_YEARS): number[] {
  return allYears.filter((y) => !collectedYears.includes(y))
}

/** Collected years for an indicator according to availability.json. */
export function collectedYears(availability: Availability, cohort: Cohort, indicator: string): number[] {
  const years = availability[cohort]?.[indicator] ?? {}
  return Object.entries(years)
    .filter(([, v]) => v.collected)
    .map(([y]) => Number(y))
    .sort((a, b) => a - b)
}
