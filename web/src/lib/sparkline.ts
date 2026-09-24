import { formatPct } from './format'

export type SparkPoint = { year: number; p: number | null }

/** Values by year for the accessible name, e.g. "2021: 21%, 2022: 19%, 2023: not available, 2024: 15%". */
export function describeSparkline(points: SparkPoint[], years: readonly number[]): string {
  return years.map((y) => {
    const point = points.find((d) => d.year === y)
    return `${y}: ${point && point.p !== null ? formatPct(point.p) : 'not available'}`
  }).join(', ')
}

export type SparkGeometry = {
  x: (year: number) => number
  y: (p: number) => number
  /** Polyline point lists, one per unbroken run of years with a value. */
  segments: string[]
  dots: { year: number; p: number; cx: number; cy: number }[]
}

/** Pixel geometry shared by the inline sparkline and its labeled export: the line breaks at every year without a value. */
export function sparklineGeometry(points: SparkPoint[], years: readonly number[], width: number, height: number, pad: { x: number; top: number; bottom: number }): SparkGeometry {
  const max = Math.max(0.01, ...points.map((d) => d.p ?? 0)) * 1.1
  const x = (year: number) => pad.x + ((width - 2 * pad.x) * years.indexOf(year)) / Math.max(1, years.length - 1)
  const y = (p: number) => height - pad.bottom - ((height - pad.top - pad.bottom) * p) / max
  const segments: string[] = []
  const dots: SparkGeometry['dots'] = []
  let current: string[] = []
  for (const year of years) {
    const point = points.find((d) => d.year === year)
    if (point && point.p !== null) {
      current.push(`${x(year).toFixed(1)},${y(point.p).toFixed(1)}`)
      dots.push({ year, p: point.p, cx: x(year), cy: y(point.p) })
    } else if (current.length) {
      segments.push(current.join(' '))
      current = []
    }
  }
  if (current.length) segments.push(current.join(' '))
  return { x, y, segments, dots }
}

export type SparkColors = { primary: string; line: string; ink: string; muted: string }

const SVG_NS = 'http://www.w3.org/2000/svg'

function node(name: string, attrs: Record<string, string | number>, text?: string): SVGElement {
  const el = document.createElementNS(SVG_NS, name)
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value))
  if (text !== undefined) el.textContent = text
  return el
}

/** A stand-alone, labeled version of the sparkline for image downloads: every year on the axis and a value over every point. */
export function labeledSparklineSvg(points: SparkPoint[], years: readonly number[], colors: SparkColors, width = 520, height = 220): SVGSVGElement {
  const pad = { x: 48, top: 28, bottom: 36 }
  const { segments, dots, x } = sparklineGeometry(points, years, width, height, pad)
  const svg = node('svg', { xmlns: SVG_NS, width, height, viewBox: `0 0 ${width} ${height}`, 'font-family': 'Inter Variable, Inter, system-ui, sans-serif', 'font-size': 13 }) as SVGSVGElement
  const baseline = height - pad.bottom
  svg.append(node('line', { x1: pad.x, y1: baseline, x2: width - pad.x, y2: baseline, stroke: colors.line, 'stroke-width': 1 }))
  for (const year of years) {
    svg.append(node('text', { x: x(year), y: baseline + 20, 'text-anchor': 'middle', fill: colors.muted }, String(year)))
    if (!dots.some((d) => d.year === year)) svg.append(node('text', { x: x(year), y: baseline - 8, 'text-anchor': 'middle', fill: colors.muted, 'font-size': 11 }, 'n/a'))
  }
  for (const d of segments) svg.append(node('polyline', { points: d, fill: 'none', stroke: colors.primary, 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }))
  for (const d of dots) {
    svg.append(node('circle', { cx: d.cx, cy: d.cy, r: 4.5, fill: colors.primary }))
    svg.append(node('text', { x: d.cx, y: d.cy - 10, 'text-anchor': 'middle', fill: colors.ink, 'font-weight': 600 }, formatPct(d.p, 1)))
  }
  return svg
}
