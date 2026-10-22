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
import { capitalize, citation, safeFilename, toCsv } from '../lib/exports'
import { formatSharePair } from '../lib/format'
import { absoluteUrl, explorePath, resolveTrends, splitGroups, trendsCohortPath, trendsPath, type TrendsState } from '../lib/routes'
import { paletteKind, seriesColors, useChartTheme } from '../lib/theme'
import { comparisons, trendData, trendHeadline, type Comparison } from '../lib/trends'
import { useCatalog } from '../lib/useCatalog'
import { DocumentTitle } from '../lib/useDocumentTitle'
import { usePrefetchShard } from '../lib/usePrefetchShard'
import { useResource } from '../lib/useResource'

function reported(cell: Cell | undefined): cell is Cell & { p: number } {
  return !!cell && !cell.suppressed && cell.p !== null
}

/** The two years' values for one row, formatted together under the pair rule. */
function rowValues(c: Comparison) {
  const pair = reported(c.a) && reported(c.b) ? formatSharePair(c.a.p, c.b.p) : null
  const one = (cell: Cell | undefined, i: 0 | 1) => {
    if (!cell) return <span className="text-muted">Not available</span>
    if (!reported(cell)) return <SuppressedValue reason={cell.reason} />
    return pair ? pair[i] : formatSharePair(cell.p, cell.p)[0]
  }
  return [one(c.a, 0), one(c.b, 1)]
}

function changeText(c: Comparison) {
  const points = c.test ? `${Math.abs(c.test.diff * 100).toFixed(1)} points` : ''
  if (c.kind === 'fell') return `Fell ${points}`
  if (c.kind === 'rose') return `Rose ${points}`
  if (c.kind === 'same') return 'About the same'
  return <span className="text-muted">Can&apos;t be compared</span>
}

type ViewProps = { catalog: Catalog; state: TrendsState; normalized: string; notices: string[] }

