import { useId, useState } from 'react'
import { suppressedTakeaway } from '../lib/takeaways'

/** A suppressed estimate: a dash that shows why on hover, keyboard focus, or a click or tap; Escape closes it. */
export function SuppressedValue({ reason, className = '' }: { reason: string | null; className?: string }) {
  const id = useId()
  // `open` is toggled by a click or tap; `dismissed` hides the note after Escape until the pointer or focus leaves.
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const shown = dismissed ? 'hidden' : open ? 'block' : 'hidden peer-hover:block peer-focus-visible:block'
  return (
    <span className="relative inline-block">
      <button
        type="button"
        aria-label="Not reported"
        aria-expanded={open && !dismissed}
        aria-describedby={id}
        data-suppressed="true"
        className={`peer cursor-help rounded px-0.5 ${className}`}
        onClick={() => {
          setOpen((v) => !v)
          setDismissed(false)
        }}
        onKeyDown={(e) => {
          if (e.key !== 'Escape') return
          setOpen(false)
          setDismissed(true)
        }}
        onBlur={() => {
          setOpen(false)
          setDismissed(false)
        }}
        onPointerLeave={() => setDismissed(false)}
      >
        —
      </button>
      <span
        id={id}
        role="tooltip"
        className={`absolute left-0 top-full z-10 mt-1 w-max max-w-64 rounded-xl bg-ink px-3 py-2 text-left font-sans text-sm font-normal normal-case leading-snug tracking-normal text-page ${shown}`}
      >
        {suppressedTakeaway(reason)}
      </span>
    </span>
  )
}
