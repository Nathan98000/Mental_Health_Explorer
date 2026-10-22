import { Link } from 'react-router'
import { LINK_CARD, LINK_STRETCH } from '../lib/cards'
import { SURVEY_YEARS, withUniverse, type CohortInfo, type Indicator } from '../lib/catalog'
import { seriesByYear, type EstimateShard, type YearPoint } from '../lib/data'
import { formatShare } from '../lib/format'
import { explorePath } from '../lib/routes'
import { tileChange, type ChangeKind } from '../lib/takeaways'
import { Sparkline } from './Sparkline'

/** A tile's first and latest reported years and, when they differ and were tested, the change between them. */
export type TileTrend = { first?: YearPoint; latest?: YearPoint; kind: ChangeKind | null }

type Props = {
  indicator: Indicator
  shard: EstimateShard
  cohort: CohortInfo
  /** The change the tile reports, worked out by the overview so its summary sentence uses the same rule. */
  trend: TileTrend
  /** The headline this measure is part of, when it is also on the page: its latest value and phrase. */
  partOf?: { p: number; phrase: string } | null
}

/** One overview tile: the latest value, a sparkline over the survey years and the change since the first year. */
export function HeadlineTile({ indicator, shard, cohort, trend, partOf }: Props) {
  const series = seriesByYear(shard)
  const { first, latest, kind } = trend
  const points = series.map((d) => ({ year: d.year, p: d.cell.p }))
  const change = kind && first && latest ? tileChange(kind, first.cell.p as number, first.year, latest.cell.p as number) : null
  const arrow = change && /^[↓↑] /.test(change) ? change[0] : null
  return (
    <li className={LINK_CARD}>
      <h3 className="m-0 font-display text-h3 font-bold text-ink">
        <Link to={explorePath(cohort.id, indicator.id)} className={LINK_STRETCH}>
          {indicator.label}
          <span aria-hidden="true" className="ml-1 inline-block transition group-hover:translate-x-0.5">→</span>
        </Link>
      </h3>
      {latest ? (
        <>
          <p className="tabular m-0 mt-3 font-display text-display font-extrabold text-ink" data-testid="tile-value">{formatShare(latest.cell.p as number)}</p>
          <p className="m-0 mt-1 text-sm text-ink-2">
            of {withUniverse(cohort.phrase, indicator)}
            {indicator.universe_phrase ? ` (${latest.year})` : ` in ${latest.year}`}
          </p>
          <div className="mt-3 w-fit">
            <Sparkline points={points} years={SURVEY_YEARS} />
            <p className="tabular m-0 flex justify-between text-xs text-muted" aria-hidden="true">
              <span>{SURVEY_YEARS[0]}</span>
              <span>{SURVEY_YEARS[SURVEY_YEARS.length - 1]}</span>
            </p>
          </div>
          {kind && change ? (
            <p className="m-0 mt-3 w-fit rounded-full bg-surface-cool px-3 py-1 text-sm font-semibold text-ink" data-change={kind}>
              {arrow ? (
                <>
                  <span aria-hidden="true">{arrow} </span>
                  {change.slice(2)}
                </>
              ) : (
                change
              )}
            </p>
          ) : null}
          {/* Under the change line, so the sparklines line up across a row. */}
          {partOf ? <p className="m-0 mt-2 text-sm text-ink-2">Part of the {formatShare(partOf.p)} who {partOf.phrase}.</p> : null}
        </>
      ) : (
        <p className="m-0 mt-3 text-ink-2">Not enough responses to report this reliably.</p>
      )}
    </li>
  )
}
