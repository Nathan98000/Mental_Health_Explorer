import * as Plot from '@observablehq/plot'
import { useEffect, useId, useRef, useState } from 'react'
import { formatPct, formatRange } from '../lib/format'
import { useChartTheme } from '../lib/theme'

export type TrendRow = { year: number; series: string; p: number; lo: number; hi: number }

type Props = {
  title: string
  rows: TrendRow[]
  /** Series names in fixed display order; color slots follow this order. */
  series: string[]
  caption?: string
}

/**
 * Line chart of weighted estimates over survey years, with a shaded 95% CI band
 * per series, a crosshair tooltip, end-of-line value labels, an HTML legend and
 * a table view for screen readers and keyboard users.
 */
export function TrendChart({ title, rows, series, caption }: Props) {
  const plotRef = useRef<HTMLDivElement>(null)
  const theme = useChartTheme()
  const [width, setWidth] = useState(640)
  const [showTable, setShowTable] = useState(false)
  const headingId = useId()

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
    const years = [...new Set(rows.map((r) => r.year))].sort((a, b) => a - b)
    const lastYear = years[years.length - 1]
    const yMax = Math.max(...rows.map((r) => r.hi)) * 1.15

    const chart = Plot.plot({
      width,
      height: 300,
      marginLeft: 44,
      marginRight: 48,
      marginTop: 16,
      marginBottom: 32,
      style: { fontFamily: 'Inter Variable, system-ui, sans-serif', fontSize: '13px', color: theme.ink2, background: 'transparent' },
      ariaLabel: title,
      x: { type: 'point', domain: years, tickFormat: (d: number) => String(d), label: null, padding: 0.3 },
      y: { domain: [0, yMax], tickFormat: (d: number) => `${Math.round(d * 100)}%`, label: null, ticks: 5 },
      color: { domain: series, range: colors },
      marks: [
        Plot.gridY({ stroke: theme.grid, strokeOpacity: 1, ticks: 5 }),
        Plot.ruleY([0], { stroke: theme.grid, strokeOpacity: 1 }),
        Plot.areaY(rows, { x: 'year', y1: 'lo', y2: 'hi', fill: 'series', fillOpacity: 0.16 }),
        Plot.lineY(rows, { x: 'year', y: 'p', stroke: 'series', strokeWidth: 2 }),
        Plot.dot(rows, { x: 'year', y: 'p', fill: 'series', r: 4, stroke: theme.surface, strokeWidth: 2 }),
        Plot.text(
          rows.filter((r) => r.year === lastYear),
          { x: 'year', y: 'p', text: (d: TrendRow) => formatPct(d.p), dx: 10, textAnchor: 'start', fill: theme.ink, fontWeight: 600 },
        ),
        Plot.ruleX(rows, Plot.pointerX({ x: 'year', stroke: theme.muted, strokeDasharray: '3 3' })),
        Plot.tip(
          rows,
          Plot.pointerX({
            x: 'year',
            y: 'p',
            fill: theme.surface,
            stroke: theme.grid,
            title: (d: TrendRow) => `${d.series}, ${d.year}\n${formatPct(d.p, 1)}  (95% CI ${formatRange(d.lo, d.hi)})`,
          }),
        ),
      ],
    })
    el.replaceChildren(chart)
    return () => chart.remove()
  }, [rows, series, theme, width, title, showTable])

  const years = [...new Set(rows.map((r) => r.year))].sort((a, b) => a - b)

  return (
    <figure className="m-0" aria-labelledby={headingId}>
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
              <line x1="1" y1="5" x2="21" y2="5" stroke={theme.series[i]} strokeWidth="2" />
              <circle cx="11" cy="5" r="4" fill={theme.series[i]} />
            </svg>
            {s}
          </li>
        ))}
      </ul>

      {showTable ? (
        <div className="overflow-x-auto">
          <table className="tabular mt-2 w-full border-collapse text-sm">
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
                  {series.map((s) => {
                    const r = rows.find((d) => d.year === y && d.series === s)
                    return (
                      <td key={s} className="border-b border-line py-2 pr-4">
                        {r ? `${formatPct(r.p, 1)} (${formatRange(r.lo, r.hi)})` : '—'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={plotRef} className="w-full" />
      )}

      {caption ? <figcaption className="mt-2 text-sm text-muted">{caption}</figcaption> : null}
    </figure>
  )
}
