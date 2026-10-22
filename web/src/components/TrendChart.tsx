import * as Plot from '@observablehq/plot'
import { useEffect, useId, useRef, useState } from 'react'
import type { ExportLegendItem } from '../lib/exports'
import { formatPct, formatRange, formatShare } from '../lib/format'
import { dodgeLabels, LABEL_GAP, LABEL_MARGIN_RIGHT, NARROW_MARGIN_RIGHT, NARROW_WIDTH, truncateLabel } from '../lib/labels'
import { useChartTheme, type ChartTheme } from '../lib/theme'
import { ChartExports } from './ChartExports'
import { ScrollTable } from './ScrollTable'
import { SuppressedValue } from './SuppressedValue'

export type TrendRowStatus = 'ok' | 'not_collected' | 'suppressed'

/** One point per year and series; a null `p` is a gap (the year was not collected or the point is suppressed). */
export type TrendRow = { year: number; series: string; p: number | null; lo: number | null; hi: number | null; status: TrendRowStatus; reason?: string | null }

/** A change to the survey taking effect in `year`, drawn as a rule just before that year. */
export type Annotation = { year: number; label: string }

/** The two years compared in the table beside the chart, marked with larger dots. */
export type ChartComparison = { yearA: number; yearB: number }

type Props = {
  title: string
  rows: TrendRow[]
  /** Series names in fixed display order; color slots follow this order. */
  series: string[]
  /** Every year on the axis, so years without a value show as gaps. */
  years: readonly number[]
  caption?: string
  /** Survey changes: a thin solid rule between the year before and the year named, explained under the chart. */
  annotations?: Annotation[]
  /** Plain notes under the chart (gaps, suppressed points). */
  notes?: string[]
  comparison?: ChartComparison
  /** One color per series; the categorical slots by default (see lib/theme.ts seriesColors). */
  colors?: string[]
  /** Downloads: the frame title defaults to `title`; `crisis` adds the 988 note to suicide measures' images. */
  exports?: { csv: string; filename: string; citation: string; title?: string; subtitle?: string; url?: string; crisis?: boolean }
}

const HEIGHT = 320
/** With more series than this, confidence intervals become per-point rules instead of overlapping bands. */
const BAND_MAX_SERIES = 2
const MARGIN = { top: 16, bottom: 32, left: 44 }
const SVG_NS = 'http://www.w3.org/2000/svg'
/** With this many series or more, each series' dots get their own shape, so lines can be told apart without color. */
const SYMBOL_MIN_SERIES = 3
const SYMBOLS = ['circle', 'square', 'triangle', 'diamond', 'star'] as const
type SymbolName = (typeof SYMBOLS)[number]

function defined(row: TrendRow): row is TrendRow & { p: number; lo: number; hi: number } {
  return row.p !== null && row.lo !== null && row.hi !== null
}

function svgEl(name: string, attrs: Record<string, string | number>, text?: string): SVGElement {
  const node = document.createElementNS(SVG_NS, name)
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value))
  if (text !== undefined) node.textContent = text
  return node
}

type Chart = ReturnType<typeof Plot.plot>

function scale(chart: Chart, name: 'x' | 'y'): (value: number) => number {
  const s = chart.scale(name)
  if (!s?.apply) throw new Error(`The chart has no ${name} scale`)
  return (value) => s.apply(value)
}

/** Direct labels at the final year, dodged apart with a leader line wherever a label had to move. */
function endLabels(chart: Chart, ends: (TrendRow & { p: number })[], single: boolean, theme: ChartTheme): SVGElement {
  const x = scale(chart, 'x')
  const y = scale(chart, 'y')
  const px = x(ends[0].year)
  const ys = ends.map((r) => y(r.p))
  const dodged = dodgeLabels(ys, LABEL_GAP, MARGIN.top + LABEL_GAP / 2, HEIGHT - MARGIN.bottom - 2)
  const g = svgEl('g', { 'data-end-labels': '', 'aria-hidden': 'true' })
  ends.forEach((r, i) => {
    if (Math.abs(dodged[i] - ys[i]) > 0.5) g.append(svgEl('line', { 'data-leader': '', x1: px + 6, y1: ys[i], x2: px + 11, y2: dodged[i], stroke: theme.muted, 'stroke-width': 1 }))
    g.append(
      svgEl(
        'text',
        { 'data-end-label': r.series, x: px + 13, y: dodged[i], dy: '0.35em', fill: theme.ink, 'font-weight': 600, style: 'text-anchor: start' },
        single ? formatShare(r.p) : `${truncateLabel(r.series)} ${formatShare(r.p)}`,
      ),
    )
  })
  return g
}

