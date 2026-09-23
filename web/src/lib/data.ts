/**
 * Typed loader for the pipeline outputs served from public/data/ (copied from ../data by
 * scripts/sync-data.mjs). Shapes follow data/schema/estimates.schema.json.
 */

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

export function estimatesUrl(cohort: Cohort, indicator: string): string {
  return `${import.meta.env.BASE_URL}data/estimates/${cohort}/${indicator}.json`
}

export async function loadEstimates(cohort: Cohort, indicator: string): Promise<EstimateShard> {
  const url = estimatesUrl(cohort, indicator)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Could not load ${url} (${response.status})`)
  return (await response.json()) as EstimateShard
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

/** Overall estimates for each collected single year, in year order, skipping suppressed ones. */
export function overallByYear(shard: EstimateShard): YearEstimate[] {
  const out: YearEstimate[] = []
  const c = shard.cells
  for (let i = 0; i < c.p.length; i++) {
    const year = Number(c.year_set[i])
    if (c.group[i] !== null || !shard.years.includes(year) || c.suppressed[i]) continue
    out.push({ year, p: c.p[i] as number, lo: c.lo[i] as number, hi: c.hi[i] as number, se: c.se[i] as number, n: c.n[i], pop: c.pop[i] as number })
  }
  return out.sort((a, b) => a.year - b.year)
}

/** The overall year-vs-year test (diff = later minus earlier), or null when not testable. */
export function overallTrendTest(shard: EstimateShard, yearA: number, yearB: number): TrendTest | null {
  const t = shard.trend_tests
  for (let i = 0; i < t.year_a.length; i++) {
    if (t.group[i] === null && t.year_a[i] === yearA && t.year_b[i] === yearB) {
      const diff = t.diff[i]
      const se = t.se[i]
      const pValue = t.p_value[i]
      return diff === null || se === null || pValue === null ? null : { yearA, yearB, diff, se, pValue }
    }
  }
  return null
}
