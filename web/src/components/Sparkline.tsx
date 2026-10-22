import type { Ref } from 'react'
import { formatShare } from '../lib/format'
import { describeSparkline, sparklineGeometry, type SparkPoint } from '../lib/sparkline'

type Props = {
  points: SparkPoint[]
  /** Every year on the axis, so years that were not collected show as gaps. */
  years: readonly number[]
  /** Accessible description; defaults to the values by year. */
  label?: string
  width?: number
  height?: number
}

/** A small inline line chart with gaps where a year has no value, for the overview tiles. */
export function Sparkline({ points, years, label, width = 150, height = 44 }: Props) {
  const pad = 6
  const { segments, dots } = sparklineGeometry(points, years, width, height, { x: pad, top: pad, bottom: pad })
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label ?? describeSparkline(points, years)} className="shrink-0 overflow-visible">
      <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="var(--line)" strokeWidth="1" />
      {segments.map((d, i) => (
        <polyline key={i} points={d} fill="none" stroke="var(--data)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {dots.map((d) => (
        <circle key={d.year} cx={d.cx} cy={d.cy} r={3} fill="var(--data)" />
      ))}
    </svg>
  )
}

type LabeledProps = Props & {
  /** The year being looked at: its dot is drawn larger. */
  highlightYear?: number
  /** Years pooled into the estimate being looked at: shaded behind the line. */
  shadeYears?: readonly number[]
  ref?: Ref<SVGSVGElement>
}

/** The explorer's "Over time" chart and its image download: a value over every point and every year under the axis. */
export function LabeledSparkline({ points, years, label, highlightYear, shadeYears = [], width = 320, height = 120, ref }: LabeledProps) {
  const pad = { x: 28, top: 26, bottom: 28 }
  const { segments, dots, x } = sparklineGeometry(points, years, width, height, pad)
  const baseline = height - pad.bottom
  const shaded = shadeYears.filter((y) => years.includes(y))
  const half = (width - 2 * pad.x) / Math.max(1, years.length - 1) / 2
  const left = shaded.length ? Math.max(0, x(Math.min(...shaded)) - half) : 0
  return (
    <svg
      ref={ref}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label ?? describeSparkline(points, years)}
      className="h-auto w-full max-w-80"
      fontFamily="Inter Variable, Inter, system-ui, sans-serif"
      fontSize={13}
    >
      {shaded.length ? <rect data-shaded-years={shaded.join(' ')} x={left} y={4} width={Math.min(width, x(Math.max(...shaded)) + half) - left} height={height - 8} rx={8} fill="var(--surface-cool)" /> : null}
      <line x1={pad.x / 2} y1={baseline} x2={width - pad.x / 2} y2={baseline} stroke="var(--line)" strokeWidth="1" />
      {years.map((y) => (
        <text key={y} x={x(y)} y={baseline + 19} textAnchor="middle" fill="var(--muted)" fontWeight={y === highlightYear ? 700 : 400}>
          {y}
        </text>
      ))}
      {segments.map((d, i) => (
        <polyline key={i} points={d} fill="none" stroke="var(--data)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {dots.map((d) => (
        <g key={d.year}>
          <circle cx={d.cx} cy={d.cy} r={d.year === highlightYear ? 6 : 4} fill="var(--data)" stroke="var(--surface)" strokeWidth="2" data-highlighted={d.year === highlightYear ? 'true' : undefined} />
          <text x={d.cx} y={d.cy - 11} textAnchor="middle" fill="var(--ink)" fontWeight={600}>
            {formatShare(d.p)}
          </text>
        </g>
      ))}
    </svg>
  )
}
