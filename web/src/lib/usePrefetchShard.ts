import { useEffect } from 'react'
import { isCohort } from './catalog'
import { loadEstimates } from './data'

/** Start loading the shard named in the URL before the catalog has confirmed it; a miss is forgotten by the cache. */
export function usePrefetchShard(cohort: string | undefined, indicator: string | undefined): void {
  useEffect(() => {
    if (isCohort(cohort) && indicator && /^[a-z][a-z0-9_]*$/.test(indicator)) loadEstimates(cohort, indicator).catch(() => undefined)
  }, [cohort, indicator])
}
