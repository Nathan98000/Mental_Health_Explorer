import { useId, useState } from 'react'
import { Link } from 'react-router'
import type { Cell } from '../lib/data'
import { formatCount, formatPct, formatPeople, formatRange, formatShare } from '../lib/format'
import { isWideInterval } from '../lib/takeaways'
import { SuppressedValue } from './SuppressedValue'

type Props = {
  /** When the estimate is for, e.g. "2024" or "2021–2024 combined". */
  when: string
  cell: Cell
  /** Who the share is out of, e.g. "teens ages 12–17 who had a major depressive episode in the past year". */
  population: string
  /** The cohort's people noun for the response count, e.g. "teens". */
  people: string
  /** Takeaway sentences, already checked for significance (see lib/takeaways.ts). */
  sentences: string[]
  /** Where to go next when the estimate is suppressed, e.g. "Try all years combined". */
  nextSteps?: { label: string; to: string }[]
  /** True for pooled year sets, whose population count is an annual average. */
  pooled?: boolean
}

const CI_EXPLAINER = 'Because the survey asks a sample of people rather than everyone, every estimate has some uncertainty. The true value most likely falls within this range.'

/** The site's standard estimate card: the number and who it is out of, plain sentences, the details underneath. */
export function EstimateCard({ when, cell, population, people, sentences, nextSteps = [], pooled = false }: Props) {
  const [explain, setExplain] = useState(false)
  const explainId = useId()
  const suppressed = cell.suppressed || cell.p === null
  // One rule for an imprecise estimate (lib/takeaways.ts): the number becomes the range (one decimal, like every interval), badged, and the sentence gives the range too.
  const wide = !suppressed && isWideInterval(cell.lo, cell.hi)
  const value = suppressed ? 'Not reported' : wide ? `${formatPct(cell.lo as number, 1)}–${formatPct(cell.hi as number, 1)}` : formatShare(cell.p as number)
  return (
    <article className="rounded-2xl bg-surface p-4 shadow-[0_2px_0_var(--line),0_12px_32px_-18px_rgba(30,34,64,0.35)] ring-1 ring-line sm:p-6" aria-label="Estimate">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p
          className={`tabular m-0 font-display leading-none ${suppressed ? 'text-h2 font-bold text-ink-2' : wide ? 'text-number font-bold text-ink-2' : 'text-number font-extrabold text-ink'}`}
          data-testid="estimate-value"
        >
          {value}
        </p>
        {wide ? (
          <span className="rounded-full bg-surface-cool px-3 py-1 text-xs font-semibold text-ink" data-testid="wide-margin">
            Wide margin of error
          </span>
        ) : null}
      </div>
      {wide ? <p className="m-0 mt-1 text-base font-semibold text-ink">best estimate {formatShare(cell.p as number)}</p> : null}
      <p className="m-0 mt-2 text-sm text-ink-2" data-testid="estimate-of">
        of {population} · {when}
      </p>
      <div className="mt-3 space-y-1 text-lede text-ink">
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
        {suppressed ? null : (
          <>
            <dt className="font-medium">95% confidence interval</dt>
            <dd className="m-0">
              {cell.lo !== null && cell.hi !== null ? formatRange(cell.lo, cell.hi) : <SuppressedValue reason={cell.reason} />}{' '}
              <button type="button" className="ml-1 inline-flex min-h-6 items-center text-sm font-semibold text-primary-ink underline" aria-expanded={explain} aria-controls={explainId} onClick={() => setExplain((v) => !v)}>
                What&apos;s this?
              </button>
            </dd>
            <dd id={explainId} hidden={!explain} className="col-span-2 m-0 mb-1 rounded-xl bg-surface-cool px-3 py-2 text-ink">
              {CI_EXPLAINER}
            </dd>
          </>
        )}
        <dt className="font-medium">Based on</dt>
        <dd className="m-0">answers from {formatCount(cell.n)} {people}</dd>
        {suppressed ? null : (
          <>
            <dt className="font-medium">Estimated number of people</dt>
            <dd className="m-0">{cell.pop !== null ? `about ${formatPeople(cell.pop)}${pooled ? ' per year, on average' : ''}` : <SuppressedValue reason={cell.reason} />}</dd>
          </>
        )}
      </dl>
    </article>
  )
}
