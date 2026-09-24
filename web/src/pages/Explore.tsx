import { useEffect, useId } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { ChartExports } from '../components/ChartExports'
import { CohortSwitcher } from '../components/CohortSwitcher'
import { CrisisNote } from '../components/CrisisNote'
import { EstimateCard } from '../components/EstimateCard'
import { Filters } from '../components/Filters'
import { GroupDotPlot } from '../components/GroupDotPlot'
import { IndicatorSelect } from '../components/IndicatorSelect'
import { Notices } from '../components/Notices'
import { Sparkline } from '../components/Sparkline'
import { Loading, LoadError } from '../components/Status'
import { cohortInfo, firstYear, groupsFor, isSuicideMeasure, latestYear, levelsFor, SURVEY_YEARS, withUniverse, yearSetLabel, yearSetsFor, yearSetSpan, type Catalog } from '../lib/catalog'
import { findCell, loadEstimates, seriesByYear, type EstimateShard } from '../lib/data'
import { citation, safeFilename, toCsv, type CsvRow } from '../lib/exports'
import { formatPct } from '../lib/format'
import { absoluteUrl, exploreCohortPath, explorePath, resolveExplore, trendsPath, type ExploreState } from '../lib/routes'
import { describeSparkline, labeledSparklineSvg } from '../lib/sparkline'
import { exploreSummary } from '../lib/summary'
import { useChartTheme } from '../lib/theme'
import { useCatalog } from '../lib/useCatalog'
import { DocumentTitle } from '../lib/useDocumentTitle'
import { usePrefetchShard } from '../lib/usePrefetchShard'
import { useResource } from '../lib/useResource'

function csvRows(shard: EstimateShard, state: ExploreState, population: string): CsvRow[] {
  const rows: CsvRow[] = []
  for (const yearSet of yearSetsFor(state.indicator)) {
    const cell = findCell(shard, yearSet, state.group?.id ?? null, state.level?.id ?? null)
    if (!cell) continue
    rows.push({
      cohort: state.cohort,
      measure: state.indicator.id,
      years: yearSetSpan(yearSet, state.indicator.years),
      population,
      p: cell.p,
      lo: cell.lo,
      hi: cell.hi,
      n: cell.n,
      suppressed: cell.suppressed,
      weight: shard.year_sets[yearSet]?.weight ?? '',
    })
  }
  return rows
}

type ViewProps = { catalog: Catalog; state: ExploreState; normalized: string; notices: string[] }

