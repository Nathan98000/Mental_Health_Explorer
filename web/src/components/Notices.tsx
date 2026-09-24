/** One-line notices about what the page fell back to, e.g. "Not asked in 2021; showing 2024." */
export function Notices({ items }: { items: string[] }) {
  if (!items.length) return null
  return (
    <div className="mt-4 space-y-2">
      {items.map((text) => (
        <p key={text} role="status" className="m-0 rounded-2xl bg-surface-cool px-4 py-2 text-sm text-ink">
          {text}
        </p>
      ))}
    </div>
  )
}
