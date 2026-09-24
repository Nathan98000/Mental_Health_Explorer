import { Link } from 'react-router'
import { DEFAULT_COHORT, DEFAULT_INDICATOR, explorePath, trendsPath } from '../lib/routes'
import { useDocumentTitle } from '../lib/useDocumentTitle'

export default function NotFound() {
  useDocumentTitle('Page not found')
  const links = [
    { to: '/', label: 'Overview' },
    { to: explorePath(DEFAULT_COHORT, DEFAULT_INDICATOR), label: 'Explore' },
    { to: trendsPath(DEFAULT_COHORT, DEFAULT_INDICATOR), label: 'Trends' },
    { to: '/methods', label: 'Methods' },
  ]
  return (
    <section className="py-20 text-center">
      <h1 className="m-0 font-display text-4xl font-extrabold text-ink">We couldn&apos;t find that page</h1>
      <p className="mt-4 text-ink-2">Try one of these instead.</p>
      <ul className="m-0 mt-4 flex list-none flex-wrap justify-center gap-x-6 gap-y-2 p-0">
        {links.map((l) => (
          <li key={l.to}>
            <Link to={l.to} className="font-semibold text-primary-ink underline">{l.label}</Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