/** "Survey change" rules: a thin solid line between the year before and the year of the change (or at that year when it is the first), labeled at the top. */
function surveyChangeRules(chart: Chart, annotations: Annotation[], years: readonly number[], theme: ChartTheme): SVGElement {
  const x = scale(chart, 'x')
  const g = svgEl('g', { 'data-survey-changes': '', 'aria-hidden': 'true' })
  for (const year of [...new Set(annotations.map((a) => a.year))]) {
    const before = years[years.indexOf(year) - 1]
    const px = before === undefined ? x(year) : (x(before) + x(year)) / 2
    g.append(svgEl('line', { 'data-survey-change': year, x1: px, x2: px, y1: MARGIN.top, y2: HEIGHT - MARGIN.bottom, stroke: theme.ink2, 'stroke-width': 1 }))
    g.append(svgEl('text', { x: px, y: MARGIN.top - 5, style: 'text-anchor: middle', fill: theme.ink2, 'font-size': 11 }, 'Survey change'))
  }
  return g
}

/** A larger dot on every series at the two compared years, drawn over the line. */
function comparedPoints(chart: Chart, points: (TrendRow & { p: number })[], colors: Map<string, string>, theme: ChartTheme): SVGElement {
  const x = scale(chart, 'x')
  const y = scale(chart, 'y')
  const g = svgEl('g', { 'data-compared-points': '', 'aria-hidden': 'true' })
  for (const r of points) g.append(svgEl('circle', { 'data-compared-point': `${r.series} ${r.year}`, cx: x(r.year), cy: y(r.p), r: 5.5, fill: colors.get(r.series) ?? theme.ink, stroke: theme.surface, 'stroke-width': 2 }))
  return g
}

/** Series colors in slot order. */
function seriesStyle(series: string[], theme: ChartTheme, colors?: string[]): string[] {
  return series.map((_, i) => colors?.[i] ?? theme.series[i % theme.series.length])
}

/** The legend swatch shape for a series, matching its dots on the chart. */
function Swatch({ symbol, color }: { symbol: SymbolName; color: string }) {
  const shape = {
    circle: <circle cx="11" cy="6" r="4" fill={color} />,
    square: <rect x="7.5" y="2.5" width="7" height="7" fill={color} />,
    triangle: <polygon points="11,1.5 15.5,9.5 6.5,9.5" fill={color} />,
    diamond: <polygon points="11,1 16,6 11,11 6,6" fill={color} />,
    star: <polygon points="11,0.8 12.4,4.3 16.2,4.5 13.2,6.9 14.2,10.6 11,8.5 7.8,10.6 8.8,6.9 5.8,4.5 9.6,4.3" fill={color} />,
  }[symbol]
  return (
    <svg width="22" height="12" aria-hidden="true" data-symbol={symbol}>
      <line x1="1" y1="6" x2="21" y2="6" stroke={color} strokeWidth="2.5" />
      {shape}
    </svg>
  )
}

/**
 * Line chart of weighted estimates over survey years, with a shaded 95% CI band per series,
 * gaps for missing years, a crosshair tooltip, direct end-of-line labels, an HTML legend,
 * numbered annotations and a table view for screen readers and keyboard users.
 */
