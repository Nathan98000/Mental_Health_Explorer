import { useEffect, useId } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { CohortSwitcher } from '../components/CohortSwitcher'
import { CrisisNote } from '../components/CrisisNote'
import { Filters } from '../components/Filters'
import { IndicatorSelect } from '../components/IndicatorSelect'
import { Notices } from '../components/Notices'
import { ScrollTable } from '../components/ScrollTable'
import { Loading, LoadError } from '../components/Status'
import { SuppressedValue } from '../components/SuppressedValue'
import { TrendChart } from '../components/TrendChart'
import { cohortInfo, firstYear, isSuicideMeasure, latestYear, SURVEY_YEARS, withUniverse, type Catalog } from '../lib/catalog'
import { loadEstimates, type Cell } from '../lib/data'
import { citation, safeFilename, toCsv } from '../lib/exports'
import { formatPct, formatPoints } from '../lib/format'
import { absoluteUrl, explorePath, resolveTrends, splitGroups, trendsCohortPath, trendsPath, type TrendsState } from '../lib/routes'
import { paletteKind, seriesColors, useChartTheme } from '../lib/theme'
import { comparisons, trendData } from '../lib/trends'
import { useCatalog } from '../lib/useCatalog'
import { DocumentTitle } from '../lib/useDocumentTitle'
import { usePrefetchShard } from '../lib/usePrefetchShard'
import { useResource } from '../lib/useResource'

function cellText(cell: Cell | undefined) {
  if (!cell) return <span className="text-muted">Not available</span>
  if (cell.suppressed || cell.p === null) return <SuppressedValue reason={cell.reason} />
  return formatPct(cell.p, 1)
}

type ViewProps = { catalog: Catalog; state: TrendsState; normalized: string; notices: string[] }

