import { formatPct } from './format'

export type SparkPoint = { year: number; p: number | null }

/** Values by year for the accessible name, e.g. "2021: 21%, 2022: 19%, 2023: not available, 2024: 15%". */
export function describeSparkline(points: SparkPoint[], years: readonly number[]): string {
  return years.map((y) => {
    const point = points.find((d) => d.year === y)
    return `${y}: ${point && point.p !== null ? formatPct(point.p) : 'not available'}`
  }).join(', ')
}
