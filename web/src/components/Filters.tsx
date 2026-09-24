import type { ReactNode } from 'react'
import { useMediaQuery } from '../lib/useMediaQuery'

type Props = {
  /** What is currently shown, for the collapsed summary on phones, e.g. "Teens · 2024 · Everyone". */
  summary: string
  children: ReactNode
}

/** The page's controls: a card from the sm breakpoint up, a collapsed <details> naming the current choice on phones. */
export function Filters({ summary, children }: Props) {
  const wide = useMediaQuery('(min-width: 640px)')
  const form = (
    <form className="grid gap-4" onSubmit={(e) => e.preventDefault()} aria-label="Choose what to show">
      {children}
    </form>
  )
  if (wide) return <div className="mt-6 rounded-3xl bg-surface p-5 ring-1 ring-line">{form}</div>
  return (
    <details className="mt-6 rounded-3xl bg-surface ring-1 ring-line">
      <summary data-testid="filters-summary" className="cursor-pointer list-none px-5 py-4 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="block text-xs font-semibold uppercase tracking-wide text-ink-2">Showing · tap to change</span>
        <span className="block font-semibold text-ink">{summary}</span>
      </summary>
      <div className="px-5 pb-5">{form}</div>
    </details>
  )
}
