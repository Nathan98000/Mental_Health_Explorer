import type { Ref } from 'react'
import { describeSparkline, sparklineGeometry, type SparkPoint } from '../lib/sparkline'

type Props = {
  points: SparkPoint[]
  /** Every year on the axis, so years that were not collected show as gaps. */
  years: readonly number[]
  /** Accessible description; defaults to the values by year. */
  label?: string
  /** The year being looked at: its dot is drawn larger. */
  highlightYear?: number
  /** Years pooled into the estimate being looked at: shaded behind the line. */
  shadeYears?: readonly number[]
  width?: number
  height?: number
  ref?: Ref<SVGSVGElement>
}

/** A small inline line chart with gaps where a year has no value (lib/sparkline.ts builds the labeled export version). */
export function Sparkline({ points, years, label, highlightYear, shadeYears = [], width = 150, height = 44, ref }: Props) {
  const pad = 6
  const { segments, dots, x } = sparklineGeometry(points, years, width, height, { x: pad, top: pad, bottom: pad })
  const shaded = shadeYears.filter((y) => years.includes(y))
  const half = (width - 2 * pad) / Math.max(1, years.length - 1) / 2
  return (
    <svg ref={ref} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label ?? describeSparkline(points, years)} className="shrink-0 overflow-visible">
      {shaded.length ? (
        <rect
          data-shaded-years={shaded.join(' ')}
          x={Math.max(0, x(Math.min(...shaded)) - half)}
          y={0}
          width={Math.min(width, x(Math.max(...shaded)) + half) - Math.max(0, x(Math.min(...shaded)) - half)}
          height={height}
          rx={6}
          fill="var(--surface-tint)"
        />
      ) : null}
      <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="var(--line)" strokeWidth="1" />
      {segments.map((d, i) => (
        <polyline key={i} points={d} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {dots.map((d) => (
        <circle key={d.year} cx={d.cx} cy={d.cy} r={d.year === highlightYear ? 5.5 : 3} fill="var(--primary)" stroke={d.year === highlightYear ? 'var(--surface)' : 'none'} strokeWidth="2" data-highlighted={d.year === highlightYear ? 'true' : undefined} />
      ))}
    </svg>
  )
}
