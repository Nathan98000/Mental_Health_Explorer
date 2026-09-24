import { useId, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { cohortFromLocation, DEFAULT_COHORT, DEFAULT_INDICATOR, explorePath, trendsPath } from '../lib/routes'
import { SITE_NAME } from '../lib/site'
import type { Cohort } from '../lib/data'

/** The main links carry the cohort the visitor is looking at, so switching pages keeps it. */
function nav(cohort: Cohort) {
  return [
    { to: cohort === DEFAULT_COHORT ? '/' : `/?cohort=${cohort}`, label: 'Overview', match: (path: string) => path === '/' },
    { to: explorePath(cohort, DEFAULT_INDICATOR), label: 'Explore', match: (path: string) => path.startsWith('/explore') },
    { to: trendsPath(cohort, DEFAULT_INDICATOR), label: 'Trends', match: (path: string) => path.startsWith('/trends') },
    { to: '/methods', label: 'Methods', match: (path: string) => path.startsWith('/methods') },
  ]
}

export function Header() {
  const { pathname, search } = useLocation()
  const NAV = nav(cohortFromLocation(pathname, search) ?? DEFAULT_COHORT)
  // The menu remembers the path it was opened on, so it closes itself after navigation.
  const [openedOn, setOpenedOn] = useState<string | null>(null)
  const open = openedOn === pathname
  const navId = useId()
  return (
    <header className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-3 text-ink no-underline">
          <svg width="36" height="36" viewBox="0 0 64 64" aria-hidden="true">
            <rect width="64" height="64" rx="18" fill="var(--primary)" />
            <path d="M18 43a14 14 0 0 1 28 0z" fill="var(--sun)" />
            <path d="M32 15v6M19 21l4 4M45 21l-4 4" stroke="var(--sun)" strokeWidth="4" strokeLinecap="round" />
            <path d="M12 43h40" stroke="var(--page)" strokeWidth="4" strokeLinecap="round" />
          </svg>
          <span className="font-display text-xl font-extrabold tracking-tight">{SITE_NAME}</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden rounded-full bg-surface-cool px-3 py-1 text-xs font-semibold text-ink-2 sm:inline">Preview</span>
          <button
            type="button"
            className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-ink sm:hidden"
            aria-expanded={open}
            aria-controls={navId}
            onClick={() => setOpenedOn(open ? null : pathname)}
          >
            Menu
          </button>
        </div>
      </div>
      <nav id={navId} aria-label="Main" className={`${open ? 'block' : 'hidden'} mt-4 sm:mt-3 sm:block`}>
        <ul className="m-0 flex list-none flex-col gap-1 p-0 sm:flex-row sm:gap-2">
          {NAV.map((item) => {
            const current = item.match(pathname)
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  aria-current={current ? 'page' : undefined}
                  className={`block rounded-full px-4 py-2 text-sm font-semibold no-underline ${current ? 'bg-primary text-on-primary' : 'text-ink-2 hover:bg-surface-tint hover:text-ink'}`}
                >
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </header>
  )
}
