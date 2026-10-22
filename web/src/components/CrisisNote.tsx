/** The 988 note as plain text, for exported images; the strip below renders the same words. */
export const CRISIS_TEXT = 'If you or someone you know is struggling, you can call or text 988 or chat at 988lifeline.org to reach the 988 Suicide & Crisis Lifeline, any time.'

/**
 * The 988 note: one full-width strip above the result or chart of a suicide measure, and the same words in the
 * footer everywhere else (`inFooter` drops the landmark, since the footer is one already).
 */
export function CrisisNote({ inFooter = false }: { inFooter?: boolean }) {
  const Tag = inFooter ? 'p' : 'aside'
  return (
    <Tag className="m-0 flex gap-3 rounded-2xl bg-surface-tint px-5 py-4 text-sm leading-relaxed text-ink" aria-label={inFooter ? undefined : 'Support'} data-testid="crisis-note">
      <svg className="mt-0.5 shrink-0" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.6a1 1 0 0 1-.25 1z"
          fill="currentColor"
        />
      </svg>
      <span>
        If you or someone you know is struggling, you can call or text <strong>988</strong> or chat at{' '}
        <a className="font-semibold text-primary-ink underline" href="https://988lifeline.org">988lifeline.org</a> to reach the 988 Suicide &amp; Crisis Lifeline, any time.
      </span>
    </Tag>
  )
}
