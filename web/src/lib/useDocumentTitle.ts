import { useEffect } from 'react'
import { SITE_NAME } from './site'

/** Sets document.title to "Page · Site" (or just the site name for the overview). */
export function useDocumentTitle(title: string | null): void {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE_NAME}` : SITE_NAME
  }, [title])
}

/** The same as a component, for pages that only know their title once data has loaded. */
export function DocumentTitle({ title }: { title: string | null }) {
  useDocumentTitle(title)
  return null
}
