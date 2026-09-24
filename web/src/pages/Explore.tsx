import { useId, useRef } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { ChartExports } from '../components/ChartExports'
import { CohortSwitcher } from '../components/CohortSwitcher'
import { CrisisNote } from '../components/CrisisNote'
import { EstimateCard } from '../components/EstimateCard'
import { IndicatorSelect } from '../components/IndicatorSelect'
import { Sparkline } from '../components/Sparkline'
import { Loading, LoadError } from '../components/Status'
import { cohortInfo, findIndicator, groupsFor, isSuicideMeasure, levelsFor, SURVEY_YEARS, yearSetLabel, yearSetsFor, type Catalog } from '../lib/catalog'
import { findCell, loadEstimates, seriesByYear, type EstimateShard } from '../lib/data'
import { citation, safeFilename, toCsv, type CsvRow } from '../lib/exports'
import { formatPct } from '../lib/format'
import { describeSparkline } from '../lib/sparkline'
import { DEFAULT_INDICATOR, explorePath, resolveExplore, trendsPath, type ExploreState } from '../lib/routes'
import { exploreSummary } from '../lib/summary'
import { useCatalog } from '../lib/useCatalog'
import { DocumentTitle } from '../lib/useDocumentTitle'
import { usePrefetchShard } from '../lib/usePrefetchShard'
import { useResource } from '../lib/useResource'

function csvRows(shard: EstimateShard, state: ExploreState, population: string): CsvRow[] {
  const rows: CsvRow[] = []
  for (const yearSet of yearSetsFor(state.indicator)) {
    const cell = findCell(shard, yearSet, state.group?.id ?? null, state.level?.id ?? null)
    if (!cell) continue
    rows.push({ cohort: state.cohort, indicator: state.indicator.id, yearSet, weight: shard.year_sets[yearSet]?.weight ?? '', population, p: cell.p, lo: cell.lo, hi: cell.hi, n: cell.n, suppressed: cell.suppressed })
  }
  return rows
}

