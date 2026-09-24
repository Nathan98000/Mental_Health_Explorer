import * as Plot from '@observablehq/plot'
import { useEffect, useId, useRef, useState } from 'react'
import { formatPct, formatRange } from '../lib/format'
import { useChartTheme } from '../lib/theme'
import { ChartExports } from './ChartExports'
import { ScrollTable } from './ScrollTable'
import { SuppressedValue } from './SuppressedValue'

export type TrendRowStatus = 'ok' | 'not_collected' | 'suppressed'

/** One point per year and series; a null `p` is a gap (the year was not collected or the point is suppressed). */
export type TrendRow = { year: number; series: string; p: number | null; lo: number | null; hi: number | null; status: TrendRowStatus; reason?: string | null }

export type Annotation = { year: number; label: string }

type Props = {
  title: string
  rows: TrendRow[]
  /** Series names in fixed display order; color slots follow this order. */
  series: string[]
  /** Every year on the axis, so years without a value show as gaps. */
  years: readonly number[]
  caption?: string
  /** Numbered dashed rules on the chart, explained under it. */
  annotations?: Annotation[]
  /** Plain notes under the chart (gaps, suppressed points). */
  notes?: string[]
  exports?: { csv: string; filename: string; citation: string }
}

function defined(row: TrendRow): row is TrendRow & { p: number; lo: number; hi: number } {
  return row.p !== null && row.lo !== null && row.hi !== null
}

/**
 * Line chart of weighted estimates over survey years, with a shaded 95% CI band per series,
 * gaps for missing years, a crosshair tooltip, direct end-of-line labels, an HTML legend,
 * numbered annotations and a table view for screen readers and keyboard users.
 */
