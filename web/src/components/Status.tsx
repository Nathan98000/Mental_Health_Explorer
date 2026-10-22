/** Loading and error states shared by the pages. */

/** Placeholder shapes sized like what replaces them, so the page does not jump when the data arrives. */
const VARIANTS = {
  /** A plain status box. */
  box: 'mt-5 rounded-2xl bg-surface p-6 ring-1 ring-line',
  /** The estimate card on Explore. */
  card: 'min-h-[22rem] rounded-2xl bg-surface p-4 ring-1 ring-line sm:p-6',
  /** The chart inside the trend card: heading, legend, the 320 px plot, caption and downloads. */
  chart: 'min-h-[32rem]',
} as const

export function Loading({ what = 'the estimates', variant = 'box', className = '' }: { what?: string; variant?: keyof typeof VARIANTS; className?: string }) {
  return (
    <p className={`m-0 text-ink-2 ${VARIANTS[variant]} ${className}`} role="status" data-variant={variant}>
      Loading {what}…
    </p>
  )
}

export function LoadError({ what = 'The estimates' }: { what?: string }) {
  return (
    <p className="mt-5 rounded-2xl bg-surface p-6 text-ink-2 ring-1 ring-line" role="alert">
      {what} could not be loaded. Please try again later.
    </p>
  )
}
