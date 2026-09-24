/** Test fixtures: the real web catalog and small shards in the committed column-wise format. */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Catalog } from '../lib/catalog'
import type { Cohort, EstimateShard, GroupTest } from '../lib/data'

export function readCatalog(): Catalog {
  // Vitest runs from web/, so the committed catalog is one level up.
  return JSON.parse(readFileSync(resolve(process.cwd(), '../data/catalog.json'), 'utf8')) as Catalog
}

export type CellSpec = {
  yearSet: string
  group?: string | null
  level?: string | null
  p: number | null
  lo?: number | null
  hi?: number | null
  n?: number
  pop?: number | null
  reason?: string | null
}

export type TrendSpec = { group?: string | null; level?: string | null; yearA: number; yearB: number; diff: number | null; p: number | null }

export function makeShard(cohort: Cohort, indicator: string, years: number[], cells: CellSpec[], trends: TrendSpec[] = [], groupTests: GroupTest[] = []): EstimateShard {
  const sorted = [...years].sort((a, b) => a - b)
  const yearSets: EstimateShard['year_sets'] = Object.fromEntries(sorted.map((y) => [String(y), { years: [y], weight: 'ANALWT2_C1' }]))
  if (sorted.length > 1) {
    yearSets.all = { years: sorted, weight: `ANALWT2_C${sorted.length}` }
    yearSets.recent2 = { years: sorted.slice(-2), weight: 'ANALWT2_C2' }
  }
  const suppressed = cells.map((c) => c.p === null)
  return {
    cohort,
    indicator,
    years: sorted,
    year_sets: yearSets,
    crosses: Object.keys(yearSets),
    cells: {
      year_set: cells.map((c) => c.yearSet),
      group: cells.map((c) => c.group ?? null),
      level: cells.map((c) => c.level ?? null),
      group2: cells.map(() => null),
      level2: cells.map(() => null),
      p: cells.map((c) => c.p),
      lo: cells.map((c) => (c.p === null ? null : (c.lo ?? c.p - 0.01))),
      hi: cells.map((c) => (c.p === null ? null : (c.hi ?? c.p + 0.01))),
      se: cells.map((c) => (c.p === null ? null : 0.005)),
      n: cells.map((c) => c.n ?? 10000),
      pop: cells.map((c) => (c.p === null ? null : (c.pop ?? Math.round(c.p * 25_000) * 1000))),
      suppressed,
      reason: cells.map((c, i) => (suppressed[i] ? (c.reason ?? 'fewer than 50 respondents') : null)),
    },
    trend_tests: {
      group: trends.map((t) => t.group ?? null),
      level: trends.map((t) => t.level ?? null),
      year_a: trends.map((t) => t.yearA),
      year_b: trends.map((t) => t.yearB),
      diff: trends.map((t) => t.diff),
      se: trends.map((t) => (t.diff === null ? null : 0.008)),
      p_value: trends.map((t) => t.p),
    },
    group_tests: groupTests,
  }
}

/** A four-year teen shard for mde_py with overall and sex cells, matching the committed values. */
export function teenMdeShard(): EstimateShard {
  const overall = [
    { yearSet: '2021', p: 0.20537, lo: 0.19196, hi: 0.21948, n: 10317, pop: 5125000 },
    { yearSet: '2022', p: 0.19322, lo: 0.18, hi: 0.2065, n: 11526, pop: 4782000 },
    { yearSet: '2023', p: 0.17844, lo: 0.166, hi: 0.1912, n: 11068, pop: 4440000 },
    { yearSet: '2024', p: 0.14837, lo: 0.13754, hi: 0.15991, n: 10917, pop: 3720000 },
    { yearSet: 'all', p: 0.18129, lo: 0.175, hi: 0.1875, n: 43828, pop: 4516000 },
    { yearSet: 'recent2', p: 0.16335, lo: 0.155, hi: 0.172, n: 21985, pop: 4080000 },
  ]
  const female = [
    { yearSet: '2021', p: 0.29752, lo: 0.27179, hi: 0.32461, n: 4999, pop: 3593000 },
    { yearSet: '2022', p: 0.28198, n: 5538 },
    { yearSet: '2023', p: 0.27533, n: 5329 },
    { yearSet: '2024', p: 0.21777, lo: 0.20244, hi: 0.23392, n: 5251, pop: 2667000 },
    { yearSet: 'all', p: 0.26797, n: 21117 },
    { yearSet: 'recent2', p: 0.24635, n: 10580 },
  ].map((c) => ({ ...c, group: 'sex', level: 'female' }))
  const male = [
    { yearSet: '2021', p: 0.117, n: 5318 },
    { yearSet: '2022', p: 0.11, n: 5988 },
    { yearSet: '2023', p: 0.088, n: 5739 },
    { yearSet: '2024', p: 0.0821, n: 5666 },
    { yearSet: 'all', p: 0.099, n: 22711 },
    { yearSet: 'recent2', p: 0.085, n: 11405 },
  ].map((c) => ({ ...c, group: 'sex', level: 'male' }))
  // A small race level suppressed in every year set.
  const nhopi = ['2021', '2022', '2023', '2024', 'all', 'recent2'].map((yearSet) => ({ yearSet, group: 'race_ethnicity', level: 'nhopi', p: null, n: 40 }))
  const trends = [
    { yearA: 2021, yearB: 2024, diff: -0.057, p: 0 },
    { yearA: 2021, yearB: 2022, diff: -0.01215, p: 0.19261 },
    { group: 'sex', level: 'female', yearA: 2021, yearB: 2024, diff: -0.07975, p: 0 },
    { group: 'sex', level: 'male', yearA: 2021, yearB: 2024, diff: -0.0349, p: 0.001 },
    { group: 'race_ethnicity', level: 'nhopi', yearA: 2021, yearB: 2024, diff: null, p: null },
  ]
  const groupTests: GroupTest[] = ['2021', '2022', '2023', '2024', 'all', 'recent2'].map((year_set) => ({
    year_set,
    group: 'sex',
    levels: ['male', 'female'],
    tested: ['male', 'female'],
    f: 223.7,
    df: [1, 50],
    p_value: 0,
    overall_significant: true,
    vs_overall: { diff: [-0.06627, 0.06939], p_value: [0, 0] },
    pairwise_p: [
      [null, 0],
      [0, null],
    ],
  }))
  return makeShard('teen', 'mde_py', [2021, 2022, 2023, 2024], [...overall, ...female, ...male, ...nhopi], trends, groupTests)
}

/** A generic four-year shard whose overall series barely moves (not significant). */
export function flatShard(cohort: Cohort, indicator: string, years: number[] = [2021, 2022, 2023, 2024]): EstimateShard {
  const cells = years.map((y, i) => ({ yearSet: String(y), p: 0.1 + i * 0.001 }))
  const first = Math.min(...years)
  const last = Math.max(...years)
  return makeShard(cohort, indicator, years, cells, [{ yearA: first, yearB: last, diff: 0.003, p: 0.6 }])
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/** Stub fetch: `files` maps a path under BASE_URL/data/ (e.g. "catalog.json") to its JSON body. */
export function mockData(files: Record<string, unknown>, onRequest?: (url: string) => void) {
  const prefix = `${import.meta.env.BASE_URL}data/`
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      onRequest?.(url)
      const name = url.startsWith(prefix) ? url.slice(prefix.length) : url
      return name in files ? jsonResponse(files[name]) : jsonResponse({ error: 'not found' }, 404)
    }),
  )
}
