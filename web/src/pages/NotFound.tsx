import { Link } from 'react-router'
import { useDocumentTitle } from '../lib/useDocumentTitle'

export default function NotFound() {
  useDocumentTitle('Page not found')
  return (
    <section className="py-20 text-center">
      <h1 className="m-0 font-display text-4xl font-extrabold text-ink">We couldn&apos;t find that page</h1>
      <p className="mt-4 text-ink-2">
        <Link to="/" className="font-semibold text-primary-ink underline">Go to the overview</Link>
      </p>
    </section>
  )
}
