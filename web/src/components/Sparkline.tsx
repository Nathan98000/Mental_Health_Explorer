import type { Ref } from 'react'
import { describeSparkline, type SparkPoint } from '../lib/sparkline'

type Props = {
  points: SparkPoint[]
  /** Every year on the axis, so years that were not collected show as gaps. */
  years: readonly number[]
  /** Accessible description; defaults to the values by year. */
  label?: string
  width?: number
  height?: number
  ref?: Ref<SVGSVGElement>
}

/** A small inline line chart with gaps where a year has no value. */
export function Sparkline({ points, years, label, width = 150, height = 44, ref }: Props) {
  const pad = 6
  const max = Math.max(0.01, ...points.map((d) => d.p ?? 0)) * 1.1
  const x = (year: number) => pad + ((width - 2 * pad) * years.indexOf(year)) / Math.max(1, years.length - 1)
  const y = (p: number) => height - pad - ((height - 2 * pad) * p) / max
  const segments: string[] = []
  let current: string[] = []
  for (const year of years) {
    const point = points.find((d) => d.year === year)
    if (point && point.p !== null) {
      current.push(`${x(year).toFixed(1)},${y(point.p).toFixed(1)}`)
    } else if (current.length) {
      segments.push(current.join(' '))
      current = []
    }
  }
  if (current.length) segments.push(current.join(' '))
  return (
    <svg ref={ref} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label ?? describeSparkline(points, years)} className="shrink-0 overflow-visible">
      <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="var(--line)" strokeWidth="1" />
      {segments.map((d, i) => (
        <polyline key={i} points={d} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {points
        .filter((d) => d.p !== null && years.includes(d.year))
        .map((d) => (
          <circle key={d.year} cx={x(d.year)} cy={y(d.p as number)} r="3" fill="var(--primary)" />
        ))}
    </svg>
  )
}
