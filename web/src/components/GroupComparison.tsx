import { Link } from 'react-router'
import { groupsFor, levelsFor, type Catalog, type Group, type Level } from '../lib/catalog'
import { findCell, type Cohort, type EstimateShard } from '../lib/data'
import { niceMaxPct, pooledWouldHelp, reported } from '../lib/groups'
import { GroupDotPlot } from './GroupDotPlot'

type Props = {
  catalog: Catalog
  cohort: Cohort
  shard: EstimateShard
  yearSet: string
  /** e.g. "2024" or "2021–2024 combined". */
  when: string
  /** The cohort noun with the measure's denominator clause. */
  people: string
  group: Group | null
  level: Level | null
  /** Where "Try all years combined" goes. */
  allYearsTo: string
}

/** Groups shown open when everyone is selected; the rest fold under "More groups". */
const OPEN_GROUPS = 3

/**
 * "Compared with other groups": one table per breakdown group on one shared scale. With a level selected its group comes
 * first and the rest fold under "Other groups"; with everyone, the first few groups are open and the rest fold.
 */
export function GroupComparison({ catalog, cohort, shard, yearSet, when, people, group, level, allYearsTo }: Props) {
  const groups = groupsFor(catalog, cohort)
  const cells = [findCell(shard, yearSet), ...groups.flatMap((g) => levelsFor(catalog, cohort, g).map((l) => findCell(shard, yearSet, g.id, l.id)))]
  const maxPct = niceMaxPct(cells.filter(reported).map((c) => c.hi))
  const plot = (g: Group) => (
    <GroupDotPlot key={g.id} catalog={catalog} cohort={cohort} shard={shard} group={g} selected={g.id === group?.id ? level : null} everyone={!level} yearSet={yearSet} people={people} maxPct={maxPct} />
  )
  const grid = 'grid items-start gap-x-8 gap-y-6 lg:grid-cols-2'
  const summary = 'min-h-6 cursor-pointer font-display text-h3 font-bold text-ink'
  const [open, folded] = group ? [[group], groups.filter((g) => g.id !== group.id)] : [groups.slice(0, OPEN_GROUPS), groups.slice(OPEN_GROUPS)]
  return (
    <section className="mt-10 border-t border-line pt-8 sm:mt-12" aria-labelledby="compare-groups">
      <h2 id="compare-groups" className="m-0 font-display text-h2 font-bold text-ink">Compared with other groups · {when}</h2>
      {pooledWouldHelp(catalog, cohort, shard, yearSet) ? (
        <p className="m-0 mt-2 max-w-3xl text-sm text-ink-2">
          Some groups have too few responses in {when}.{' '}
          <Link to={allYearsTo} className="font-semibold text-primary-ink underline">Try all years combined</Link>
        </p>
      ) : null}
      <div className={group ? 'mt-4' : `mt-4 ${grid}`}>{open.map(plot)}</div>
      {folded.length > 0 ? (
        <details className="mt-8">
          <summary className={summary}>{group ? 'Other groups' : `More groups (${folded.length})`}</summary>
          <div className={`mt-4 ${grid}`}>{folded.map(plot)}</div>
        </details>
      ) : null}
    </section>
  )
}
