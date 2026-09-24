import type { Catalog } from './catalog'
import { loadCatalog } from './data'
import { useResource, type Resource } from './useResource'

export function useCatalog(): Resource<Catalog> {
  return useResource('catalog', loadCatalog)
}