function ExploreView({ catalog, state }: { catalog: Catalog; state: ExploreState }) {
  const { cohort, indicator, yearSet, group, level } = state
  const navigate = useNavigate()
  const ids = { indicator: useId(), year: useId(), population: useId() }
  const sparkRef = useRef<SVGSVGElement>(null)
  const info = cohortInfo(catalog, cohort)
  const shard = useResource(`estimates/${cohort}/${indicator.id}`, () => loadEstimates(cohort, indicator.id))
  const go = (next: Partial<{ indicator: string; yearSet: string; population: string }>) => {
    const [g, l] = (next.population ?? (group && level ? `${group.id}:${level.id}` : '')).split(':')
    navigate(explorePath(cohort, next.indicator ?? indicator.id, { yearSet: next.yearSet ?? yearSet, group: g || null, level: l || null }))
  }
  const summary = shard.status === 'ready' ? exploreSummary(catalog, shard.data, state) : null
  const series = shard.status === 'ready' ? seriesByYear(shard.data, group?.id ?? null, level?.id ?? null) : []
  const points = series.map((d) => ({ year: d.year, p: d.cell.suppressed ? null : d.cell.p }))
  const chartTitle = `${indicator.label}: ${summary?.population ?? info.phrase}`
  const cite = citation({ title: chartTitle, url: window.location.href })

  return (
    <>
      <DocumentTitle title={`${indicator.label} · ${info.label}`} />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="m-0 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">{indicator.label}</h1>
        <CohortSwitcher catalog={catalog} cohort={cohort} hrefFor={(c) => explorePath(c, findIndicator(catalog, c, indicator.id)?.id ?? DEFAULT_INDICATOR)} />
      </div>
      <form className="mt-6 grid gap-4 rounded-3xl bg-surface p-5 ring-1 ring-line sm:grid-cols-3" onSubmit={(e) => e.preventDefault()} aria-label="Choose what to show">
        <div className="min-w-0">
          <label htmlFor={ids.indicator} className="mb-1 block text-sm font-semibold text-ink-2">Measure</label>
          <IndicatorSelect id={ids.indicator} catalog={catalog} cohort={cohort} value={indicator.id} onChange={(id) => go({ indicator: id })} />
        </div>
        <div className="min-w-0">
          <label htmlFor={ids.year} className="mb-1 block text-sm font-semibold text-ink-2">Years</label>
          <select id={ids.year} value={yearSet} onChange={(e) => go({ yearSet: e.target.value })} className="w-full max-w-full rounded-xl border border-line bg-surface px-3 py-2 text-base text-ink">
            {yearSetsFor(indicator).map((ys) => (
              <option key={ys} value={ys}>{yearSetLabel(ys, indicator.years)}</option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          <label htmlFor={ids.population} className="mb-1 block text-sm font-semibold text-ink-2">Population</label>
          <select id={ids.population} value={group && level ? `${group.id}:${level.id}` : ''} onChange={(e) => go({ population: e.target.value })} className="w-full max-w-full rounded-xl border border-line bg-surface px-3 py-2 text-base text-ink">
            <option value="">Everyone ({info.phrase})</option>
            {groupsFor(catalog, cohort).map((g) => (
              <optgroup key={g.id} label={g.label}>
                {levelsFor(catalog, cohort, g).map((l) => (
                  <option key={l.id} value={`${g.id}:${l.id}`}>{l.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </form>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="min-w-0">
          {shard.status === 'loading' ? (
            <Loading className="min-h-80" />
          ) : shard.status === 'error' ? (
            <LoadError />
          ) : summary?.cell ? (
            <EstimateCard when={summary.when} cell={summary.cell} population={summary.population} sentences={summary.sentences} />
          ) : (
            <p className="rounded-3xl bg-surface p-6 text-ink-2 ring-1 ring-line" role="status">There is no estimate for this combination of years and population.</p>
          )}
        </div>
        <div className="min-w-0 space-y-4">
          <section className="rounded-3xl bg-surface p-6 ring-1 ring-line" aria-labelledby="about-measure">
            <h2 id="about-measure" className="m-0 font-display text-lg font-bold text-ink">About this measure</h2>
            <p className="m-0 mt-2 leading-relaxed text-ink">{indicator.definition}</p>
            <p className="m-0 mt-2 text-sm text-ink-2">
              In the survey&apos;s words: {info.people} who {indicator.phrase}. Source variable <code className="rounded bg-surface-cool px-1">{indicator.source}</code> in the NSDUH public use file.
            </p>
            {indicator.caveats.length ? (
              <ul className="mt-2 mb-0 list-disc space-y-1 pl-5 text-sm text-ink-2">
                {indicator.caveats.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            ) : null}
          </section>
          <section className="rounded-3xl bg-surface p-6 ring-1 ring-line" aria-labelledby="over-time">
            <h2 id="over-time" className="m-0 font-display text-lg font-bold text-ink">Over time</h2>
            {shard.status === 'ready' && summary ? (
              <>
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <Sparkline ref={sparkRef} points={points} years={SURVEY_YEARS} width={240} height={72} label={`${chartTitle}. ${describeSparkline(points, SURVEY_YEARS)}`} />
                  <ul className="m-0 list-none p-0 text-sm text-ink-2">
                    {SURVEY_YEARS.map((y) => {
                      const point = points.find((d) => d.year === y)
                      return (
                        <li key={y} className="tabular">
                          <span className="inline-block w-12 font-medium text-ink">{y}</span>
                          {!indicator.years.includes(y) ? 'Not asked' : point && point.p !== null ? formatPct(point.p, 1) : 'Not reported'}
                        </li>
                      )
                    })}
                  </ul>
                </div>
                <p className="m-0 mt-3">
                  <Link to={trendsPath(cohort, indicator.id, { split: group?.id ?? null })} className="font-semibold text-primary-ink underline">
                    See the full trend with confidence intervals and compare years
                  </Link>
                </p>
                <ChartExports getSvg={() => sparkRef.current} csv={toCsv(csvRows(shard.data, state, summary.population))} filename={safeFilename(`${cohort}-${indicator.id}-${summary.population}`)} citation={cite} />
              </>
            ) : null}
          </section>
          {isSuicideMeasure(indicator.id) ? <CrisisNote /> : null}
        </div>
      </div>
    </>
  )
}

export default function Explore() {
  const params = useParams<{ cohort: string; indicator: string }>()
  const [search] = useSearchParams()
  const catalog = useCatalog()
  usePrefetchShard(params.cohort, params.indicator)
  if (catalog.status === 'loading') return <Loading what="the catalog" />
  if (catalog.status === 'error') return <LoadError what="The catalog" />
  const { redirect, state } = resolveExplore(catalog.data, params.cohort, params.indicator, search)
  if (redirect) return <Navigate replace to={redirect} />
  return <ExploreView key={`${state.cohort}/${state.indicator.id}`} catalog={catalog.data} state={state} />
}
