import { levelsFor, type Catalog, type Group, type Indicator, type Level } from '../lib/catalog'
import { findCell, type Cell, type Cohort, type EstimateShard } from '../lib/data'
import { formatPct, formatRange } from '../lib/format'
import { truncateLabel } from '../lib/labels'
import { useChartTheme } from '../lib/theme'

type Props = {
  catalog: Catalog
  cohort: Cohort
  shard: EstimateShard
  indicator: Indicator
  group: Group
  level: Level
  yearSet: string
  /** e.g. "2024" or "2021–2024 combined". */
  when: string
  /** Short cohort noun for the reference line, e.g. "teens". */
  people: string
}

// A narrow canvas so the plot, scaled to the card's width, stays legible on phones.
const W = 440
const LABEL_W = 150
const LEFT = LABEL_W + 10
const RIGHT = W - 52
const ROW = 30
const TOP = 30
const AXIS = 24

function value(cell: Cell | undefined): cell is Cell & { p: number; lo: number; hi: number } {
  return !!cell && !cell.suppressed && cell.p !== null && cell.lo !== null && cell.hi !== null
}

/** Every level of the selected group for the chosen year: dots with 95% whiskers, the selected level highlighted, everyone as a reference line. Plain SVG. */
export function GroupDotPlot({ catalog, cohort, shard, indicator, group, level, yearSet, when, people }: Props) {
  const theme = useChartTheme()
  const rows = levelsFor(catalog, cohort, group).map((l) => ({ level: l, cell: findCell(shard, yearSet, group.id, l.id) }))
  const overall = findCell(shard, yearSet)
  const shown = rows.filter((r) => value(r.cell))
  if (!shown.length) return null
  const overallP = value(overall) ? overall.p : null
  const max = Math.max(0.02, ...shown.map((r) => (r.cell as Cell).hi as number), overallP ?? 0) * 1.12
  const x = (p: number) => LEFT + ((RIGHT - LEFT) * p) / max
  const height = TOP + rows.length * ROW + AXIS
  const step = max > 0.4 ? 0.2 : max > 0.2 ? 0.1 : max > 0.1 ? 0.05 : max > 0.04 ? 0.02 : 0.01
  const ticks: number[] = []
  for (let t = 0; t <= max; t += step) ticks.push(Number(t.toFixed(4)))
  const description = rows
    .map((r) => `${r.level.label}: ${value(r.cell) ? `${formatPct(r.cell.p, 1)} (${formatRange(r.cell.lo, r.cell.hi)})` : 'not reported'}`)
    .join('; ')
  return (
    <figure className="m-0 mt-4 rounded-3xl bg-surface p-6 ring-1 ring-line">
      <h2 className="m-0 font-display text-lg font-bold text-ink">Compared with other groups by {group.label.toLowerCase()}</h2>
      <svg viewBox={`0 0 ${W} ${height}`} className="mt-3 h-auto w-full" role="img" aria-label={`${indicator.label} by ${group.label.toLowerCase()}, ${when}. ${description}${overallP !== null ? `. All ${people}: ${formatPct(overallP, 1)}` : ''}`} style={{ fontFamily: 'Inter Variable, system-ui, sans-serif', fontSize: 12 }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={TOP - 6} y2={height - AXIS} stroke={theme.grid} />
            <text x={x(t)} y={height - 6} textAnchor="middle" fill={theme.muted} fontSize={11}>{`${Math.round(t * 100)}%`}</text>
          </g>
        ))}
        {overallP !== null ? (
          <g data-overall={overallP}>
            <line x1={x(overallP)} x2={x(overallP)} y1={TOP - 14} y2={height - AXIS} stroke={theme.ink2} strokeWidth={1.5} />
            <text x={x(overallP)} y={TOP - 18} textAnchor="middle" fill={theme.ink2} fontSize={11} fontWeight={600}>{`All ${people} ${formatPct(overallP, 1)}`}</text>
          </g>
        ) : null}
        {rows.map((r, i) => {
          const cy = TOP + i * ROW + ROW / 2
          const selected = r.level.id === level.id
          const color = selected ? theme.primary : theme.ink2
          return (
            <g key={r.level.id} data-level={r.level.id} data-selected={selected ? 'true' : undefined}>
              <text x={LABEL_W} y={cy} dy="0.35em" textAnchor="end" fill={selected ? theme.ink : theme.ink2} fontWeight={selected ? 700 : 400}>
                <title>{r.level.label}</title>
                {truncateLabel(r.level.label, 22)}
              </text>
              {value(r.cell) ? (
                <>
                  <line x1={x(r.cell.lo)} x2={x(r.cell.hi)} y1={cy} y2={cy} stroke={color} strokeWidth={selected ? 2.5 : 1.5} strokeOpacity={selected ? 1 : 0.7} />
                  <circle cx={x(r.cell.p)} cy={cy} r={selected ? 6 : 4.5} fill={color} stroke={theme.surface} strokeWidth={1.5} />
                  <text x={Math.min(x(r.cell.hi) + 8, W - 4)} y={cy} dy="0.35em" fill={selected ? theme.ink : theme.ink2} fontWeight={selected ? 700 : 400} fontSize={11}>{formatPct(r.cell.p, 1)}</text>
                </>
              ) : (
                <text x={LEFT} y={cy} dy="0.35em" fill={theme.muted} fontSize={11}>Not reported</text>
              )}
            </g>
          )
        })}
      </svg>
      <figcaption className="mt-2 text-sm text-muted">
        Dots are estimates and the lines through them 95% confidence intervals, {when}. The vertical line is all {people}.
      </figcaption>
    </figure>
  )
}
