import { Link, useSearchParams } from 'react-router'
import { CohortSwitcher } from '../components/CohortSwitcher'
import { HeadlineTile } from '../components/HeadlineTile'
import { Loading, LoadError } from '../components/Status'
import { cohortInfo, findIndicator, type Catalog } from '../lib/catalog'
import { seriesByYear, type Cohort, type EstimateShard } from '../lib/data'
import { HEADLINES, SUBSET_OF } from '../lib/headlines'
import { DEFAULT_COHORT, explorePath, parseCohort, trendsPath } from '../lib/routes'
import { useCatalog } from '../lib/useCatalog'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { useEstimates } from '../lib/useEstimates'

const live = [
  { title: 'Explore any measure', to: (c: Cohort) => explorePath(c, 'mde_py') },
  { title: 'Trends', to: (c: Cohort) => trendsPath(c, 'mde_py') },
  { title: 'Methods', to: () => '/methods' },
] as const

/** The latest reported overall value in a shard, or null when every year is suppressed. */
function latestP(shard: EstimateShard | undefined): number | null {
  const shown = shard ? seriesByYear(shard).filter((d) => !d.cell.suppressed && d.cell.p !== null) : []
  return shown.length ? (shown[shown.length - 1].cell.p as number) : null
}

function Tiles({ catalog, cohort, shards }: { catalog: Catalog; cohort: Cohort; shards: Record<string, EstimateShard> }) {
  const info = cohortInfo(catalog, cohort)
  const ids = HEADLINES[cohort]
  return (
    <ul className="mt-5 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
      {ids.map((id) => {
        const indicator = findIndicator(catalog, cohort, id)
        const shard = shards[id]
        const parentId = SUBSET_OF[id]
        const parent = parentId && ids.includes(parentId) ? findIndicator(catalog, cohort, parentId) : undefined
        const parentP = parent ? latestP(shards[parent.id]) : null
        const partOf = parent && parentP !== null ? { p: parentP, phrase: parent.phrase } : null
        return indicator && shard ? <HeadlineTile key={id} indicator={indicator} shard={shard} cohort={info} partOf={partOf} /> : null
      })}
    </ul>
  )
}

export default function Home() {
  const [search] = useSearchParams()
  const cohort = parseCohort(search.get('cohort')) ?? DEFAULT_COHORT
  useDocumentTitle(null)
  const catalog = useCatalog()
  const estimates = useEstimates(cohort, HEADLINES[cohort])
  return (
    <>
      <section className="pt-4 sm:pt-8" data-testid="hero">
        <div className="max-w-2xl">
          <h1 className="m-0 font-display text-display font-extrabold tracking-tight text-ink">
            How are young people in the U.S. doing?
          </h1>
          <p className="m-0 mt-3 text-lede text-ink-2 sm:mt-4">
            Explore what a national survey of about 58,000 people each year says about depression, suicidal
            thoughts, substance use and getting help — for teens ages 12–17 and young adults ages 18–25.
          </p>
        </div>
        {catalog.status === 'ready' ? (
          <div className="mt-5">
            <CohortSwitcher catalog={catalog.data} cohort={cohort} />
          </div>
        ) : null}
      </section>

      <section className="mt-10 sm:mt-12" aria-labelledby="at-a-glance">
        <h2 id="at-a-glance" className="m-0 font-display text-h2 font-bold text-ink">At a glance</h2>
        <p className="m-0 mt-2 text-ink-2">The latest year for six headline measures, with the change since the first year each was asked. Select a measure to explore it.</p>
        {catalog.status === 'error' || estimates.status === 'error' ? (
          <LoadError />
        ) : catalog.status === 'loading' || estimates.status === 'loading' ? (
          <Loading />
        ) : (
          <Tiles catalog={catalog.data} cohort={cohort} shards={estimates.shards} />
        )}
      </section>

      <section className="mt-10 border-t border-line pt-8 sm:mt-12" aria-labelledby="explore-the-data">
        <h2 id="explore-the-data" className="m-0 font-display text-h2 font-bold text-ink">Explore the data</h2>
        <ul className="m-0 mt-4 flex list-none flex-wrap gap-x-8 gap-y-3 p-0 text-lede">
          {live.map((item) => (
            <li key={item.title}>
              <Link to={item.to(cohort)} className="font-semibold text-primary-ink underline">
                {item.title} <span aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <p className="m-0 mt-10 text-ink-2 sm:mt-12">Coming soon: who&apos;s most affected, what goes together, and an advanced mode.</p>
    </>
  )
}
