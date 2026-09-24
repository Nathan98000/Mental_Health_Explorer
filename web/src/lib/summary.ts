/** Assemble the explorer's estimate card from a shard and the URL state (pure; see takeaways.ts for wording). */
import { cohortInfo, firstYear, populationPhrase, withUniverse, yearSetWhen, type Catalog } from './catalog'
import { findCell, trendTest, vsOverall, type Cell, type EstimateShard } from './data'
import type { ExploreState } from './routes'
import { takeaway, type ChangeInput, type VsOverallInput } from './takeaways'

export type ExploreSummary = { cell: Cell | undefined; population: string; when: string; sentences: string[] }

export function exploreSummary(catalog: Catalog, shard: EstimateShard, state: ExploreState): ExploreSummary {
  const { cohort, indicator, yearSet, group, level } = state
  const population = withUniverse(populationPhrase(catalog, cohort, group, level), indicator)
  const when = yearSetWhen(yearSet, indicator.years)
  const g = group?.id ?? null
  const l = level?.id ?? null
  const cell = findCell(shard, yearSet, g, l)
  if (!cell) return { cell, population, when, sentences: [] }
  if (cell.suppressed || cell.p === null) return { cell, population, when, sentences: takeaway({ suppressed: true, level: null }) }

  let change: ChangeInput | null = null
  const year = Number(yearSet)
  const first = firstYear(indicator)
  if (indicator.years.includes(year) && year !== first) {
    const prior = findCell(shard, String(first), g, l)
    if (prior && !prior.suppressed && prior.p !== null) {
      const test = trendTest(shard, g, l, first, year)
      change = { priorP: prior.p, priorYear: first, diff: test?.diff ?? null, pValue: test?.pValue ?? null }
    }
  }

  let vs: VsOverallInput | null = null
  if (group && level) {
    const overall = findCell(shard, yearSet)
    const test = vsOverall(shard, yearSet, group.id, level.id)
    if (overall && !overall.suppressed && overall.p !== null && test) {
      vs = { overallP: overall.p, people: withUniverse(cohortInfo(catalog, cohort).people, indicator), overallSignificant: test.overallSignificant, diff: test.diff, pValue: test.pValue }
    }
  }

  const sentences = takeaway({ suppressed: false, level: { p: cell.p, lo: cell.lo, hi: cell.hi, population, phrase: indicator.phrase, when }, change, vsOverall: vs })
  return { cell, population, when, sentences }
}
