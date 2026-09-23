import { Link } from 'react-router'
import { SITE_NAME } from '../lib/site'

export function Header() {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
      <Link to="/" className="flex items-center gap-3 text-ink no-underline">
        <svg width="36" height="36" viewBox="0 0 64 64" aria-hidden="true">
          <rect width="64" height="64" rx="18" fill="var(--primary)" />
          <path d="M18 43a14 14 0 0 1 28 0z" fill="var(--sun)" />
          <path d="M32 15v6M19 21l4 4M45 21l-4 4" stroke="var(--sun)" strokeWidth="4" strokeLinecap="round" />
          <path d="M12 43h40" stroke="var(--page)" strokeWidth="4" strokeLinecap="round" />
        </svg>
        <span className="font-display text-xl font-extrabold tracking-tight">{SITE_NAME}</span>
      </Link>
      <span className="rounded-full bg-surface-cool px-3 py-1 text-xs font-semibold text-ink-2">Preview</span>
    </header>
  )
}
