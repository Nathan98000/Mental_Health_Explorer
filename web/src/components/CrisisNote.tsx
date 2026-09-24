/** The 988 note shown beside charts of suicide measures (the footer always carries it too). */
export function CrisisNote() {
  return (
    <aside className="rounded-2xl bg-surface-tint p-4 text-sm leading-relaxed text-ink" aria-label="Support">
      If you or someone you know is struggling, you can call or text <strong>988</strong> or chat at{' '}
      <a className="font-semibold text-primary-ink underline" href="https://988lifeline.org">988lifeline.org</a> to reach the 988 Suicide &amp; Crisis Lifeline, any time.
    </aside>
  )
}
