import * as Plot from '@observablehq/plot'
import { useEffect, useId, useRef, useState } from 'react'
import type { ExportLegendItem } from '../lib/exports'
import { formatPct, formatRange } from '../lib/format'
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

/** The two years compared next to the chart; series not in `significant` are drawn dashed and lighter. */
export type ChartComparison = { yearA: number; yearB: number; significant: string[] }

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
  exports?: { csv: string; filename: string; citation: string; subtitle?: string }
}

const HEIGHT = 320
/** With more series than this, confidence intervals become per-point rules instead of overlapping bands. */
const BAND_MAX_SERIES = 2
const MARGIN = { top: 16, bottom: 32, left: 44 }
const SVG_NS = 'http://www.w3.org/2000/svg'

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
        single ? formatPct(r.p, 1) : `${truncateLabel(r.series)} ${formatPct(r.p, 1)}`,
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

/** Light vertical rules at the two compared years, behind everything else. */
function comparedYearRules(chart: Chart, years: number[], theme: ChartTheme): SVGElement {
  const x = scale(chart, 'x')
  const g = svgEl('g', { 'data-compared-years': '', 'aria-hidden': 'true' })
  for (const year of years) {
    const px = x(year)
    g.append(svgEl('line', { 'data-compared-year': year, x1: px, x2: px, y1: MARGIN.top, y2: HEIGHT - MARGIN.bottom, stroke: theme.muted, 'stroke-opacity': 0.35, 'stroke-width': 2 }))
  }
  return g
}

/** Series colors in slot order, and the series a comparison leaves dashed (their change is not significant). */
function seriesStyle(series: string[], theme: ChartTheme, comparison?: ChartComparison, colors?: string[]): { colors: string[]; muted: Set<string> } {
  return {
    colors: series.map((_, i) => colors?.[i] ?? theme.series[i % theme.series.length]),
    muted: new Set(comparison ? series.filter((s) => !comparison.significant.includes(s)) : []),
  }
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
  const { colors, muted } = seriesStyle(series, theme, comparison, seriesColors)
  const bands = series.length <= BAND_MAX_SERIES
  /** Series with at least one drawn point; the others are left out of the legend. */
  const drawn = series.filter((s) => rows.some((r) => r.series === s && defined(r)))

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
    const { colors, muted } = seriesStyle(series, theme, comparison, seriesColors)
    const narrow = width < NARROW_WIDTH
    const shown = rows.filter(defined)
    const yMax = Math.max(0.05, ...shown.map((r) => r.hi)) * 1.15
    const solid = rows.filter((r) => !muted.has(r.series))
    const dashed = rows.filter((r) => muted.has(r.series))
    // 95% intervals: shaded bands for one or two series, per-point rules (offset a few px per series) when bands would overlap.
    const intervals: Plot.Markish[] =
      series.length <= BAND_MAX_SERIES
        ? [
            Plot.areaY(solid, { x: 'year', y1: 'lo', y2: 'hi', fill: 'series', fillOpacity: 0.16 }),
            Plot.areaY(dashed, { x: 'year', y1: 'lo', y2: 'hi', fill: 'series', fillOpacity: 0.08 }),
          ]
        : series.map((s, i) =>
            Plot.ruleX(
              shown.filter((r) => r.series === s),
              { x: 'year', y1: 'lo', y2: 'hi', stroke: 'series', strokeWidth: 1.5, strokeOpacity: muted.has(s) ? 0.45 : 0.9, dx: (i - (series.length - 1) / 2) * 4 },
            ),
          )
    const marks: Plot.Markish[] = [
      Plot.gridY({ stroke: theme.grid, strokeOpacity: 1, ticks: 5 }),
      Plot.ruleY([0], { stroke: theme.grid, strokeOpacity: 1 }),
      ...intervals,
      Plot.lineY(solid, { x: 'year', y: 'p', stroke: 'series', strokeWidth: 2 }),
      Plot.lineY(dashed, { x: 'year', y: 'p', stroke: 'series', strokeWidth: 2, strokeDasharray: '6 4', strokeOpacity: 0.6 }),
      Plot.dot(shown.filter((r) => !muted.has(r.series)), { x: 'year', y: 'p', fill: 'series', r: 4, stroke: theme.surface, strokeWidth: 2 }),
      Plot.dot(shown.filter((r) => muted.has(r.series)), { x: 'year', y: 'p', fill: 'series', fillOpacity: 0.6, r: 4, stroke: theme.surface, strokeWidth: 2 }),
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
    if (comparison) chart.prepend(comparedYearRules(chart, [comparison.yearA, comparison.yearB], theme))
    if (annotations.length) chart.append(surveyChangeRules(chart, annotations, years, theme))
    el.replaceChildren(chart)
    return () => chart.remove()
  }, [rows, series, years, annotations, comparison, seriesColors, theme, width, title, showTable])

  const tableCell = (row: TrendRow | undefined) => {
    if (!row || row.status === 'not_collected') return <span className="text-muted">Not available</span>
    if (row.status === 'suppressed' || !defined(row)) return <SuppressedValue reason={row.reason ?? null} />
    return `${formatPct(row.p, 1)} (${formatRange(row.lo, row.hi)})`
  }

  const captionText = [
    caption,
    bands ? 'Shaded bands show 95% confidence intervals.' : 'Vertical bars at each point show 95% confidence intervals.',
    comparison ? `Light vertical rules mark ${comparison.yearA} and ${comparison.yearB}, the years compared.` : null,
    comparison && muted.size ? `Dashed lines: the change from ${comparison.yearA} to ${comparison.yearB} is not statistically significant.` : null,
  ]
    .filter(Boolean)
    .join(' ')
  const legend: ExportLegendItem[] | undefined = series.length > 1 ? series.filter((s) => drawn.includes(s)).map((s) => ({ label: s, color: colors[series.indexOf(s)], dashed: muted.has(s) })) : undefined

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
          {drawn.map((s) => (
            <li key={s} className="flex items-center gap-2">
              <svg width="22" height="10" aria-hidden="true">
                <line x1="1" y1="5" x2="21" y2="5" stroke={colors[series.indexOf(s)]} strokeWidth="2" strokeDasharray={muted.has(s) ? '4 3' : undefined} />
                <circle cx="11" cy="5" r="4" fill={colors[series.indexOf(s)]} opacity={muted.has(s) ? 0.6 : 1} />
              </svg>
              {s}
            </li>
          ))}
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
          frame={{ title, subtitle: exports.subtitle, legend }}
        />
      ) : null}
    </figure>
  )
}