function TrendsView({ catalog, state, normalized, notices }: ViewProps) {
  const { cohort, indicator, split, yearA, yearB } = state
  const navigate = useNavigate()
  const theme = useChartTheme()
  const ids = { indicator: useId(), split: useId(), a: useId(), b: useId(), headline: useId() }
  const info = cohortInfo(catalog, cohort)
  const shard = useResource(`estimates/${cohort}/${indicator.id}`, () => loadEstimates(cohort, indicator.id))
  const go = (next: Partial<{ indicator: string; split: string | null; yearA: number; yearB: number }>) =>
    navigate(trendsPath(cohort, next.indicator ?? indicator.id, { split: 'split' in next ? next.split : split?.id, yearA: next.yearA ?? yearA, yearB: next.yearB ?? yearB }))
  const span = `${firstYear(indicator)}–${latestYear(indicator)}`
  const population = `${withUniverse(info.phrase, indicator)}${split ? `, by ${split.label.toLowerCase()}` : ''}`
  const data = shard.status === 'ready' ? trendData(catalog, shard.data, state) : null
  const comps = shard.status === 'ready' ? comparisons(catalog, shard.data, state) : []
  const selectClass = 'w-full max-w-full rounded-xl border border-line bg-surface px-3 py-2 text-base text-ink'
  const suicide = isSuicideMeasure(indicator.id)
  const noSplit = `No split (all ${info.people})`
  const cite = citation({ title: `${indicator.label}: ${population}, ${span}`, url: absoluteUrl(normalized) })
  // The h1 names the measure, so the chart heading names the scope.
  const heading = `${capitalize(population)}, ${span}`

  return (
    <>
      <DocumentTitle title={`Trends: ${indicator.label} · ${info.label}`} />
      <Notices items={notices} />
      <p className="m-0 text-sm font-semibold uppercase tracking-wide text-primary-ink">Trends</p>
      <h1 className="m-0 mt-1 font-display text-h1 font-extrabold tracking-tight text-ink">{indicator.label}</h1>
      {shard.status === 'ready' ? (
        <p id={ids.headline} data-testid="trend-headline" className="m-0 mt-3 max-w-3xl text-lede text-ink">
          {trendHeadline(catalog, state, comps)}
        </p>
      ) : null}
      <p className="m-0 mt-2 text-sm">
        <Link to={explorePath(cohort, indicator.id)} className="font-semibold text-primary-ink underline">
          See the latest estimate and compare groups <span aria-hidden="true">→</span>
        </Link>
      </p>
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
      {suicide ? (
        <div className="mt-6">
          <CrisisNote />
        </div>
      ) : null}

      <div className="mt-6 rounded-2xl bg-surface p-4 shadow-[0_2px_0_var(--line),0_12px_32px_-18px_rgba(30,34,64,0.35)] ring-1 ring-line sm:p-6">
        {shard.status === 'loading' ? (
          <Loading className="min-h-96" />
        ) : shard.status === 'error' || !data ? (
          <LoadError />
        ) : (
          <TrendChart
            title={heading}
            measure={indicator.label}
            describedBy={ids.headline}
            rows={data.rows}
            series={data.series}
            years={SURVEY_YEARS}
            colors={seriesColors(theme, data.series.length, paletteKind(split))}
            caption={`Share of U.S. ${population}.`}
            annotations={data.annotations}
            notes={data.notes}
            comparison={{ yearA, yearB }}
            exports={{
              csv: toCsv(data.csv),
              filename: safeFilename(`${cohort}-${indicator.id}-trend${split ? `-by-${split.id}` : ''}`),
              citation: cite,
              subtitle: capitalize(`${population} · ${span}`),
              url: absoluteUrl(normalized),
              crisis: suicide,
            }}
          />
        )}
      </div>

      {shard.status === 'ready' ? (
        <section className="mt-10 border-t border-line pt-8 sm:mt-12" aria-labelledby="compare-years">
          <h2 id="compare-years" className="m-0 font-display text-h2 font-bold text-ink">{yearA} compared with {yearB}</h2>
          <ScrollTable label={`${yearA} compared with ${yearB}, as a table`}>
            <table className="tabular mt-3 w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-ink-2">
                  <th scope="col" className="border-b border-line py-2 pr-4 font-semibold">Population</th>
                  <th scope="col" className="border-b border-line py-2 pr-4 font-semibold">{yearA}</th>
                  <th scope="col" className="border-b border-line py-2 pr-4 font-semibold">{yearB}</th>
                  <th scope="col" className="border-b border-line py-2 font-semibold">Change</th>
                </tr>
              </thead>
              <tbody>
                {comps.map((c) => {
                  const [a, b] = rowValues(c)
                  return (
                    <tr key={c.label}>
                      <th scope="row" className="border-b border-line py-2 pr-4 text-left font-medium">{c.label}</th>
                      <td className="border-b border-line py-2 pr-4">{a}</td>
                      <td className="border-b border-line py-2 pr-4">{b}</td>
                      <td className="border-b border-line py-2">{changeText(c)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </ScrollTable>
          <p className="m-0 mt-3 text-sm text-muted">
            &ldquo;Fell&rdquo; and &ldquo;Rose&rdquo; mean the change is statistically significant: too large to be explained by chance differences in who was
            surveyed (p &lt; 0.05). They don&apos;t explain why a change happened. Points are percentage points.{' '}
            <Link to="/methods#key-terms" className="text-primary-ink underline">See Methods.</Link>
          </p>
          <p className="m-0 mt-3 text-sm text-ink-2">
            Race and ethnicity has more groups than fit on one chart;{' '}
            <Link to={explorePath(cohort, indicator.id, { yearSet: String(yearB), group: 'race_ethnicity', level: 'white' })} className="text-primary-ink underline">
              compare them on the Explore page
            </Link>
            .
          </p>
        </section>
      ) : null}
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
