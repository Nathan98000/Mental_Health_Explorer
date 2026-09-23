import { EstimateCard } from '../components/EstimateCard'
import { TrendChart, type TrendRow } from '../components/TrendChart'
import { overallByYear, overallTrendTest, type EstimateShard } from '../lib/data'
import { formatPct, oneInN } from '../lib/format'
import { useEstimates } from '../lib/useEstimates'

const MDE_SERIES = 'Major depressive episode'
const MDE_SEVERE_SERIES = 'With severe impairment'
const HOME_INDICATORS = ['mde_py', 'mde_severe'] as const

/** "That's down from 21% (about 1 in 5) in 2021." when the change is significant; otherwise a plain comparison. */
function comparison(shard: EstimateShard): string | undefined {
  const years = overallByYear(shard)
  if (years.length < 2) return undefined
  const first = years[0]
  const last = years[years.length - 1]
  const then = oneInN(first.p)
  const about = then ? ` (about ${then})` : ''
  const test = overallTrendTest(shard, first.year, last.year)
  if (test && test.pValue < 0.05) {
    return `That's ${test.diff < 0 ? 'down' : 'up'} from ${formatPct(first.p)}${about} in ${first.year}.`
  }
  return `Compared with ${formatPct(first.p)}${about} in ${first.year}.`
}

function trendRows(mde: EstimateShard, severe: EstimateShard): TrendRow[] {
  const rows = (shard: EstimateShard, series: string) => overallByYear(shard).map((y) => ({ year: y.year, series, p: y.p, lo: y.lo, hi: y.hi }))
  return [...rows(mde, MDE_SERIES), ...rows(severe, MDE_SEVERE_SERIES)]
}

const upcoming = [
  { title: 'Explore any measure', body: 'Depression, suicidal thoughts, substance use, school and family life — for teens and young adults.', shape: 'circle' },
  { title: 'Trends', body: 'See how each measure changed from 2021 to 2024, and whether the change is real.', shape: 'wave' },
  { title: "Who's most affected", body: 'Compare by sex, race and ethnicity, family income, insurance and where people live.', shape: 'bars' },
  { title: 'What goes together', body: 'For example, how common depression is among teens who vape compared with teens who don’t.', shape: 'dots' },
  { title: 'Young adults', body: 'The same tools for ages 18–25, with measures designed for adults.', shape: 'circle' },
  { title: 'How we did it', body: 'Where the numbers come from, how sure we can be, and how to cite them.', shape: 'wave' },
] as const

function Shape({ kind }: { kind: (typeof upcoming)[number]['shape'] }) {
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
    </svg>
  )
}

function FirstLook({ mde, severe }: { mde: EstimateShard; severe: EstimateShard }) {
  const years = overallByYear(mde)
  const latest = years[years.length - 1]
  const firstYear = years[0]?.year
  const lastYear = latest?.year
  return (
    <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <div className="lg:self-start">
        {latest ? (
          <EstimateCard
            measure="had a major depressive episode in the past year"
            population="teens ages 12–17"
            year={latest.year}
            p={latest.p}
            lo={latest.lo}
            hi={latest.hi}
            n={latest.n}
            comparison={comparison(mde)}
          />
        ) : null}
      </div>
      <div className="rounded-3xl bg-surface p-6 ring-1 ring-line">
        <TrendChart
          title={`Teens with a major depressive episode, ${firstYear}–${lastYear}`}
          rows={trendRows(mde, severe)}
          series={[MDE_SERIES, MDE_SEVERE_SERIES]}
          caption="Share of U.S. teens ages 12–17, past year. Shaded bands show 95% confidence intervals. “Severe impairment” means depression seriously interfered with home, school, family or social life."
        />
      </div>
    </div>
  )
}

export function Home() {
  const estimates = useEstimates('teen', HOME_INDICATORS)
  return (
    <>
      <section className="relative overflow-hidden rounded-[2rem] bg-surface-tint px-6 py-12 sm:px-10 sm:py-16">
        <svg className="pointer-events-none absolute -right-16 -top-16 hidden h-64 w-64 opacity-70 sm:block dark:opacity-35" viewBox="0 0 200 200" aria-hidden="true">
          <circle cx="100" cy="100" r="90" fill="var(--sun)" />
        </svg>
        <svg className="pointer-events-none absolute -bottom-20 right-24 hidden h-48 w-48 opacity-40 sm:block dark:opacity-25" viewBox="0 0 200 200" aria-hidden="true">
          <circle cx="100" cy="100" r="90" fill="var(--primary)" />
        </svg>
        <div className="relative max-w-2xl">
          <h1 className="m-0 font-display text-4xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">
            How are young people in the U.S. doing?
          </h1>
          <p className="m-0 mt-4 text-lg leading-relaxed text-ink-2">
            Explore what a national survey of about 58,000 people each year says about depression, suicidal
            thoughts, substance use and getting help — for teens ages 12–17 and young adults ages 18–25.
          </p>
        </div>
      </section>

      <p className="mt-6 rounded-2xl border border-dashed border-line bg-surface px-4 py-3 text-sm text-ink-2" role="note">
        <strong className="text-ink">Early preview.</strong> The numbers on this page come from a prototype and will be
        re-checked before launch.
      </p>

      <section className="mt-10" aria-labelledby="first-look">
        <h2 id="first-look" className="m-0 font-display text-2xl font-extrabold text-ink">A first look: teen depression</h2>
        {estimates.status === 'loading' ? (
          <p className="mt-5 rounded-3xl bg-surface p-6 text-ink-2 ring-1 ring-line" role="status">
            Loading the latest estimates…
          </p>
        ) : estimates.status === 'error' ? (
          <p className="mt-5 rounded-3xl bg-surface p-6 text-ink-2 ring-1 ring-line" role="alert">
            The estimates could not be loaded. Please try again later.
          </p>
        ) : (
          <FirstLook mde={estimates.shards.mde_py} severe={estimates.shards.mde_severe} />
        )}
      </section>

      <section className="mt-14" aria-labelledby="coming-soon">
        <h2 id="coming-soon" className="m-0 font-display text-2xl font-extrabold text-ink">Coming soon</h2>
        <ul className="mt-5 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {upcoming.map((item) => (
            <li key={item.title} className="rounded-3xl bg-surface p-5 ring-1 ring-line">
              <Shape kind={item.shape} />
              <h3 className="m-0 mt-3 font-display text-lg font-bold text-ink">{item.title}</h3>
              <p className="m-0 mt-1 text-sm leading-relaxed text-ink-2">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
