import { Link } from 'react-router'

export function Header() {
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
      <Link to="/" className="flex items-center gap-3 text-ink no-underline">
        <svg width="36" height="36" viewBox="0 0 64 64" aria-hidden="true">
          <rect width="64" height="64" rx="18" fill="var(--primary)" />
          <circle cx="32" cy="34" r="14" fill="var(--sun)" />
          <path d="M14 46c6-8 12-11 18-11s12 3 18 11" fill="none" stroke="var(--page)" strokeWidth="5" strokeLinecap="round" />
        </svg>
        <span className="font-display text-xl font-extrabold tracking-tight">Mental Health Explorer</span>
      </Link>
      <span className="rounded-full bg-surface-cool px-3 py-1 text-xs font-semibold text-ink-2">Preview</span>
    </header>
  )
}