export function TrendChart({ title, rows, series, years, caption, annotations = [], notes = [], comparison, colors: seriesColors, exports }: Props) {
  const plotRef = useRef<HTMLDivElement>(null)
  const theme = useChartTheme()
  const [width, setWidth] = useState(640)
  const [showTable, setShowTable] = useState(false)
  const headingId = useId()
  const notesId = useId()
  const colors = seriesStyle(series, theme, seriesColors)
  const bands = series.length <= BAND_MAX_SERIES
  const symbols = series.length >= SYMBOL_MIN_SERIES
  const symbolOf = (s: string): SymbolName => (symbols ? SYMBOLS[series.indexOf(s) % SYMBOLS.length] : 'circle')
  const narrow = width < NARROW_WIDTH
  /** Series with at least one drawn point; the others are left out of the legend. */
  const drawn = series.filter((s) => rows.some((r) => r.series === s && defined(r)))
  /** Each series' latest drawn value, shown in the legend when the chart is too narrow for end labels. */
  const lastValue = (s: string) => rows.filter((r) => r.series === s && defined(r)).sort((a, b) => b.year - a.year)[0]?.p ?? null

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
    const colors = seriesStyle(series, theme, seriesColors)
    const narrow = width < NARROW_WIDTH
    const shown = rows.filter(defined)
    const yMax = Math.max(0.05, ...shown.map((r) => r.hi)) * 1.15
    // 95% intervals: shaded bands for one or two series, per-point rules (offset a few px per series) when bands would overlap.
    const intervals: Plot.Markish[] =
      series.length <= BAND_MAX_SERIES
        ? [Plot.areaY(rows, { x: 'year', y1: 'lo', y2: 'hi', fill: 'series', fillOpacity: 0.16 })]
        : series.map((s, i) =>
            Plot.ruleX(
              shown.filter((r) => r.series === s),
              { x: 'year', y1: 'lo', y2: 'hi', stroke: 'series', strokeWidth: 1.5, strokeOpacity: 0.9, dx: (i - (series.length - 1) / 2) * 4 },
            ),
          )
    const marks: Plot.Markish[] = [
      Plot.gridY({ stroke: theme.grid, strokeOpacity: 1, ticks: 5 }),
      Plot.ruleY([0], { stroke: theme.grid, strokeOpacity: 1 }),
      ...intervals,
      Plot.lineY(rows, { x: 'year', y: 'p', stroke: 'series', strokeWidth: 2.5 }),
      Plot.dot(shown, { x: 'year', y: 'p', fill: 'series', r: 4, stroke: theme.surface, strokeWidth: 2, ...(symbols ? { symbol: 'series' } : {}) }),
      Plot.ruleX(shown, Plot.pointerX({ x: 'year', stroke: theme.muted, strokeDasharray: '3 3' })),
      Plot.tip(
        shown,
        Plot.pointerX({
          x: 'year',
          y: 'p',
          fill: theme.surface,
          stroke: theme.grid,
          title: (d: TrendRow) => `${d.series}, ${d.year}\n${formatPct(d.p as number, 1)}  (95% confidence interval: ${formatRange(d.lo as number, d.hi as number)})`,
        }),
      ),
    ]
    const chart = Plot.plot({
      width,
      height: HEIGHT,
      marginLeft: MARGIN.left,
      marginRight: narrow ? NARROW_MARGIN_RIGHT : LABEL_MARGIN_RIGHT,
      marginTop: MARGIN.top,
      marginBottom: MARGIN.bottom,
      style: { fontFamily: 'Inter Variable, system-ui, sans-serif', fontSize: '13px', color: theme.ink2, background: 'transparent' },
      ariaLabel: title,
      x: { type: 'point', domain: [...years], tickFormat: (d: number) => String(d), label: null, padding: 0.3 },
      y: { domain: [0, yMax], tickFormat: (d: number) => `${Math.round(d * 100)}%`, label: null, ticks: 5 },
      color: { domain: series, range: colors },
      ...(symbols ? { symbol: { domain: series, range: series.map((_, i) => SYMBOLS[i % SYMBOLS.length]) } } : {}),
      marks,
    })
    chart.setAttribute('role', 'img')
    // Plot labels each mark's <g>; ARIA prohibits aria-label there, and the svg's own label plus the table view carry the meaning.
    for (const node of chart.querySelectorAll('[aria-label], [aria-description]')) {
      node.removeAttribute('aria-label')
      node.removeAttribute('aria-description')
    }
    // Only the final year gets an end label; a series with no point there gets none.
    const ends = shown.filter((r) => r.year === years[years.length - 1])
    if (!narrow && ends.length) chart.append(endLabels(chart, ends, series.length === 1, theme))
    if (comparison) {
      const both = series.filter((s) => [comparison.yearA, comparison.yearB].every((y) => shown.some((r) => r.series === s && r.year === y)))
      const points = shown.filter((r) => both.includes(r.series) && (r.year === comparison.yearA || r.year === comparison.yearB))
      chart.append(comparedPoints(chart, points, new Map(series.map((s, i) => [s, colors[i]])), theme))
    }
    if (annotations.length) chart.append(surveyChangeRules(chart, annotations, years, theme))
    el.replaceChildren(chart)
    return () => chart.remove()
  }, [rows, series, years, annotations, comparison, seriesColors, theme, width, title, showTable, symbols])

  const tableCell = (row: TrendRow | undefined) => {
    if (!row || row.status === 'not_collected') return <span className="text-muted">Not available</span>
    if (row.status === 'suppressed' || !defined(row)) return <SuppressedValue reason={row.reason ?? null} />
    return `${formatPct(row.p, 1)} (${formatRange(row.lo, row.hi)})`
  }

  const intervalText = bands ? 'Shaded bands show 95% confidence intervals.' : 'Vertical bars at each point show 95% confidence intervals.'
  const captionText = [caption, intervalText, comparison ? `Larger dots mark ${comparison.yearA} and ${comparison.yearB}, the years compared in the table.` : null].filter(Boolean).join(' ')
  const legend: ExportLegendItem[] | undefined = series.length > 1 ? series.filter((s) => drawn.includes(s)).map((s) => ({ label: s, color: colors[series.indexOf(s)] })) : undefined
  const exportNotes = [
    intervalText,
    comparison ? `Larger dots mark ${comparison.yearA} and ${comparison.yearB}.` : null,
    ...annotations.map((a) => `Survey change${annotations.length > 1 ? ` (${a.year})` : ''}: ${a.label}`),
    ...notes,
  ].filter((n): n is string => !!n)

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

      {showTable ? null : (
        <ul className="mt-3 mb-1 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-sm text-ink-2" aria-label="Legend">
          {drawn.map((s) => {
            const last = narrow ? lastValue(s) : null
            return (
              <li key={s} className="flex items-center gap-2">
                <Swatch symbol={symbolOf(s)} color={colors[series.indexOf(s)]} />
                <span>
                  {s}
                  {last !== null ? <span className="tabular font-semibold text-ink"> {formatShare(last)}</span> : null}
                </span>
              </li>
            )
          })}
        </ul>
      )}

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

      {captionText && !showTable ? <figcaption className="mt-2 text-sm text-muted">{captionText}</figcaption> : null}
      {notes.length || annotations.length ? (
        <ol id={notesId} className="mt-2 mb-0 list-none space-y-1 p-0 text-sm text-ink-2">
          {annotations.map((a, i) => (
            <li key={`a${i}`}>
              <strong className="font-semibold">Survey change{annotations.length > 1 ? ` (${a.year})` : ''}:</strong> {a.label}
            </li>
          ))}
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ol>
      ) : null}
      {exports ? (
        <ChartExports
          getSvg={() => plotRef.current?.querySelector('svg') ?? null}
          csv={exports.csv}
          filename={exports.filename}
          citation={exports.citation}
          frame={{ title: exports.title ?? title, subtitle: exports.subtitle, legend, notes: exportNotes, url: exports.url, crisis: exports.crisis }}
        />
      ) : null}
    </figure>
  )
}
