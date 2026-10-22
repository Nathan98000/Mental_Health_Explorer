import { levelsFor, type Catalog, type Group, type Level } from '../lib/catalog'
import { findCell, vsOverall, type Cell, type Cohort, type EstimateShard } from '../lib/data'
import { formatRange, formatShare } from '../lib/format'
import { vsOverallKind, type VsOverallKind } from '../lib/takeaways'
import { SuppressedValue } from './SuppressedValue'

type Props = {
  catalog: Catalog
  cohort: Cohort
  shard: EstimateShard
  group: Group
  /** The level picked in the filters, drawn bold with a highlighted dot. */
  selected?: Level | null
  yearSet: string
  /** The cohort noun with the measure's denominator clause, e.g. "teens" or "teens who had a major depressive episode in the past year". */
  people: string
}

const KIND_LABEL: Record<VsOverallKind, string> = { higher: 'Higher', lower: 'Lower', similar: 'Similar' }
/** Axis ends in percent; the midpoint of each is a whole number too. */
const NICE_MAX = [2, 4, 6, 8, 10, 12, 16, 20, 24, 30, 40, 50, 60, 80, 100]

function shown(cell: Cell | undefined): cell is Cell & { p: number; lo: number; hi: number } {
  return !!cell && !cell.suppressed && cell.p !== null && cell.lo !== null && cell.hi !== null
}

/**
 * Every level of one group for the chosen years, as a table: the estimate with its 95% interval drawn as a bar and a dot
 * on a scale shared across the table, and whether it differs from everyone (only when both tests say so).
 * The first row is everyone, also drawn as a vertical reference line.
 */
export function GroupDotPlot({ catalog, cohort, shard, group, selected, yearSet, people }: Props) {
  const overall = findCell(shard, yearSet)
  const rows = levelsFor(catalog, cohort, group).map((l) => {
    const cell = findCell(shard, yearSet, group.id, l.id)
    const test = vsOverall(shard, yearSet, group.id, l.id)
    return { level: l, cell, kind: test ? vsOverallKind(test.overallSignificant, test.diff, test.pValue) : null }
  })
  const highs = [...rows.map((r) => (shown(r.cell) ? r.cell.hi : 0)), shown(overall) ? overall.hi : 0]
  const maxPct = NICE_MAX.find((m) => m >= Math.max(...highs) * 100) ?? 100
  const pos = (p: number) => `${Math.min(100, (p * 100 * 100) / maxPct)}%`
  const overallLine = shown(overall) ? <span className="absolute inset-y-0 w-px bg-ink-2" style={{ left: pos(overall.p) }} /> : null
  const td = 'border-b border-line py-2 pr-3 align-middle'

  const visual = (cell: Cell | undefined, strong: boolean) => (
    <td className={`${td} w-[34%] min-w-20`} aria-hidden="true">
      <div className="relative h-6">
        {overallLine}
        {shown(cell) ? (
          <>
            <span className={`absolute top-1/2 h-1 -translate-y-1/2 rounded-full ${strong ? 'bg-data/45' : 'bg-data-context/45'}`} style={{ left: pos(cell.lo), width: `calc(${pos(cell.hi)} - ${pos(cell.lo)})` }} />
            <span
              className={`absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface ${strong ? 'bg-data' : 'bg-data-context'}`}
              style={{ left: pos(cell.p) }}
              data-dot={strong ? 'selected' : ''}
            />
          </>
        ) : null}
      </div>
    </td>
  )

  const estimate = (cell: Cell | undefined) => {
    if (!cell) return <span className="text-muted">Not available</span>
    if (!shown(cell)) return <SuppressedValue reason={cell.reason} />
    return (
      <>
        {formatShare(cell.p)}
        <span className="sr-only"> (95% confidence interval {formatRange(cell.lo, cell.hi)})</span>
      </>
    )
  }

  return (
    <table className="tabular w-full border-collapse text-sm text-ink" data-group={group.id}>
      <caption className="pb-1 text-left font-display text-h3 font-bold text-ink">By {group.label.toLowerCase()}</caption>
      <thead>
        <tr className="text-left align-bottom text-ink-2">
          <th scope="col" className="border-b border-line py-2 pr-3 font-semibold">{group.label}</th>
          <td className="border-b border-line py-2 pr-3" aria-hidden="true">
            <div className="relative h-4 text-xs text-muted">
              <span className="absolute left-0">0%</span>
              <span className="absolute -translate-x-1/2" style={{ left: '50%' }}>{maxPct / 2}%</span>
              <span className="absolute right-0">{maxPct}%</span>
            </div>
          </td>
          <th scope="col" className="border-b border-line py-2 pr-3 font-semibold">Estimate</th>
          <th scope="col" className="border-b border-line py-2 font-semibold">Compared with all {people}</th>
        </tr>
      </thead>
      <tbody>
        <tr data-overall="">
          <th scope="row" className={`${td} text-left font-semibold`}>All {people}</th>
          {visual(overall, false)}
          <td className={`${td} font-semibold`}>{estimate(overall)}</td>
          <td className={`${td} pr-0`} />
        </tr>
        {rows.map((r) => {
          const isSelected = r.level.id === selected?.id
          return (
            <tr key={r.level.id} data-level={r.level.id} data-selected={isSelected ? 'true' : undefined}>
              <th scope="row" className={`${td} text-left ${isSelected ? 'font-bold' : 'font-normal'}`} data-group-label="">
                {r.level.label}
              </th>
              {visual(r.cell, isSelected)}
              <td className={`${td} ${isSelected ? 'font-bold' : ''}`}>{estimate(r.cell)}</td>
              <td className={`${td} pr-0`}>{shown(r.cell) && r.kind ? KIND_LABEL[r.kind] : null}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
