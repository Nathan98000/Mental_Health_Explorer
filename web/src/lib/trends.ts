/** Rows, notes and comparisons for the trends page (pure). */
import type { Annotation, TrendRow } from '../components/TrendChart'
import { cohortInfo, levelsFor, populationPhrase, SURVEY_YEARS, type Catalog } from './catalog'
import { findCell, gapYears, trendTest, type Cell, type EstimateShard, type TrendTest } from './data'
import type { CsvRow } from './exports'
import type { TrendsState } from './routes'
import { changeKind, type ChangeKind } from './takeaways'

export type TrendSeries = { label: string; group: string | null; level: string | null; population: string }

export type TrendData = { series: string[]; rows: TrendRow[]; csv: CsvRow[]; notes: string[]; annotations: Annotation[] }

export function trendSeries(catalog: Catalog, state: TrendsState): TrendSeries[] {
  const { cohort, split } = state
  const info = cohortInfo(catalog, cohort)
  if (!split) return [{ label: `All ${info.people}`, group: null, level: null, population: info.phrase }]
  return levelsFor(catalog, cohort, split).map((level) => ({ label: level.label, group: split.id, level: level.id, population: populationPhrase(catalog, cohort, split, level) }))
}

const YEAR_IN_TEXT = /\b(20\d\d)\b/

function joinYears(years: number[]): string {
  return years.length <= 1 ? String(years[0]) : `${years.slice(0, -1).join(', ')} and ${years[years.length - 1]}`
}

export function trendData(catalog: Catalog, shard: EstimateShard, state: TrendsState): TrendData {
  const { cohort, indicator } = state
  const series = trendSeries(catalog, state)
  const rows: TrendRow[] = []
  const csv: CsvRow[] = []
  const suppressedBy = new Map<string, number[]>()
  for (const s of series) {
    for (const year of SURVEY_YEARS) {
      const cell = indicator.years.includes(year) ? findCell(shard, String(year), s.group, s.level) : undefined
      if (!cell) {
        rows.push({ year, series: s.label, p: null, lo: null, hi: null, status: 'not_collected' })
        continue
      }
      const suppressed = cell.suppressed || cell.p === null
      rows.push({ year, series: s.label, p: suppressed ? null : cell.p, lo: suppressed ? null : cell.lo, hi: suppressed ? null : cell.hi, status: suppressed ? 'suppressed' : 'ok', reason: cell.reason })
      if (suppressed) suppressedBy.set(s.label, [...(suppressedBy.get(s.label) ?? []), year])
      csv.push({
        cohort,
        indicator: indicator.id,
        yearSet: String(year),
        weight: shard.year_sets[String(year)]?.weight ?? '',
        population: s.population,
        p: cell.p,
        lo: cell.lo,
        hi: cell.hi,
        n: cell.n,
        suppressed: cell.suppressed,
      })
    }
  }
  const notes: string[] = []
  const gaps = gapYears(indicator.years)
  if (gaps.length) notes.push(`Not asked in ${joinYears(gaps)}.`)
  for (const [label, years] of suppressedBy) notes.push(`${label}: not shown for ${joinYears(years)} because there were not enough responses to report it reliably.`)
  const annotations: Annotation[] = []
  for (const caveat of indicator.caveats) {
    const year = Number(YEAR_IN_TEXT.exec(caveat)?.[1])
    if (SURVEY_YEARS.includes(year) && indicator.years.includes(year) && !gaps.length) annotations.push({ year, label: caveat })
    else notes.push(caveat)
  }
  return { series: series.map((s) => s.label), rows, csv, notes, annotations }
}

export type Comparison = { label: string; a: Cell | undefined; b: Cell | undefined; test: TrendTest | null; kind: ChangeKind | null }

/** Year A vs. year B for every series, from the shard's trend tests. */
export function comparisons(catalog: Catalog, shard: EstimateShard, state: TrendsState): Comparison[] {
  return trendSeries(catalog, state).map((s) => {
    const a = findCell(shard, String(state.yearA), s.group, s.level)
    const b = findCell(shard, String(state.yearB), s.group, s.level)
    const test = trendTest(shard, s.group, s.level, state.yearA, state.yearB)
    return { label: s.label, a, b, test, kind: test ? changeKind(test.diff, test.pValue) : null }
  })
}
