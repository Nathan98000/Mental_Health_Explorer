import { Link } from 'react-router'
import { LINK_CARD, LINK_STRETCH } from '../lib/cards'
import { SURVEY_YEARS, withUniverse, type CohortInfo, type Indicator } from '../lib/catalog'
import { seriesByYear, trendTest, type EstimateShard } from '../lib/data'
import { formatPct } from '../lib/format'
import { explorePath } from '../lib/routes'
import { changeKind, changeLabel, type ChangeKind } from '../lib/takeaways'
import { Sparkline } from './Sparkline'

const ARROW: Record<ChangeKind, string> = { fell: '↓', rose: '↑', same: '→' }

/** One overview tile: the latest value, a sparkline over the survey years and a change marker. */
export function HeadlineTile({ indicator, shard, cohort }: { indicator: Indicator; shard: EstimateShard; cohort: CohortInfo }) {
  const series = seriesByYear(shard)
  const shown = series.filter((d) => !d.cell.suppressed)
  const latest = shown[shown.length - 1]
  const first = shown[0]
  const test = latest && first && first.year !== latest.year ? trendTest(shard, null, null, first.year, latest.year) : null
  const kind = test ? changeKind(test.diff, test.pValue) : null
  const points = series.map((d) => ({ year: d.year, p: d.cell.p }))
  return (
    <li className={LINK_CARD}>
      <h3 className="m-0 font-display text-base font-bold leading-snug text-ink">
        <Link to={explorePath(cohort.id, indicator.id)} className={LINK_STRETCH}>
          {indicator.label}
          <span aria-hidden="true" className="ml-1 inline-block transition group-hover:translate-x-0.5">→</span>
        </Link>
      </h3>
      {latest ? (
        <>
          <p className="m-0 mt-3 font-display text-5xl font-extrabold leading-none text-ink">{formatPct(latest.cell.p as number)}</p>
          <p className="m-0 mt-1 text-sm text-ink-2">
            of {withUniverse(cohort.phrase, indicator)}
            {indicator.universe_phrase ? ` (${latest.year})` : ` in ${latest.year}`}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Sparkline points={points} years={SURVEY_YEARS} />
            {first.year !== latest.year ? (
              <span className="tabular text-xs font-medium text-ink-2" data-testid="first-last">
                {formatPct(first.cell.p as number)} → {formatPct(latest.cell.p as number)}
              </span>
            ) : null}
          </div>
          {kind ? (
            <p className="m-0 mt-3">
              <span className="rounded-full bg-surface-tint px-3 py-1 text-xs font-semibold text-ink" data-change={kind}>
                <span aria-hidden="true">{ARROW[kind]} </span>
                {changeLabel(kind, first.year)}
              </span>
            </p>
          ) : null}
        </>
      ) : (
        <p className="m-0 mt-3 text-ink-2">Not enough responses to report this reliably.</p>
      )}
    </li>
  )
}
