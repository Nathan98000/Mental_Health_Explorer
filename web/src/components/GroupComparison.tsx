import { Link } from 'react-router'
import { groupsFor, levelsFor, type Catalog, type Group, type Level } from '../lib/catalog'
import { findCell, type Cohort, type EstimateShard } from '../lib/data'
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

/** True when any level of the group has a suppressed estimate for the year set. */
function hasSuppressedRow(catalog: Catalog, cohort: Cohort, shard: EstimateShard, group: Group, yearSet: string): boolean {
  return levelsFor(catalog, cohort, group).some((l) => {
    const cell = findCell(shard, yearSet, group.id, l.id)
    return !!cell && (cell.suppressed || cell.p === null)
  })
}

/** "Compared with other groups": one table per breakdown group, the selected group first and the rest folded away. */
export function GroupComparison({ catalog, cohort, shard, yearSet, when, people, group, level, allYearsTo }: Props) {
  const groups = groupsFor(catalog, cohort)
  const plot = (g: Group) => <GroupDotPlot key={g.id} catalog={catalog} cohort={cohort} shard={shard} group={g} selected={g.id === group?.id ? level : null} yearSet={yearSet} people={people} />
  const others = group ? groups.filter((g) => g.id !== group.id) : groups
  const grid = 'grid gap-x-8 gap-y-6 lg:grid-cols-2'
  const anySuppressed = yearSet !== 'all' && groups.some((g) => hasSuppressedRow(catalog, cohort, shard, g, yearSet))
  return (
    <section className="mt-10 border-t border-line pt-8 sm:mt-12" aria-labelledby="compare-groups">
      <h2 id="compare-groups" className="m-0 font-display text-h2 font-bold text-ink">Compared with other groups · {when}</h2>
      {anySuppressed ? (
        <p className="m-0 mt-2 text-sm text-ink-2">
          Some groups have too few responses in {when}.{' '}
          <Link to={allYearsTo} className="font-semibold text-primary-ink underline">Try all years combined</Link>
        </p>
      ) : null}
      {group ? (
        <>
          <div className="mt-4">{plot(group)}</div>
          <details className="mt-8">
            <summary className="cursor-pointer font-display text-h3 font-bold text-ink">Other groups</summary>
            <div className={`mt-4 ${grid}`}>{others.map(plot)}</div>
          </details>
        </>
      ) : (
        <div className={`mt-4 ${grid}`}>{others.map(plot)}</div>
      )}
    </section>
  )
}
