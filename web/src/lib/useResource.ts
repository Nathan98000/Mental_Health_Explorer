import { useEffect, useState } from 'react'

export type Resource<T> = { status: 'loading'; data: null; error: null } | { status: 'error'; data: null; error: Error } | { status: 'ready'; data: T; error: null }

type Settled<T> = { key: string; state: Resource<T> }

const LOADING = { status: 'loading', data: null, error: null } as const

/**
 * Load something asynchronously, keyed so that a result for a different key is reported as
 * loading rather than shown stale. The loader is expected to cache (see data.ts).
 */
export function useResource<T>(key: string, load: () => Promise<T>): Resource<T> {
  const [settled, setSettled] = useState<Settled<T> | null>(null)
  useEffect(() => {
    let cancelled = false
    load()
      .then((data) => {
        if (!cancelled) setSettled({ key, state: { status: 'ready', data, error: null } })
      })
      .catch((error: unknown) => {
        if (!cancelled) setSettled({ key, state: { status: 'error', data: null, error: error instanceof Error ? error : new Error(String(error)) } })
      })
    return () => {
      cancelled = true
    }
    // The key names everything the loader depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return settled && settled.key === key ? settled.state : LOADING
}
