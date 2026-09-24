import { Link } from 'react-router'
import type { Cell } from '../lib/data'
import { formatCount, formatPct, formatPeople, formatRange } from '../lib/format'
import { isWideInterval } from '../lib/takeaways'
import { SuppressedValue } from './SuppressedValue'

type Props = {
  /** When the estimate is for, e.g. "2024" or "2021–2024 combined". */
  when: string
  cell: Cell
  /** Takeaway sentences, already checked for significance (see lib/takeaways.ts). */
  sentences: string[]
  /** Where to go next when the estimate is suppressed, e.g. "Try all years combined". */
  nextSteps?: { label: string; to: string }[]
  /** True for pooled year sets, whose population count is an annual average. */
  pooled?: boolean
}

/** The site's standard estimate card: a big rounded number, plain sentences, the details underneath. */
export function EstimateCard({ when, cell, sentences, nextSteps = [], pooled = false }: Props) {
  // One rule for an imprecise estimate (lib/takeaways.ts): the number is drawn lighter and badged, and the sentence gives the range.
  const wide = isWideInterval(cell.lo, cell.hi)
  return (
    <article className="rounded-3xl bg-surface p-6 shadow-[0_2px_0_var(--line),0_12px_32px_-18px_rgba(30,34,64,0.35)] ring-1 ring-line" aria-label="Estimate">
      <p className="m-0 text-sm font-semibold uppercase tracking-wide text-primary-ink">{when}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className={`m-0 font-display text-6xl leading-none ${wide ? 'font-bold text-ink-2' : 'font-extrabold text-ink'}`} data-testid="estimate-value">
          {cell.suppressed || cell.p === null ? <SuppressedValue reason={cell.reason} /> : formatPct(cell.p)}
        </p>
        {wide ? (
          <span className="rounded-full bg-surface-cool px-3 py-1 text-xs font-semibold text-ink" data-testid="wide-margin">
            Wide margin of error
          </span>
        ) : null}
      </div>
      <div className="mt-3 space-y-1 text-lg leading-snug text-ink">
        {sentences.map((s) => (
          <p key={s} className="m-0">{s}</p>
        ))}
      </div>
      {nextSteps.length ? (
        <p className="m-0 mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {nextSteps.map((step) => (
            <Link key={step.to} to={step.to} className="font-semibold text-primary-ink underline">
              {step.label}
            </Link>
          ))}
        </p>
      ) : null}
      <dl className="m-0 mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm text-ink-2">
        <dt className="font-medium">95% confidence interval</dt>
        <dd className="m-0">{cell.lo !== null && cell.hi !== null ? formatRange(cell.lo, cell.hi) : <SuppressedValue reason={cell.reason} />}</dd>
        <dt className="font-medium">Survey responses</dt>
        <dd className="m-0">{formatCount(cell.n)}</dd>
        <dt className="font-medium">Estimated number of people</dt>
        <dd className="m-0">{cell.pop !== null ? `about ${formatPeople(cell.pop)}${pooled ? ' per year, on average' : ''}` : <SuppressedValue reason={cell.reason} />}</dd>
      </dl>
    </article>
  )
}
