import { useId, useState, type CSSProperties } from 'react'
import { suppressedTakeaway } from '../lib/takeaways'

/** Space kept between the note and the edge of the screen, in px. */
const EDGE = 8

/**
 * A suppressed estimate: a dash that shows why on hover, keyboard focus, or a click or tap; Escape closes it.
 * A dash in the right half of the screen anchors its note at its right edge, and the note never runs off screen.
 */
export function SuppressedValue({ reason, className = '' }: { reason: string | null; className?: string }) {
  const id = useId()
  // `open` is toggled by a click or tap; `dismissed` hides the note after Escape until the pointer or focus leaves.
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [place, setPlace] = useState<{ right: boolean; style?: CSSProperties }>({ right: false })
  const measure = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect()
    const right = rect.left > window.innerWidth / 2
    const space = right ? rect.right - EDGE : window.innerWidth - rect.left - EDGE
    setPlace({ right, style: { maxWidth: `min(16rem, calc(100vw - 2rem), ${Math.max(0, Math.floor(space))}px)` } })
  }
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
        onClick={(e) => {
          measure(e.currentTarget)
          setOpen((v) => !v)
          setDismissed(false)
        }}
        onKeyDown={(e) => {
          if (e.key !== 'Escape') return
          setOpen(false)
          setDismissed(true)
        }}
        onFocus={(e) => measure(e.currentTarget)}
        onPointerEnter={(e) => measure(e.currentTarget)}
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
        style={place.style}
        className={`absolute ${place.right ? 'right-0' : 'left-0'} top-full z-10 mt-1 w-max max-w-[min(16rem,calc(100vw-2rem))] rounded-xl bg-ink px-3 py-2 text-left font-sans text-sm font-normal normal-case leading-snug tracking-normal text-page ${shown}`}
      >
        {suppressedTakeaway(reason)}
      </span>
    </span>
  )
}
