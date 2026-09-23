import { EstimateCard } from '../components/EstimateCard'
import { TrendChart } from '../components/TrendChart'
import { MDE_SERIES, MDE_SEVERE_SERIES, teenDepressionTrend, teenMde2021, teenMde2024 } from '../data/preview'
import { formatPct, oneInN } from '../lib/format'

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

export function Home() {
  const then = oneInN(teenMde2021.p)
  return (
    <>
      <section className="relative overflow-hidden rounded-[2rem] bg-surface-tint px-6 py-12 sm:px-10 sm:py-16">
        <svg className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 opacity-70" viewBox="0 0 200 200" aria-hidden="true">
          <circle cx="100" cy="100" r="90" fill="var(--sun)" />
        </svg>
        <svg className="pointer-events-none absolute -bottom-20 right-24 h-48 w-48 opacity-40" viewBox="0 0 200 200" aria-hidden="true">
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
        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <EstimateCard
            measure="had a major depressive episode in the past year"
            population="teens ages 12–17"
            year={teenMde2024.year}
            p={teenMde2024.p}
            lo={teenMde2024.lo}
            hi={teenMde2024.hi}
            n={teenMde2024.n}
            comparison={`That's down from ${formatPct(teenMde2021.p)}${then ? ` (about ${then})` : ''} in 2021.`}
          />
          <div className="rounded-3xl bg-surface p-6 ring-1 ring-line">
            <TrendChart
              title="Teens with a major depressive episode, 2021–2024"
              rows={teenDepressionTrend}
              series={[MDE_SERIES, MDE_SEVERE_SERIES]}
              caption="Share of U.S. teens ages 12–17, past year. Shaded bands show 95% confidence intervals. “Severe impairment” means depression seriously interfered with home, school, family or social life."
            />
          </div>
        </div>
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
