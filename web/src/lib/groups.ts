import { groupsFor, levelsFor, type Catalog } from './catalog'
import { findCell, type Cell, type Cohort, type EstimateShard } from './data'

/** Axis ends in percent; the midpoint of each is a whole number too. */
const NICE_MAX = [2, 4, 6, 8, 10, 12, 16, 20, 24, 30, 40, 50, 60, 80, 100]

/** A cell with an estimate and interval to draw. */
export function reported(cell: Cell | undefined): cell is Cell & { p: number; lo: number; hi: number } {
  return !!cell && !cell.suppressed && cell.p !== null && cell.lo !== null && cell.hi !== null
}

/** The first nice axis maximum, in percent, at or above the largest upper bound (given as shares). */
export function niceMaxPct(highs: number[]): number {
  const top = Math.max(0, ...highs) * 100
  return NICE_MAX.find((m) => m >= top - 1e-9) ?? 100
}

/** True when some level is suppressed for a single-year set but reported with all years combined. */
export function pooledWouldHelp(catalog: Catalog, cohort: Cohort, shard: EstimateShard, yearSet: string): boolean {
  if (yearSet === 'all') return false
  return groupsFor(catalog, cohort).some((g) =>
    levelsFor(catalog, cohort, g).some((l) => {
      const cell = findCell(shard, yearSet, g.id, l.id)
      return !!cell && (cell.suppressed || cell.p === null) && reported(findCell(shard, 'all', g.id, l.id))
    }),
  )
}
