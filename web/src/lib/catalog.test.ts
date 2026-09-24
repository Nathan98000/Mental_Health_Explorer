import { readCatalog } from '../test/fixtures'
import { findGroup, findIndicator, findLevel, indicatorsByTopic, levelsFor, populationPhrase, withUniverse, yearSetLabel, yearSetsFor, yearSetWhen } from './catalog'

const catalog = readCatalog()

describe('populationPhrase', () => {
  it('is the cohort phrase for everyone', () => {
    expect(populationPhrase(catalog, 'teen')).toBe('teens ages 12–17')
    expect(populationPhrase(catalog, 'young_adult')).toBe('young adults ages 18–25')
  })
  it('fills the group and level templates', () => {
    const sex = findGroup(catalog, 'teen', 'sex')!
    expect(populationPhrase(catalog, 'teen', sex, findLevel(catalog, 'teen', sex, 'female'))).toBe('female teens ages 12–17')
    const age = findGroup(catalog, 'teen', 'age_band')!
    expect(populationPhrase(catalog, 'teen', age, findLevel(catalog, 'teen', age, 'age_14_15'))).toBe('teens ages 14–15')
    const income = findGroup(catalog, 'young_adult', 'family_income')!
    expect(populationPhrase(catalog, 'young_adult', income, findLevel(catalog, 'young_adult', income, 'under_20k'))).toBe('young adults in families earning less than $20,000')
    expect(populationPhrase(catalog, 'young_adult', income, findLevel(catalog, 'young_adult', income, 'from_75k'))).toBe('young adults in families earning $75,000 or more')
  })
})

describe('withUniverse', () => {
  it('appends the denominator clause of a restricted measure and leaves everyone alone', () => {
    const treatment = findIndicator(catalog, 'teen', 'mde_any_treatment')!
    expect(treatment.universe_phrase).toBe('who had a major depressive episode in the past year')
    expect(withUniverse('female teens ages 12–17', treatment)).toBe('female teens ages 12–17 who had a major depressive episode in the past year')
    expect(withUniverse('teens ages 12–17', findIndicator(catalog, 'teen', 'mde_py'))).toBe('teens ages 12–17')
    expect(findIndicator(catalog, 'teen', 'liked_school')?.universe_phrase).toBe('who attended school in the past year')
    expect(treatment.label).not.toMatch(/\bMDE\b/)
  })
})

describe('levelsFor', () => {
  it('keeps only the cohort\'s age bands', () => {
    const age = catalog.groups.find((g) => g.id === 'age_band')!
    expect(levelsFor(catalog, 'teen', age).map((l) => l.id)).toEqual(['age_12_13', 'age_14_15', 'age_16_17'])
    expect(levelsFor(catalog, 'young_adult', age).map((l) => l.id)).toEqual(['age_18_20', 'age_21_23', 'age_24_25'])
  })
})

describe('year sets', () => {
  it('lists single years then the pooled sets', () => {
    expect(yearSetsFor({ years: [2022, 2023, 2024] })).toEqual(['2022', '2023', '2024', 'all', 'recent2'])
    expect(yearSetsFor({ years: [2024] })).toEqual(['2024'])
  })
  it('labels and describes them', () => {
    expect(yearSetLabel('all', [2021, 2022, 2023, 2024])).toBe('All years combined (2021–2024)')
    expect(yearSetLabel('recent2', [2022, 2023, 2024])).toBe('Latest two years combined (2023–2024)')
    expect(yearSetLabel('2023', [2022, 2023])).toBe('2023')
    expect(yearSetWhen('all', [2022, 2023])).toBe('2022–2023 combined')
    expect(yearSetWhen('2024', [2022, 2023, 2024])).toBe('2024')
  })
})

describe('indicatorsByTopic', () => {
  it('follows the topic order and leaves out empty topics', () => {
    const teen = indicatorsByTopic(catalog, 'teen')
    expect(teen[0].topic.id).toBe('depression_suicide')
    expect(teen[0].indicators[0].id).toBe('mde_py')
    expect(teen.every((t) => t.indicators.length > 0)).toBe(true)
    expect(teen.flatMap((t) => t.indicators).every((i) => i.cohort === 'teen')).toBe(true)
  })
})
