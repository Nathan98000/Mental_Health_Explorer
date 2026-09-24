import { useId } from 'react'

/** A suppressed estimate: an em dash with the reason on hover or keyboard focus. */
export function SuppressedValue({ reason, className = '' }: { reason: string | null; className?: string }) {
  const id = useId()
  const text = reason ? `Not reported: ${reason}.` : 'Not reported.'
  return (
    <span className="relative inline-block">
      <span tabIndex={0} aria-describedby={id} className={`peer cursor-help ${className}`} data-suppressed="true">
        —
      </span>
      <span
        id={id}
        role="tooltip"
        className="absolute left-0 top-full z-10 mt-1 hidden w-max max-w-64 rounded-xl bg-ink px-3 py-2 text-left font-sans text-sm font-normal normal-case leading-snug tracking-normal text-page peer-hover:block peer-focus-visible:block"
      >
        {text}
      </span>
    </span>
  )
}
