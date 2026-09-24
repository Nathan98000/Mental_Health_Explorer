import type { Ref } from 'react'
import { describeSparkline, sparklineGeometry, type SparkPoint } from '../lib/sparkline'

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

/** A small inline line chart with gaps where a year has no value (lib/sparkline.ts builds the labeled export version). */
export function Sparkline({ points, years, label, width = 150, height = 44, ref }: Props) {
  const pad = 6
  const { segments, dots } = sparklineGeometry(points, years, width, height, { x: pad, top: pad, bottom: pad })
  return (
    <svg ref={ref} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label ?? describeSparkline(points, years)} className="shrink-0 overflow-visible">
      <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="var(--line)" strokeWidth="1" />
      {segments.map((d, i) => (
        <polyline key={i} points={d} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {dots.map((d) => (
        <circle key={d.year} cx={d.cx} cy={d.cy} r="3" fill="var(--primary)" />
      ))}
    </svg>
  )
}