function ExploreView({ catalog, state, normalized, notices }: ViewProps) {
  const { cohort, indicator, yearSet, group, level } = state
  const navigate = useNavigate()
  const theme = useChartTheme()
  const ids = { indicator: useId(), year: useId(), population: useId() }
  const info = cohortInfo(catalog, cohort)
  const selectClass = 'w-full max-w-full rounded-xl border border-line bg-surface px-3 py-2 text-base text-ink'
  const shard = useResource(`estimates/${cohort}/${indicator.id}`, () => loadEstimates(cohort, indicator.id))
  const go = (next: Partial<{ indicator: string; yearSet: string; population: string }>) => {
    const [g, l] = (next.population ?? (group && level ? `${group.id}:${level.id}` : '')).split(':')
    navigate(explorePath(cohort, next.indicator ?? indicator.id, { yearSet: next.yearSet ?? yearSet, group: g || null, level: l || null }))
  }
  const summary = shard.status === 'ready' ? exploreSummary(catalog, shard.data, state) : null
  const series = shard.status === 'ready' ? seriesByYear(shard.data, group?.id ?? null, level?.id ?? null) : []
  const points = series.map((d) => ({ year: d.year, p: d.cell.suppressed ? null : d.cell.p }))
  const everyone = withUniverse(info.phrase, indicator)
  const population = summary?.population ?? everyone
  const span = `${firstYear(indicator)}–${latestYear(indicator)}`
  const chartTitle = `${indicator.label}: ${population}`
  const cite = citation({ title: chartTitle, url: absoluteUrl(normalized) })
  const selectedYear = Number(yearSet)
  const sorted = [...indicator.years].sort((a, b) => a - b)
  const pooled = yearSet === 'all' || yearSet === 'recent2'
  const pooledYears = yearSet === 'all' ? sorted : yearSet === 'recent2' ? sorted.slice(-2) : []
  const anyShown = points.some((d) => d.p !== null)
  const suppressed = summary?.cell ? summary.cell.suppressed || summary.cell.p === null : false
  const nextSteps = suppressed
    ? [
        ...(yearSet !== 'all' && indicator.years.length > 1 ? [{ label: 'Try all years combined', to: explorePath(cohort, indicator.id, { yearSet: 'all', group: group?.id, level: level?.id }) }] : []),
        ...(group && level ? [{ label: 'Try everyone', to: explorePath(cohort, indicator.id, { yearSet }) }] : []),
      ]
    : []

  return (
    <>
      <DocumentTitle title={`${indicator.label} · ${info.label}`} />
      <h1 className="m-0 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">{indicator.label}</h1>
      <Filters summary={`${info.label} · ${yearSetSpan(yearSet, indicator.years)} · ${level ? level.label : 'Everyone'}`}>
        <div className="min-w-0">
          <span className="mb-1 block text-sm font-semibold text-ink-2">Age group</span>
          <CohortSwitcher catalog={catalog} cohort={cohort} hrefFor={(c) => exploreCohortPath(catalog, state, c)} />
        </div>
        <div className="min-w-0">
          <label htmlFor={ids.indicator} className="mb-1 block text-sm font-semibold text-ink-2">Measure</label>
          <IndicatorSelect id={ids.indicator} catalog={catalog} cohort={cohort} value={indicator.id} onChange={(id) => go({ indicator: id })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="min-w-0">
            <label htmlFor={ids.year} className="mb-1 block text-sm font-semibold text-ink-2">Years</label>
            <select id={ids.year} value={yearSet} title={yearSetLabel(yearSet, indicator.years)} onChange={(e) => go({ yearSet: e.target.value })} className={selectClass}>
              {yearSetsFor(indicator).map((ys) => (
                <option key={ys} value={ys}>{yearSetLabel(ys, indicator.years)}</option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <label htmlFor={ids.population} className="mb-1 block text-sm font-semibold text-ink-2">Population</label>
            <select
              id={ids.population}
              value={group && level ? `${group.id}:${level.id}` : ''}
              title={level ? level.label : `Everyone (${everyone})`}
              onChange={(e) => go({ population: e.target.value })}
              className={selectClass}
            >
              <option value="">Everyone ({everyone})</option>
              {groupsFor(catalog, cohort).map((g) => (
                <optgroup key={g.id} label={g.label}>
                  {levelsFor(catalog, cohort, g).map((l) => (
                    <option key={l.id} value={`${g.id}:${l.id}`}>{l.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>
      </Filters>
      <Notices items={notices} />
      {isSuicideMeasure(indicator.id) ? (
        <div className="mt-6">
          <CrisisNote />
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="min-w-0">
          {shard.status === 'loading' ? (
            <Loading className="min-h-80" />
          ) : shard.status === 'error' ? (
            <LoadError />
          ) : summary?.cell ? (
            <EstimateCard when={summary.when} cell={summary.cell} sentences={summary.sentences} nextSteps={nextSteps} pooled={pooled} />
          ) : (
            <p className="rounded-3xl bg-surface p-6 text-ink-2 ring-1 ring-line" role="status">There is no estimate for this combination of years and population.</p>
          )}
          {shard.status === 'ready' && summary && group && level ? (
            <GroupDotPlot catalog={catalog} cohort={cohort} shard={shard.data} indicator={indicator} group={group} level={level} yearSet={yearSet} when={summary.when} people={withUniverse(info.people, indicator)} />
          ) : null}
        </div>
        <div className="min-w-0 space-y-4">
          <section className="rounded-3xl bg-surface p-6 ring-1 ring-line" aria-labelledby="about-measure">
            <h2 id="about-measure" className="m-0 font-display text-lg font-bold text-ink">About this measure</h2>
            <p className="m-0 mt-2 leading-relaxed text-ink">{indicator.definition}</p>
            <p className="m-0 mt-2 text-sm text-ink-2">
              In the survey&apos;s words: {indicator.universe_phrase ? `among ${info.people} ${indicator.universe_phrase}, those who ${indicator.phrase}` : `${info.people} who ${indicator.phrase}`}. Source variable{' '}
              <code className="rounded bg-surface-cool px-1">{indicator.source}</code> in the NSDUH public use file.
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
                  {anyShown ? (
                    <Sparkline
                      points={points}
                      years={SURVEY_YEARS}
                      width={240}
                      height={72}
                      highlightYear={indicator.years.includes(selectedYear) ? selectedYear : undefined}
                      shadeYears={pooledYears}
                      label={`${chartTitle}. ${describeSparkline(points, SURVEY_YEARS)}`}
                    />
                  ) : null}
                  <ul className="m-0 list-none p-0 text-sm text-ink-2">
                    {SURVEY_YEARS.map((y) => {
                      const point = points.find((d) => d.year === y)
                      const looking = y === selectedYear || pooledYears.includes(y)
                      return (
                        <li key={y} className={`tabular ${looking ? 'font-semibold text-ink' : ''}`} aria-current={looking ? 'true' : undefined}>
                          <span className="inline-block w-12 font-medium text-ink">{y}</span>
                          {!indicator.years.includes(y) ? 'Not available' : point && point.p !== null ? formatPct(point.p, 1) : 'Not reported'}
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
                <ChartExports
                  getSvg={anyShown ? () => labeledSparklineSvg(points, SURVEY_YEARS, { primary: theme.primary, line: theme.line, ink: theme.ink, muted: theme.muted }) : undefined}
                  csv={toCsv(csvRows(shard.data, state, summary.population))}
                  filename={safeFilename(`${cohort}-${indicator.id}-${summary.population}`)}
                  citation={cite}
                  frame={{ title: indicator.label, subtitle: `${population} · ${span}` }}
                />
              </>
            ) : null}
          </section>
        </div>
      </div>
    </>
  )
}

export default function Explore() {
  const params = useParams<{ cohort: string; indicator: string }>()
  const [search] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const catalog = useCatalog()
  usePrefetchShard(params.cohort, params.indicator)
  const resolved = catalog.status === 'ready' ? resolveExplore(catalog.data, params.cohort, params.indicator, search) : null
  const here = `${location.pathname}${location.search}`
  // The address bar always shows the canonical URL of what is on screen; the notices ride along in history state.
  const target = resolved && resolved.normalized !== here ? resolved.normalized : null
  const pending = target ? resolved?.notices.join('\n') : null
  useEffect(() => {
    if (target) navigate(target, { replace: true, state: { notices: pending ? pending.split('\n') : [] } })
  }, [target, pending, navigate])
  if (catalog.status === 'loading') return <Loading what="the catalog" />
  if (catalog.status === 'error' || !resolved) return <LoadError what="The catalog" />
  const carried = (location.state as { notices?: string[] } | null)?.notices ?? []
  const notices = resolved.notices.length ? resolved.notices : carried
  return <ExploreView key={`${resolved.state.cohort}/${resolved.state.indicator.id}`} catalog={catalog.data} state={resolved.state} normalized={resolved.normalized} notices={notices} />
}
