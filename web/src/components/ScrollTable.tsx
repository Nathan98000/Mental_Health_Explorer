import type { ReactNode } from 'react'

/** A horizontally scrollable table wrapper that keyboard users can reach and scroll. */
export function ScrollTable({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={label}>
      {children}
    </div>
  )
}
