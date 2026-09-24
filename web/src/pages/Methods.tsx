import { useId, useState, type ReactNode } from 'react'
import { ScrollTable } from '../components/ScrollTable'
import { Loading, LoadError } from '../components/Status'
import { cohortInfo, SURVEY_YEARS, type Catalog, type Indicator } from '../lib/catalog'
import { loadAvailability, loadManifest, type Availability, type Cohort, type Manifest } from '../lib/data'
import { citation } from '../lib/exports'
import { formatCount } from '../lib/format'
import { useCatalog } from '../lib/useCatalog'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { useResource } from '../lib/useResource'

const REPORT_URL = 'https://github.com/Nathan98000/Mental_Health_Explorer/blob/main/validation/REPORT.md'
const REPO_URL = 'https://github.com/Nathan98000/Mental_Health_Explorer'

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="mt-10" aria-labelledby={id}>
      <h2 id={id} className="m-0 font-display text-2xl font-extrabold text-ink">{title}</h2>
      <div className="mt-3 max-w-3xl space-y-3 leading-relaxed text-ink">{children}</div>
    </section>
  )
}

function yearsText(years: number[]): string {
  const sorted = [...years].sort((a, b) => a - b)
  const contiguous = sorted.every((y, i) => i === 0 || y === sorted[i - 1] + 1)
  return contiguous && sorted.length > 1 ? `${sorted[0]}–${sorted[sorted.length - 1]}` : sorted.join(', ')
}

