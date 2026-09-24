import { Link, useSearchParams } from 'react-router'
import { CohortSwitcher } from '../components/CohortSwitcher'
import { HeadlineTile } from '../components/HeadlineTile'
import { Loading, LoadError } from '../components/Status'
import { LINK_CARD, LINK_STRETCH } from '../lib/cards'
import { cohortInfo, findIndicator, type Catalog } from '../lib/catalog'
import type { Cohort, EstimateShard } from '../lib/data'
import { HEADLINES } from '../lib/headlines'
import { DEFAULT_COHORT, explorePath, parseCohort, trendsPath } from '../lib/routes'
import { useCatalog } from '../lib/useCatalog'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { useEstimates } from '../lib/useEstimates'

const live = [
  { title: 'Explore any measure', body: 'Depression, suicidal thoughts, substance use, school and family life — for teens and young adults, by year and population.', shape: 'circle', to: (c: Cohort) => explorePath(c, 'mde_py') },
  { title: 'Trends', body: 'See how each measure changed from 2021 to 2024, split by sex, age, income and more, and whether the change is real.', shape: 'wave', to: (c: Cohort) => trendsPath(c, 'mde_py') },
  { title: 'Methods', body: 'Where the numbers come from, how sure we can be, every measure defined, and how to cite them.', shape: 'lines', to: () => '/methods' },
] as const

const upcoming = [
  { title: "Who's most affected", body: 'Compare by sex, race and ethnicity, family income, insurance and where people live.', shape: 'bars' },
  { title: 'What goes together', body: 'For example, how common depression is among teens who vape compared with teens who don’t.', shape: 'rings' },
  { title: 'Advanced mode', body: 'Run your own cross-tabulations in the browser, with the same statistical rules.', shape: 'sliders' },
] as const

type ShapeKind = 'circle' | 'wave' | 'bars' | 'dots' | 'lines' | 'rings' | 'sliders'

function Shape({ kind }: { kind: ShapeKind }) {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
      <rect width="44" height="44" rx="14" fill="var(--surface-tint)" />
      {kind === 'circle' && <circle cx="22" cy="22" r="10" fill="var(--sun)" />}
      {kind === 'wave' && <path d="M8 28c5-10 9-10 14 0s9 10 14 0" fill="none" stroke="var(--primary)" strokeWidth="4" strokeLinecap="round" />}
      {kind === 'bars' && (
        <g fill="var(--accent)">
          <rect x="10" y="22" width="6" height="12" rx="3" />
          <rect x="19" y="14" width="6" height="20" rx="3" />
          <rect x="28" y="18" width="6" height="16" rx="3" />
        </g>
      )}
      {kind === 'dots' && (
        <g>
          <circle cx="16" cy="22" r="7" fill="var(--primary)" />
          <circle cx="28" cy="22" r="7" fill="var(--sun)" opacity="0.9" />
        </g>
      )}
      {kind === 'lines' && (
        <g stroke="var(--primary)" strokeWidth="4" strokeLinecap="round">
          <path d="M12 15h20M12 22h20M12 29h12" />
        </g>
      )}
      {kind === 'rings' && (
        <g fill="none" strokeWidth="4">
          <circle cx="18" cy="22" r="9" stroke="var(--primary)" />
          <circle cx="27" cy="22" r="9" stroke="var(--accent)" />
        </g>
      )}
      {kind === 'sliders' && (
        <g strokeLinecap="round" strokeWidth="4">
          <path d="M11 16h22M11 28h22" stroke="var(--primary)" />
          <circle cx="18" cy="16" r="4" fill="var(--sun)" />
          <circle cx="27" cy="28" r="4" fill="var(--sun)" />
        </g>
      )}
    </svg>
  )
}

