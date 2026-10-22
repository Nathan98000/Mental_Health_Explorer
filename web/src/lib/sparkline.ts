import { formatShare } from './format'

export type SparkPoint = { year: number; p: number | null }

/** Values by year for the accessible name, e.g. "2021: 21%, 2022: 19%, 2023: not available, 2024: 15%". */
export function describeSparkline(points: SparkPoint[], years: readonly number[]): string {
  return years.map((y) => {
    const point = points.find((d) => d.year === y)
    return `${y}: ${point && point.p !== null ? formatShare(point.p) : 'not available'}`
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