function TrendsView({ catalog, state, normalized, notices }: ViewProps) {
  const { cohort, indicator, split, yearA, yearB } = state
  const navigate = useNavigate()
  const theme = useChartTheme()
  const ids = { indicator: useId(), split: useId(), a: useId(), b: useId() }
  const info = cohortInfo(catalog, cohort)
  const shard = useResource(`estimates/${cohort}/${indicator.id}`, () => loadEstimates(cohort, indicator.id))
  const go = (next: Partial<{ indicator: string; split: string | null; yearA: number; yearB: number }>) =>
    navigate(trendsPath(cohort, next.indicator ?? indicator.id, { split: 'split' in next ? next.split : split?.id, yearA: next.yearA ?? yearA, yearB: next.yearB ?? yearB }))
  const span = `${firstYear(indicator)}–${latestYear(indicator)}`
  const title = `${indicator.label}, ${span}`
  const population = `${withUniverse(info.phrase, indicator)}${split ? `, by ${split.label.toLowerCase()}` : ''}`
  const data = shard.status === 'ready' ? trendData(catalog, shard.data, state) : null
  const comps = shard.status === 'ready' ? comparisons(catalog, shard.data, state) : []
  const significant = comps.filter((c) => c.kind === 'fell' || c.kind === 'rose').map((c) => c.label)
  const selectClass = 'w-full max-w-full rounded-xl border border-line bg-surface px-3 py-2 text-base text-ink'
  const suicide = isSuicideMeasure(indicator.id)
  const noSplit = `No split (all ${info.people})`
  const cite = citation({ title: `${indicator.label}: ${population}, ${span}`, url: absoluteUrl(normalized) })

  return (
    <>
      <DocumentTitle title={`Trends: ${indicator.label} · ${info.label}`} />
      <p className="m-0 text-sm font-semibold uppercase tracking-wide text-primary-ink">Trends</p>
      <h1 className="m-0 mt-1 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">{indicator.label}</h1>
      <Filters summary={`${info.label} · ${split ? split.label : 'No split'} · ${yearA} vs ${yearB}`}>
        <div className="min-w-0">
          <span className="mb-1 block text-sm font-semibold text-ink-2">Age group</span>
          <CohortSwitcher catalog={catalog} cohort={cohort} hrefFor={(c) => trendsCohortPath(catalog, state, c)} />
        </div>
        <div className="min-w-0">
          <label htmlFor={ids.indicator} className="mb-1 block text-sm font-semibold text-ink-2">Measure</label>
          <IndicatorSelect id={ids.indicator} catalog={catalog} cohort={cohort} value={indicator.id} onChange={(id) => go({ indicator: id })} />
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <div className="min-w-0">
            <label htmlFor={ids.split} className="mb-1 block text-sm font-semibold text-ink-2">Split by</label>
            <select id={ids.split} value={split?.id ?? ''} title={split?.label ?? noSplit} onChange={(e) => go({ split: e.target.value || null })} className={selectClass}>
              <option value="">{noSplit}</option>
              {splitGroups(catalog, cohort).map((g) => (
                <option key={g.id} value={g.id}>{g.label}</option>
              ))}
            </select>
            <p className="m-0 mt-1 text-xs text-muted">
              Race and ethnicity has more groups than fit on one chart;{' '}
              <Link to={explorePath(cohort, indicator.id, { yearSet: String(yearB), group: 'race_ethnicity', level: 'white' })} className="text-primary-ink underline">
                compare them on the Explore page
              </Link>
              .
            </p>
          </div>
          <div className="min-w-0">
            <label htmlFor={ids.a} className="mb-1 block text-sm font-semibold text-ink-2">Compare from</label>
            <select id={ids.a} value={yearA} title={String(yearA)} onChange={(e) => go({ yearA: Number(e.target.value) })} className={selectClass}>
              {indicator.years.filter((y) => y < yearB).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <label htmlFor={ids.b} className="mb-1 block text-sm font-semibold text-ink-2">Compare to</label>
            <select id={ids.b} value={yearB} title={String(yearB)} onChange={(e) => go({ yearB: Number(e.target.value) })} className={selectClass}>
              {indicator.years.filter((y) => y > yearA).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </Filters>
      <Notices items={notices} />
      {suicide ? (
        <div className="mt-6">
          <CrisisNote />
        </div>
      ) : null}

      {shard.status === 'ready' ? (
        <section className="mt-6 rounded-3xl bg-surface p-6 ring-1 ring-line" aria-labelledby="compare-years">
          <h2 id="compare-years" className="m-0 font-display text-lg font-bold text-ink">{yearA} compared with {yearB}</h2>
          <ScrollTable label={`${yearA} compared with ${yearB}, as a table`}>
            <table className="tabular mt-3 w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-ink-2">
                  <th scope="col" className="border-b border-line py-2 pr-4 font-semibold">Population</th>
                  <th scope="col" className="border-b border-line py-2 pr-4 font-semibold">Statistically significant?</th>
                  <th scope="col" className="border-b border-line py-2 pr-4 font-semibold">{yearA}</th>
                  <th scope="col" className="border-b border-line py-2 pr-4 font-semibold">{yearB}</th>
                  <th scope="col" className="border-b border-line py-2 pr-4 font-semibold">Change</th>
                </tr>
              </thead>
              <tbody>
                {comps.map((c) => (
                  <tr key={c.label}>
                    <th scope="row" className="border-b border-line py-2 pr-4 text-left font-medium">{c.label}</th>
                    <td className="border-b border-line py-2 pr-4">
                      {c.kind === 'fell' ? 'Yes, it fell' : c.kind === 'rose' ? 'Yes, it rose' : c.kind === 'same' ? 'No, about the same' : 'Not testable'}
                    </td>
                    <td className="border-b border-line py-2 pr-4">{cellText(c.a)}</td>
                    <td className="border-b border-line py-2 pr-4">{cellText(c.b)}</td>
                    <td className="border-b border-line py-2 pr-4">{c.test ? formatPoints(c.test.diff) : <span className="text-muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <p className="m-0 mt-3 text-sm text-muted">
            We call a change real only when it&apos;s unlikely to be chance (p &lt; 0.05). It does not say why the change happened.{' '}
            <Link to="/methods#how-computed" className="text-primary-ink underline">See Methods.</Link>
          </p>
        </section>
      ) : null}

      <div className="mt-6 rounded-3xl bg-surface p-6 ring-1 ring-line">
        {shard.status === 'loading' ? (
          <Loading className="min-h-96" />
        ) : shard.status === 'error' || !data ? (
          <LoadError />
        ) : (
          <TrendChart
            title={title}
            rows={data.rows}
            series={data.series}
            years={SURVEY_YEARS}
            colors={seriesColors(theme, data.series.length, paletteKind(split))}
            caption={`Share of U.S. ${population}.`}
            annotations={data.annotations}
            notes={data.notes}
            comparison={{ yearA, yearB, significant }}
            exports={{ csv: toCsv(data.csv), filename: safeFilename(`${cohort}-${indicator.id}-trend${split ? `-by-${split.id}` : ''}`), citation: cite, subtitle: `${population} · ${span}` }}
          />
        )}
      </div>
    </>
  )
}

export default function Trends() {
  const params = useParams<{ cohort: string; indicator: string }>()
  const [search] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const catalog = useCatalog()
  usePrefetchShard(params.cohort, params.indicator)
  const resolved = catalog.status === 'ready' ? resolveTrends(catalog.data, params.cohort, params.indicator, search) : null
  const here = `${location.pathname}${location.search}`
  const target = resolved && resolved.normalized !== here ? resolved.normalized : null
  const pending = target ? resolved?.notices.join('\n') : null
  useEffect(() => {
    if (target) navigate(target, { replace: true, state: { notices: pending ? pending.split('\n') : [] } })
  }, [target, pending, navigate])
  if (catalog.status === 'loading') return <Loading what="the catalog" />
  if (catalog.status === 'error' || !resolved) return <LoadError what="The catalog" />
  const carried = (location.state as { notices?: string[] } | null)?.notices ?? []
  const notices = resolved.notices.length ? resolved.notices : carried
  return <TrendsView key={`${resolved.state.cohort}/${resolved.state.indicator.id}`} catalog={catalog.data} state={resolved.state} normalized={resolved.normalized} notices={notices} />
}