function Dictionary({ catalog }: { catalog: Catalog }) {
  const [query, setQuery] = useState('')
  const id = useId()
  const q = query.trim().toLowerCase()
  const rows = catalog.indicators.filter((i) => !q || [i.label, i.id, i.definition, i.source, cohortInfo(catalog, i.cohort).label].some((t) => t.toLowerCase().includes(q)))
  const th = 'border-b border-line py-2 pr-4 text-left font-semibold'
  const td = 'border-b border-line py-2 pr-4 align-top'
  return (
    <>
      <div className="max-w-md">
        <label htmlFor={id} className="mb-1 block text-sm font-semibold text-ink-2">Search the dictionary</label>
        <input id={id} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. depression, vaping, YMDEYR" className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-base text-ink" />
      </div>
      <p className="m-0 text-sm text-ink-2" role="status">{rows.length} of {catalog.indicators.length} measures shown.</p>
      <ScrollTable label="Data dictionary table">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Data dictionary</caption>
          <thead>
            <tr className="text-ink-2">
              <th scope="col" className={th}>Measure</th>
              <th scope="col" className={th}>Cohort</th>
              <th scope="col" className={th}>Definition</th>
              <th scope="col" className={th}>Source variable</th>
              <th scope="col" className={th}>Years</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <tr key={`${i.cohort}-${i.id}`}>
                <th scope="row" className={`${td} text-left font-medium`}>
                  {i.label}
                  <span className="block text-xs font-normal text-muted">{i.id}</span>
                </th>
                <td className={td}>{cohortInfo(catalog, i.cohort).label}</td>
                <td className={`${td} min-w-72`}>
                  {i.definition}
                  {i.caveats.length ? <span className="block text-xs text-muted">{i.caveats.join(' ')}</span> : null}
                </td>
                <td className={td}><code>{i.source}</code></td>
                <td className={`${td} whitespace-nowrap`}>{yearsText(i.years)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollTable>
    </>
  )
}

function AvailabilityMatrix({ catalog, availability }: { catalog: Catalog; availability: Availability }) {
  const th = 'border-b border-line py-2 pr-4 text-left font-semibold'
  const cohorts: Cohort[] = ['teen', 'young_adult']
  const cell = (indicator: Indicator, year: number) => {
    const entry = availability[indicator.cohort]?.[indicator.id]?.[String(year)]
    if (!entry || !entry.collected) return <span className="text-muted">—<span className="sr-only">Not collected</span></span>
    return <span title={`${formatCount(entry.n_valid)} responses`}>Yes</span>
  }
  return (
    <ScrollTable label="Years each measure was collected, as a table">
      <table className="tabular w-full border-collapse text-sm">
        <caption className="sr-only">Years each measure was collected</caption>
        <thead>
          <tr className="text-ink-2">
            <th scope="col" className={th}>Measure</th>
            <th scope="col" className={th}>Cohort</th>
            {SURVEY_YEARS.map((y) => (
              <th key={y} scope="col" className={th}>{y}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.flatMap((cohort) =>
            catalog.indicators
              .filter((i) => i.cohort === cohort)
              .map((i) => (
                <tr key={`${cohort}-${i.id}`}>
                  <th scope="row" className="border-b border-line py-2 pr-4 text-left font-medium">{i.label}</th>
                  <td className="border-b border-line py-2 pr-4">{cohortInfo(catalog, cohort).label}</td>
                  {SURVEY_YEARS.map((y) => (
                    <td key={y} className="border-b border-line py-2 pr-4">{cell(i, y)}</td>
                  ))}
                </tr>
              )),
          )}
        </tbody>
      </table>
    </ScrollTable>
  )
}

function Groups({ catalog }: { catalog: Catalog }) {
  return (
    <dl className="m-0 grid gap-x-6 gap-y-3 sm:grid-cols-[auto_1fr]">
      {catalog.groups.map((g) => (
        <div key={g.id} className="contents">
          <dt className="font-semibold">{g.label}</dt>
          <dd className="m-0 text-ink-2">
            {g.levels.map((l) => l.label).join(' · ')}
            <span className="block text-xs text-muted">
              {g.cohorts.map((c) => cohortInfo(catalog, c).label).join(' and ')}
              {g.crosses_only ? '; used only for two-way crosses' : ''}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  )
}

function Generated({ manifest }: { manifest: Manifest }) {
  return (
    <p>
      The data files were generated on {manifest.generated}
      {manifest.pipeline_sha ? <> from pipeline commit <code>{manifest.pipeline_sha.slice(0, 12)}</code></> : null}. Every file is listed with its size and checksum in the manifest.
    </p>
  )
}

export default function Methods() {
  useDocumentTitle('Methods and data dictionary')
  const catalog = useCatalog()
  const availability = useResource('availability', loadAvailability)
  const manifest = useResource('manifest', loadManifest)
  const cite = citation({ title: 'Methods and data dictionary', url: window.location.href })
  return (
    <>
      <h1 className="m-0 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">Methods and data dictionary</h1>
      <p className="m-0 mt-3 max-w-3xl text-lg leading-relaxed text-ink-2">
        Where the numbers come from, how they are computed, how sure we can be, and what every measure means.
      </p>

      <Section id="data-source" title="Data source">
        <p>
          All estimates come from the National Survey on Drug Use and Health (NSDUH), run every year by the Substance Abuse and Mental Health
          Services Administration (SAMHSA). This site uses the combined 2021–2024 public use file, which holds 232,441 respondents: 45,618 teens
          ages 12–17, 56,009 young adults ages 18–25, and adults 26 and older, who are not shown here.
        </p>
        <p>
          In 2024, 21.91% of the households sampled completed the screening interview and 51.54% of the people selected completed the main
          interview. Survey weights adjust for who took part, but low response rates leave room for differences between respondents and the
          people they stand for.
        </p>
      </Section>

      <Section id="how-computed" title="How the estimates are computed">
        <p>
          Every number is a weighted proportion: each respondent counts with their analysis weight, so the sample stands for the U.S. civilian,
          non-institutionalized population. Single years use the one-year weight; when years are pooled (&ldquo;all years combined&rdquo; or
          &ldquo;latest two years combined&rdquo;) the file&rsquo;s multi-year weights are used and the result is an annual average.
        </p>
        <p>
          Standard errors use Taylor-series linearization with the file&rsquo;s variance strata and replicates. Confidence intervals are 95%
          intervals computed on the logit scale with 50 degrees of freedom, the same approach as SAMHSA&rsquo;s detailed tables. The estimated
          number of people is the weighted count, rounded to the nearest thousand.
        </p>
        <p>
          A change between two years is called real only when a two-sided t test on the difference (50 degrees of freedom) gives p below 0.05.
          A population is called higher or lower than everyone only when an adjusted Wald F test across the group&rsquo;s levels is significant and
          that level&rsquo;s own test against the overall estimate is too. Otherwise the wording is &ldquo;about the same&rdquo; or &ldquo;similar&rdquo;.
        </p>
      </Section>

      <Section id="suppression" title="When a number is not shown">
        <p>
          Following Table 11.1 of the public use file users&rsquo; guide, an estimate is suppressed when it is based on fewer than 50 respondents,
          when it is too imprecise (its relative standard error on the log scale is above the guide&rsquo;s threshold), or when no one in the group
          answered the question. A suppressed estimate appears as a dash; hovering or focusing it shows the reason.
        </p>
      </Section>

      <Section id="teen-suicide" title="How teen suicide questions are counted">
        <p>
          The teen questions on suicidal thoughts and plans allow the answers &ldquo;I&rsquo;m not sure&rdquo; and &ldquo;I don&rsquo;t want to
          answer&rdquo;. Following SAMHSA&rsquo;s published estimates, those answers are counted as no. Teen rates for these measures are therefore
          conservative: they can understate but not overstate how many teens had these thoughts.
        </p>
      </Section>

      <Section id="differences" title="Why numbers can differ slightly from SAMHSA's reports">
        <p>
          The public use file protects respondents&rsquo; privacy: some records are subsampled and some values are recoded or perturbed before
          release. Estimates computed from it, like the ones here, can differ slightly from SAMHSA&rsquo;s published figures, which use the
          restricted-use file. The differences are small and do not change the picture.
        </p>
      </Section>

      <Section id="limitations" title="Limitations">
        <ul className="my-0 list-disc space-y-1 pl-5">
          <li>The survey is cross-sectional: it shows how common things are and what goes together, not cause and effect.</li>
          <li>Teens and adults answer different questionnaires, so teen and young-adult measures are not always directly comparable.</li>
          <li>There is no teen suicide-attempt question in the public use file.</li>
          <li>The public use file has no state, sexual orientation or gender identity variables.</li>
          <li>Because of changes to the survey, data from 2021 on is not comparable with earlier years.</li>
        </ul>
      </Section>

      <Section id="validation" title="Validation">
        <p>
          Every printed cell of the codebook&rsquo;s reference tables (Tables 4a, 4b, 5a and 5b: 246 percentages, standard errors and totals) was
          recomputed from the raw file and matched at printed precision, and an independent cross-check with the R <code>survey</code> package
          agreed with the estimator. The full <a className="text-primary-ink underline" href={REPORT_URL}>validation report</a> and the{' '}
          <a className="text-primary-ink underline" href={REPO_URL}>source code</a> are on GitHub.
        </p>
      </Section>

      <Section id="dictionary" title="Data dictionary">
        {catalog.status === 'ready' ? <Dictionary catalog={catalog.data} /> : catalog.status === 'error' ? <LoadError what="The dictionary" /> : <Loading what="the dictionary" />}
      </Section>

      <Section id="availability" title="Which years each measure was asked">
        {catalog.status === 'ready' && availability.status === 'ready' ? (
          <AvailabilityMatrix catalog={catalog.data} availability={availability.data} />
        ) : catalog.status === 'error' || availability.status === 'error' ? (
          <LoadError what="The availability table" />
        ) : (
          <Loading what="the availability table" />
        )}
      </Section>

      <Section id="groups" title="Population groups">
        {catalog.status === 'ready' ? <Groups catalog={catalog.data} /> : null}
      </Section>

      <Section id="citation" title="Data generation and citation">
        {manifest.status === 'ready' ? <Generated manifest={manifest.data} /> : null}
        <p>
          Source: Substance Abuse and Mental Health Services Administration, Center for Behavioral Health Statistics and Quality. National Survey
          on Drug Use and Health 2021–2024 public use file. SAMHSA&rsquo;s data may be used only for statistical purposes.
        </p>
        <p className="wrap-anywhere rounded-2xl bg-surface p-4 text-sm ring-1 ring-line">To cite this page: {cite}</p>
      </Section>
    </>
  )
}
