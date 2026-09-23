import { useEffect, useState } from 'react'
import { loadEstimates, type Cohort, type EstimateShard } from './data'

export type EstimatesState =
  | { status: 'loading'; shards: null; error: null }
  | { status: 'error'; shards: null; error: Error }
  | { status: 'ready'; shards: Record<string, EstimateShard>; error: null }

type Settled = { key: string; state: EstimatesState }

const LOADING: EstimatesState = { status: 'loading', shards: null, error: null }

/** Loads one cohort's estimate shards for the given indicators, keyed by indicator id. */
export function useEstimates(cohort: Cohort, indicators: readonly string[]): EstimatesState {
  const key = `${cohort}|${indicators.join(',')}`
  const [settled, setSettled] = useState<Settled | null>(null)

  useEffect(() => {
    let cancelled = false
    const ids = key.slice(key.indexOf('|') + 1).split(',')
    Promise.all(ids.map((id) => loadEstimates(cohort, id)))
      .then((loaded) => {
        if (cancelled) return
        const shards = Object.fromEntries(loaded.map((shard) => [shard.indicator, shard]))
        setSettled({ key, state: { status: 'ready', shards, error: null } })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setSettled({ key, state: { status: 'error', shards: null, error: error instanceof Error ? error : new Error(String(error)) } })
      })
    return () => {
      cancelled = true
    }
  }, [cohort, key])

  // A result for a different cohort or indicator list is stale: report loading until the new one lands.
  return settled && settled.key === key ? settled.state : LOADING
}