export function TrendChart({ title, rows, series, years, caption, annotations = [], notes = [], exports }: Props) {
  const plotRef = useRef<HTMLDivElement>(null)
  const theme = useChartTheme()
  const [width, setWidth] = useState(640)
  const [showTable, setShowTable] = useState(false)
  const headingId = useId()
  const notesId = useId()

  useEffect(() => {
    const el = plotRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [showTable])

  useEffect(() => {
    const el = plotRef.current
    if (!el || showTable) return
    const colors = series.map((_, i) => theme.series[i % theme.series.length])
    const shown = rows.filter(defined)
    const yMax = Math.max(0.05, ...shown.map((r) => r.hi)) * 1.15
    const lastPerSeries = series.flatMap((s) => {
      const mine = shown.filter((r) => r.series === s).sort((a, b) => a.year - b.year)
      return mine.length ? [mine[mine.length - 1]] : []
    })
    const marks: Plot.Markish[] = [
      Plot.gridY({ stroke: theme.grid, strokeOpacity: 1, ticks: 5 }),
      Plot.ruleY([0], { stroke: theme.grid, strokeOpacity: 1 }),
      Plot.areaY(rows, { x: 'year', y1: 'lo', y2: 'hi', fill: 'series', fillOpacity: 0.16 }),
      Plot.lineY(rows, { x: 'year', y: 'p', stroke: 'series', strokeWidth: 2 }),
      Plot.dot(shown, { x: 'year', y: 'p', fill: 'series', r: 4, stroke: theme.surface, strokeWidth: 2 }),
      Plot.text(lastPerSeries, {
        x: 'year',
        y: 'p',
        text: (d: TrendRow) => (series.length > 1 ? `${d.series} ${formatPct(d.p as number)}` : formatPct(d.p as number)),
        dx: 10,
        textAnchor: 'start',
        fill: theme.ink,
        fontWeight: 600,
      }),
      Plot.ruleX(shown, Plot.pointerX({ x: 'year', stroke: theme.muted, strokeDasharray: '3 3' })),
      Plot.tip(
        shown,
        Plot.pointerX({
          x: 'year',
          y: 'p',
          fill: theme.surface,
          stroke: theme.grid,
          title: (d: TrendRow) => `${d.series}, ${d.year}\n${formatPct(d.p as number, 1)}  (95% CI ${formatRange(d.lo as number, d.hi as number)})`,
        }),
      ),
    ]
    if (annotations.length) {
      marks.push(
        Plot.ruleX(annotations, { x: 'year', stroke: theme.muted, strokeDasharray: '4 3' }),
        Plot.text(annotations, { x: 'year', y: () => yMax, text: (_: Annotation, i: number) => String(i + 1), dy: 4, dx: 8, fill: theme.ink2, fontWeight: 700 }),
      )
    }
    const longestLabel = Math.max(...lastPerSeries.map((r) => (series.length > 1 ? r.series.length + 5 : 4)), 4)
    const chart = Plot.plot({
      width,
      height: 320,
      marginLeft: 44,
      marginRight: Math.min(220, 16 + longestLabel * 7),
      marginTop: 16,
      marginBottom: 32,
      style: { fontFamily: 'Inter Variable, system-ui, sans-serif', fontSize: '13px', color: theme.ink2, background: 'transparent' },
      ariaLabel: title,
      x: { type: 'point', domain: [...years], tickFormat: (d: number) => String(d), label: null, padding: 0.3 },
      y: { domain: [0, yMax], tickFormat: (d: number) => `${Math.round(d * 100)}%`, label: null, ticks: 5 },
      color: { domain: series, range: colors },
      marks,
    })
    chart.setAttribute('role', 'img')
    // Plot labels each mark's <g>; ARIA prohibits aria-label there, and the svg's own label plus the table view carry the meaning.
    for (const el of chart.querySelectorAll('[aria-label], [aria-description]')) {
      el.removeAttribute('aria-label')
      el.removeAttribute('aria-description')
    }
    el.replaceChildren(chart)
    return () => chart.remove()
  }, [rows, series, years, annotations, theme, width, title, showTable])

  const tableCell = (row: TrendRow | undefined) => {
    if (!row || row.status === 'not_collected') return <span className="text-muted">Not asked</span>
    if (row.status === 'suppressed' || !defined(row)) return <SuppressedValue reason={row.reason ?? null} />
    return `${formatPct(row.p, 1)} (${formatRange(row.lo, row.hi)})`
  }

  return (
    <figure className="m-0" aria-labelledby={headingId} aria-describedby={notes.length || annotations.length ? notesId : undefined}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 id={headingId} className="m-0 font-display text-lg font-bold text-ink">
          {title}
        </h3>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="rounded-full border border-line bg-surface px-3 py-1 text-sm font-medium text-ink-2 hover:bg-surface-tint"
          aria-pressed={showTable}
        >
          {showTable ? 'Show chart' : 'Show table'}
        </button>
      </div>

      <ul className="mt-3 mb-1 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-sm text-ink-2" aria-label="Legend">
        {series.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <svg width="22" height="10" aria-hidden="true">
              <line x1="1" y1="5" x2="21" y2="5" stroke={theme.series[i % theme.series.length]} strokeWidth="2" />
              <circle cx="11" cy="5" r="4" fill={theme.series[i % theme.series.length]} />
            </svg>
            {s}
          </li>
        ))}
      </ul>

      {showTable ? (
        <ScrollTable label={`${title} as a table`}>
          <table className="tabular mt-2 w-full border-collapse text-sm">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr className="text-left text-ink-2">
                <th scope="col" className="border-b border-line py-2 pr-4 font-semibold">Year</th>
                {series.map((s) => (
                  <th key={s} scope="col" className="border-b border-line py-2 pr-4 font-semibold">{s}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {years.map((y) => (
                <tr key={y}>
                  <th scope="row" className="border-b border-line py-2 pr-4 text-left font-medium">{y}</th>
                  {series.map((s) => (
                    <td key={s} className="border-b border-line py-2 pr-4">{tableCell(rows.find((d) => d.year === y && d.series === s))}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
      ) : (
        <div ref={plotRef} className="w-full" />
      )}

      {caption ? <figcaption className="mt-2 text-sm text-muted">{caption}</figcaption> : null}
      {notes.length || annotations.length ? (
        <ol id={notesId} className="mt-2 mb-0 list-none space-y-1 p-0 text-sm text-ink-2">
          {annotations.map((a, i) => (
            <li key={`a${i}`}>
              <strong className="mr-1 font-semibold">{i + 1}</strong> {a.label}
            </li>
          ))}
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ol>
      ) : null}
      {exports ? <ChartExports getSvg={() => plotRef.current?.querySelector('svg') ?? null} csv={exports.csv} filename={exports.filename} citation={exports.citation} /> : null}
    </figure>
  )
}
