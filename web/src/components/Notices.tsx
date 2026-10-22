/** Notices about what the page fell back to, e.g. "Not asked in 2021; showing 2024.", in one box above the page title. */
export function Notices({ items }: { items: string[] }) {
  if (!items.length) return null
  return (
    <div role="status" className="mb-4 space-y-1 rounded-2xl bg-surface-cool px-4 py-3 text-sm text-ink" data-testid="notices">
      {items.map((text) => (
        <p key={text} className="m-0">
          {text}
        </p>
      ))}
    </div>
  )
}
