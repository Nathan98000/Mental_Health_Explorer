import { formatCount, formatPct, formatRange, oneInN } from '../lib/format'

type Props = {
  /** Plain-language name of the measure, e.g. "had a major depressive episode". */
  measure: string
  /** Who the estimate describes, e.g. "teens ages 12–17". */
  population: string
  year: number
  p: number
  lo: number
  hi: number
  n: number
  /** Optional one-sentence comparison, already checked for significance. */
  comparison?: string
}

/** The site's standard estimate card: a big rounded number, a plain sentence, details on demand. */
export function EstimateCard({ measure, population, year, p, lo, hi, n, comparison }: Props) {
  const ratio = oneInN(p)
  return (
    <article className="rounded-3xl bg-surface p-6 shadow-[0_2px_0_var(--line),0_12px_32px_-18px_rgba(30,34,64,0.35)] ring-1 ring-line">
      <p className="m-0 text-sm font-semibold uppercase tracking-wide text-primary-ink">{year}</p>
      <p className="m-0 mt-1 font-display text-6xl font-extrabold leading-none text-ink">{formatPct(p)}</p>
      <p className="m-0 mt-3 text-lg leading-snug text-ink">
        {ratio ? <>About <strong>{ratio}</strong> </> : null}
        {population} {measure}.
      </p>
      {comparison ? <p className="m-0 mt-2 text-base text-ink-2">{comparison}</p> : null}
      <details className="mt-4 text-sm text-ink-2">
        <summary className="cursor-pointer font-medium text-ink-2 hover:text-ink">How sure are we?</summary>
        <ul className="mt-2 mb-0 list-disc space-y-1 pl-5">
          <li>95% confidence interval: {formatRange(lo, hi)}</li>
          <li>Based on {formatCount(n)} survey responses, weighted to represent all U.S. {population}</li>
        </ul>
      </details>
    </article>
  )
}
