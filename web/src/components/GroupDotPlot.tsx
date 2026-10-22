import { levelsFor, type Catalog, type Group, type Level } from '../lib/catalog'
import { findCell, vsOverall, type Cell, type Cohort, type EstimateShard } from '../lib/data'
import { formatRange, formatShare } from '../lib/format'
import { reported } from '../lib/groups'
import { vsOverallKind, type VsOverallKind } from '../lib/takeaways'
import { SuppressedValue } from './SuppressedValue'

type Props = {
  catalog: Catalog
  cohort: Cohort
  shard: EstimateShard
  group: Group
  /** The level picked in the filters, drawn bold in the data color; the other rows are drawn in the context color. */
  selected?: Level | null
  /** Everyone is selected: every row is drawn in the data color. */
  everyone?: boolean
  yearSet: string
  /** The cohort noun with the measure's denominator clause, e.g. "teens" or "teens who had a major depressive episode in the past year". */
  people: string
  /** The axis maximum in percent, shared by every table on the page. */
  maxPct: number
}

const KIND_LABEL: Record<VsOverallKind, string> = { higher: 'Higher', lower: 'Lower', similar: 'Similar' }

/**
 * Every level of one group for the chosen years, as a table: the estimate with its 95% interval drawn as a bar and a dot
 * on the shared scale, and whether it differs from everyone (only when both tests say so).
 * The first row is everyone, also drawn as a vertical reference line. On phones the bar sits under the row label.
 */
export function GroupDotPlot({ catalog, cohort, shard, group, selected, everyone = false, yearSet, people, maxPct }: Props) {
  const overall = findCell(shard, yearSet)
  const rows = levelsFor(catalog, cohort, group).map((l) => {
    const cell = findCell(shard, yearSet, group.id, l.id)
    const test = vsOverall(shard, yearSet, group.id, l.id)
    return { level: l, cell, kind: test ? vsOverallKind(test.overallSignificant, test.diff, test.pValue) : null }
  })
  const pos = (p: number) => `${Math.min(100, (p * 100 * 100) / maxPct)}%`
  const overallLine = reported(overall) ? <span className="absolute inset-y-0 w-px bg-ink-2" style={{ left: pos(overall.p) }} /> : null
  const td = 'border-b border-line py-2 pr-3 align-middle'
  const headingId = `compare-${group.id}`

  const bar = (cell: Cell | undefined, strong: boolean, className: string) => (
    <div className={`relative ${className}`} aria-hidden="true">
      {overallLine}
      {reported(cell) ? (
        <>
          <span className={`absolute top-1/2 h-1 -translate-y-1/2 rounded-full ${strong ? 'bg-data-soft' : 'bg-data-context'}`} style={{ left: pos(cell.lo), width: `calc(${pos(cell.hi)} - ${pos(cell.lo)})` }} />
          <span
            className={`absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface ${strong ? 'bg-data' : 'bg-data-context'}`}
            style={{ left: pos(cell.p) }}
            data-dot={strong ? 'selected' : ''}
          />
        </>
      ) : null}
    </div>
  )
  const visual = (cell: Cell | undefined, strong: boolean) => (
    <td className={`${td} hidden w-[30%] min-w-20 sm:table-cell`} aria-hidden="true">
      {bar(cell, strong, 'h-6')}
    </td>
  )
  const axis = (className: string) => (
    <div className={`relative h-4 text-xs font-normal text-muted ${className}`} aria-hidden="true" data-axis-max={maxPct}>
      <span className="absolute left-0">0%</span>
      <span className="absolute -translate-x-1/2" style={{ left: '50%' }}>{maxPct / 2}%</span>
      <span className="absolute right-0">{maxPct}%</span>
    </div>
  )

  const estimate = (cell: Cell | undefined) => {
    if (!cell) return <span className="text-muted">Not available</span>
    if (!reported(cell)) return <SuppressedValue reason={cell.reason} />
    return (
      <>
        {formatShare(cell.p)}
        <span className="sr-only"> (95% confidence interval {formatRange(cell.lo, cell.hi)})</span>
      </>
    )
  }

  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className="m-0 pb-1 font-display text-h3 font-bold text-ink">By {group.label.toLowerCase()}</h3>
      <table className="tabular w-full border-collapse text-sm text-ink" data-group={group.id} aria-labelledby={headingId}>
        <thead>
          <tr className="text-left align-bottom text-ink-2">
            <th scope="col" className="w-1/2 border-b border-line py-2 pr-3 font-semibold sm:w-auto">
              {group.label}
              {axis('mt-1 sm:hidden')}
            </th>
            <td className="hidden border-b border-line py-2 pr-3 sm:table-cell" aria-hidden="true">
              {axis('')}
            </td>
            <th scope="col" className="border-b border-line py-2 pr-3 font-semibold">Estimate</th>
            <th scope="col" className="border-b border-line py-2 font-semibold">Compared with all {people}</th>
          </tr>
        </thead>
        <tbody>
          <tr data-overall="">
            <th scope="row" className={`${td} text-left font-semibold`}>
              All {people}
              {bar(overall, everyone, 'mt-1 h-3 sm:hidden')}
            </th>
            {visual(overall, everyone)}
            <td className={`${td} font-semibold`}>{estimate(overall)}</td>
            <td className={`${td} pr-0`} />
          </tr>
          {rows.map((r) => {
            const isSelected = r.level.id === selected?.id
            const strong = everyone || isSelected
            return (
              <tr key={r.level.id} data-level={r.level.id} data-selected={isSelected ? 'true' : undefined}>
                <th scope="row" className={`${td} text-left ${isSelected ? 'font-bold' : 'font-normal'}`} data-group-label="">
                  {r.level.label}
                  {bar(r.cell, strong, 'mt-1 h-3 sm:hidden')}
                </th>
                {visual(r.cell, strong)}
                <td className={`${td} ${isSelected ? 'font-bold' : ''}`}>{estimate(r.cell)}</td>
                <td className={`${td} pr-0`}>{reported(r.cell) && r.kind ? KIND_LABEL[r.kind] : null}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
