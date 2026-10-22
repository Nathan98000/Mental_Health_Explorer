import { readCatalog } from '../test/fixtures'
import { findIndicator } from './catalog'
import { HEADLINES } from './headlines'

const catalog = readCatalog()

describe('HEADLINES', () => {
  it('names six launch indicators per cohort', () => {
    for (const cohort of ['teen', 'young_adult'] as const) {
      expect(HEADLINES[cohort]).toHaveLength(6)
      for (const id of HEADLINES[cohort]) expect(findIndicator(catalog, cohort, id), `${cohort}/${id}`).toBeDefined()
    }
  })
  it('keeps shared measures in the same slot for both cohorts', () => {
    const shared = HEADLINES.teen.filter((id) => HEADLINES.young_adult.includes(id))
    expect(shared).toEqual(['mde_py', 'suicide_thoughts', 'marijuana_py'])
    for (const id of shared) expect(HEADLINES.young_adult.indexOf(id)).toBe(HEADLINES.teen.indexOf(id))
  })
})
