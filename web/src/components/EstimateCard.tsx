import type { Cell } from '../lib/data'
import { formatCount, formatPct, formatPeople, formatRange, oneInN } from '../lib/format'
import { SuppressedValue } from './SuppressedValue'

type Props = {
  /** When the estimate is for, e.g. "2024" or "2021–2024 combined". */
  when: string
  cell: Cell
  /** Who the estimate describes, e.g. "female teens ages 12–17". */
  population: string
  /** Takeaway sentences, already checked for significance (see lib/takeaways.ts). */
  sentences: string[]
}

/** The site's standard estimate card: a big rounded number, plain sentences, the details underneath. */
export function EstimateCard({ when, cell, population, sentences }: Props) {
  const ratio = cell.p !== null ? oneInN(cell.p) : null
  return (
    <article className="rounded-3xl bg-surface p-6 shadow-[0_2px_0_var(--line),0_12px_32px_-18px_rgba(30,34,64,0.35)] ring-1 ring-line" aria-label="Estimate">
      <p className="m-0 text-sm font-semibold uppercase tracking-wide text-primary-ink">{when}</p>
      <p className="m-0 mt-1 font-display text-6xl font-extrabold leading-none text-ink" data-testid="estimate-value">
        {cell.suppressed || cell.p === null ? <SuppressedValue reason={cell.reason} /> : formatPct(cell.p)}
      </p>
      {ratio ? <p className="m-0 mt-2 text-base text-ink-2">about {ratio} of {population}</p> : null}
      <div className="mt-3 space-y-1 text-lg leading-snug text-ink">
        {sentences.map((s) => (
          <p key={s} className="m-0">{s}</p>
        ))}
      </div>
      <dl className="m-0 mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm text-ink-2">
        <dt className="font-medium">95% confidence interval</dt>
        <dd className="m-0">{cell.lo !== null && cell.hi !== null ? formatRange(cell.lo, cell.hi) : <SuppressedValue reason={cell.reason} />}</dd>
        <dt className="font-medium">Survey responses</dt>
        <dd className="m-0">{formatCount(cell.n)}</dd>
        <dt className="font-medium">Estimated number of people</dt>
        <dd className="m-0">{cell.pop !== null ? `about ${formatPeople(cell.pop)}` : <SuppressedValue reason={cell.reason} />}</dd>
      </dl>
    </article>
  )
}