function Tiles({ catalog, cohort, shards }: { catalog: Catalog; cohort: Cohort; shards: Record<string, EstimateShard> }) {
  const info = cohortInfo(catalog, cohort)
  return (
    <ul className="mt-5 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
      {HEADLINES[cohort].map((id) => {
        const indicator = findIndicator(catalog, cohort, id)
        const shard = shards[id]
        return indicator && shard ? <HeadlineTile key={id} indicator={indicator} shard={shard} cohort={info} /> : null
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
      <section className="relative overflow-hidden rounded-[2rem] bg-surface-tint px-5 py-8 sm:px-10 sm:py-16">
        <svg className="pointer-events-none absolute -right-16 -top-16 hidden h-64 w-64 opacity-70 sm:block dark:opacity-35" viewBox="0 0 200 200" aria-hidden="true">
          <circle cx="100" cy="100" r="90" fill="var(--sun)" />
        </svg>
        <svg className="pointer-events-none absolute -bottom-20 right-24 hidden h-48 w-48 opacity-40 sm:block dark:opacity-25" viewBox="0 0 200 200" aria-hidden="true">
          <circle cx="100" cy="100" r="90" fill="var(--primary)" />
        </svg>
        <div className="relative max-w-2xl">
          <h1 className="m-0 font-display text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">
            How are young people in the U.S. doing?
          </h1>
          <p className="m-0 mt-3 text-base leading-relaxed text-ink-2 sm:mt-4 sm:text-lg">
            Explore what a national survey of about 58,000 people each year says about depression, suicidal
            thoughts, substance use and getting help — for teens ages 12–17 and young adults ages 18–25.
          </p>
        </div>
      </section>

      <p className="mt-6 rounded-2xl border border-dashed border-line bg-surface px-4 py-3 text-sm text-ink-2" role="note">
        <strong className="text-ink">Early preview.</strong> This site is still being built. Numbers are computed from the
        survey and checked against SAMHSA&apos;s reference tables; a final review happens before launch.
      </p>

      <section className="mt-10" aria-labelledby="at-a-glance">
        <div className="flex min-h-11 flex-wrap items-center justify-between gap-4">
          <h2 id="at-a-glance" className="m-0 font-display text-2xl font-extrabold text-ink">At a glance</h2>
          {catalog.status === 'ready' ? <CohortSwitcher catalog={catalog.data} cohort={cohort} /> : null}
        </div>
        <p className="m-0 mt-2 text-ink-2">The latest year for six headline measures, with the change since the first year each was asked. Select a measure to explore it.</p>
        {catalog.status === 'error' || estimates.status === 'error' ? (
          <LoadError />
        ) : catalog.status === 'loading' || estimates.status === 'loading' ? (
          <Loading />
        ) : (
          <Tiles catalog={catalog.data} cohort={cohort} shards={estimates.shards} />
        )}
      </section>

      <section className="mt-14" aria-labelledby="explore-the-data">
        <h2 id="explore-the-data" className="m-0 font-display text-2xl font-extrabold text-ink">Explore the data</h2>
        <ul className="mt-5 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {live.map((item) => (
            <li key={item.title} className={LINK_CARD}>
              <Shape kind={item.shape} />
              <h3 className="m-0 mt-3 font-display text-lg font-bold text-ink">
                <Link to={item.to(cohort)} className={LINK_STRETCH}>
                  {item.title}
                  <span aria-hidden="true" className="ml-1 inline-block transition group-hover:translate-x-0.5">→</span>
                </Link>
              </h3>
              <p className="m-0 mt-1 text-sm leading-relaxed text-ink-2">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14" aria-labelledby="coming-soon">
        <h2 id="coming-soon" className="m-0 font-display text-2xl font-extrabold text-ink">Coming soon</h2>
        <ul className="mt-5 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {upcoming.map((item) => (
            <li key={item.title} className="rounded-3xl border-2 border-dashed border-line bg-surface p-5 text-muted">
              <div className="flex items-start justify-between gap-3">
                <Shape kind={item.shape} />
                <span className="rounded-full bg-surface-cool px-2.5 py-0.5 text-xs font-semibold text-ink-2">Coming soon</span>
              </div>
              <h3 className="m-0 mt-3 font-display text-lg font-bold text-ink-2">{item.title}</h3>
              <p className="m-0 mt-1 text-sm leading-relaxed">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
