import { Link } from 'react-router'
import type { Catalog } from '../lib/catalog'
import type { Cohort } from '../lib/data'

type Props = { catalog: Catalog; cohort: Cohort; hrefFor?: (cohort: Cohort) => string }

/** Links that switch a page between cohorts; the choice lives in the URL, and the pages pass an hrefFor that keeps their other settings. */
export function CohortSwitcher({ catalog, cohort, hrefFor = (c) => `/?cohort=${c}` }: Props) {
  return (
    <nav aria-label="Cohort" className="inline-flex rounded-full bg-surface p-1 ring-1 ring-line">
      {catalog.cohorts.map((c) => {
        const current = c.id === cohort
        return (
          <Link
            key={c.id}
            to={hrefFor(c.id)}
            aria-current={current ? 'page' : undefined}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold no-underline ${current ? 'bg-primary text-on-primary' : 'text-ink-2 hover:text-ink'}`}
          >
            {c.label} <span className="whitespace-nowrap">ages {c.ages}</span>
          </Link>
        )
      })}
    </nav>
  )
}
