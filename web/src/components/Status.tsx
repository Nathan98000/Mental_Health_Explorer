/** Loading and error states shared by the pages. */
export function Loading({ what = 'the estimates', className = '' }: { what?: string; className?: string }) {
  return (
    <p className={`mt-5 rounded-3xl bg-surface p-6 text-ink-2 ring-1 ring-line ${className}`} role="status">
      Loading {what}…
    </p>
  )
}

export function LoadError({ what = 'The estimates' }: { what?: string }) {
  return (
    <p className="mt-5 rounded-3xl bg-surface p-6 text-ink-2 ring-1 ring-line" role="alert">
      {what} could not be loaded. Please try again later.
    </p>
  )
}
