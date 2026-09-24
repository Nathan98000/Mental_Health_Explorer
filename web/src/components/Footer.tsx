/** Site footer; the 988 note is left out on pages that already show one above their chart. */
export function Footer({ crisisNote = true }: { crisisNote?: boolean }) {
  return (
    <footer className="mt-20 border-t border-line bg-surface">
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-8 text-sm text-ink-2 sm:px-6">
        {crisisNote ? (
          <p className="m-0 rounded-2xl bg-surface-tint p-4 text-base text-ink">
            If you or someone you know is struggling, you can call or text <strong>988</strong> or chat at{' '}
            <a className="font-semibold text-primary-ink underline" href="https://988lifeline.org">988lifeline.org</a>{' '}
            to reach the 988 Suicide &amp; Crisis Lifeline.
          </p>
        ) : null}
        <p className="m-0">
          Data: Substance Abuse and Mental Health Services Administration (SAMHSA), National Survey on Drug Use and
          Health, 2021–2024 public use file. Estimates are computed by this site from the public file and may differ
          slightly from SAMHSA&apos;s published figures.
        </p>
        <p className="m-0">
          <a className="text-primary-ink underline" href="https://github.com/Nathan98000/Mental_Health_Explorer">Source code on GitHub</a>
        </p>
      </div>
    </footer>
  )
}
