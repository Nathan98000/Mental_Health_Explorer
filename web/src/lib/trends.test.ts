import { makeShard, readCatalog, type CellSpec, type TrendSpec } from '../test/fixtures'
import { resolveTrends } from './routes'
import { comparisons, trendHeadline } from './trends'

const catalog = readCatalog()
const BANNED = /\b(cause|caused|causes|because|due to|leads? to|drives?|crisis|alarming|epidemic|skyrocket|surge|plummet|soar)/i

/** The headline for a measure and URL, from 2021 and 2024 cells and the given trend tests. */
function headline(indicator: string, search: string, cells: CellSpec[], trends: TrendSpec[], cohort: 'teen' | 'young_adult' = 'teen') {
  const { state } = resolveTrends(catalog, cohort, indicator, new URLSearchParams(search))
  const shard = makeShard(cohort, indicator, [2021, 2022, 2023, 2024], cells, trends)
  return trendHeadline(catalog, state, comparisons(catalog, shard, state))
}

const overall = [
  { yearSet: '2021', p: 0.20537 },
  { yearSet: '2024', p: 0.14837 },
]

describe('trendHeadline without a split', () => {
  it('says fell with both values', () => {
    expect(headline('mde_py', '', overall, [{ yearA: 2021, yearB: 2024, diff: -0.057, p: 0 }])).toBe(
      'The share of teens ages 12–17 who had a major depressive episode in the past year fell from 21% in 2021 to 15% in 2024.',
    )
  })
  it('says rose', () => {
    const cells = [
      { yearSet: '2021', p: 0.052 },
      { yearSet: '2024', p: 0.071 },
    ]
    expect(headline('mde_py', '', cells, [{ yearA: 2021, yearB: 2024, diff: 0.019, p: 0.01 }])).toBe(
      'The share of teens ages 12–17 who had a major depressive episode in the past year rose from 5.2% in 2021 to 7.1% in 2024.',
    )
  })
  it('says about the same when the change is not significant', () => {
    expect(headline('mde_py', '', overall, [{ yearA: 2021, yearB: 2024, diff: -0.057, p: 0.2 }])).toBe(
      'The share of teens ages 12–17 who had a major depressive episode in the past year was about the same in 2024 (15%) as in 2021 (21%).',
    )
  })
  it("says the years can't be compared without a test", () => {
    expect(headline('mde_py', '', overall, [])).toBe("The 2021 and 2024 estimates for teens ages 12–17 can't be compared.")
  })
  it('leads with the smaller group for a measure asked of only some of the cohort', () => {
    const cells = [
      { yearSet: '2021', p: 0.41 },
      { yearSet: '2024', p: 0.52 },
    ]
    expect(headline('mde_any_treatment', '', cells, [{ yearA: 2021, yearB: 2024, diff: 0.11, p: 0.001 }])).toBe(
      'Among teens ages 12–17 who had a major depressive episode in the past year, the share who got treatment or medication for depression in the past year rose from 41% in 2021 to 52% in 2024.',
    )
  })
})

describe('trendHeadline with a split', () => {
  const bySex = ['male', 'female'].flatMap((level) => ['2021', '2024'].map((yearSet) => ({ yearSet, group: 'sex', level, p: level === 'male' ? 0.08 : 0.17 })))
  it('says every group when all testable series changed the same way', () => {
    const trends = ['male', 'female'].map((level) => ({ group: 'sex', level, yearA: 2021, yearB: 2024, diff: -0.02, p: 0.01 }))
    expect(headline('suicide_thoughts', 'split=sex', bySex, trends)).toBe(
      'From 2021 to 2024, the share of teens ages 12–17 who seriously thought about killing themselves in the past year fell in every group shown.',
    )
  })
  it('counts the groups by kind in words, fell first, and names the ones that cannot be compared', () => {
    const levels = ['under_20k', 'from_20k_to_49k', 'from_50k_to_74k', 'from_75k']
    const cells = levels.flatMap((level) => ['2021', '2024'].map((yearSet) => ({ yearSet, group: 'family_income', level, p: 0.2 })))
    const trends = [
      { group: 'family_income', level: 'under_20k', yearA: 2021, yearB: 2024, diff: 0.01, p: 0.5 },
      { group: 'family_income', level: 'from_20k_to_49k', yearA: 2021, yearB: 2024, diff: -0.05, p: 0.001 },
      { group: 'family_income', level: 'from_50k_to_74k', yearA: 2021, yearB: 2024, diff: -0.04, p: 0.01 },
      { group: 'family_income', level: 'from_75k', yearA: 2021, yearB: 2024, diff: null, p: null },
    ]
    expect(headline('mde_py', 'split=family_income', cells, trends)).toBe(
      'From 2021 to 2024, the share of teens ages 12–17 who had a major depressive episode in the past year fell in two of the four groups shown and was about the same in one; one could not be compared.',
    )
  })
  it('names the smaller group once, before the share, for a measure asked of only some of the cohort', () => {
    const cells = ['insured', 'uninsured'].flatMap((level) => ['2021', '2024'].map((yearSet) => ({ yearSet, group: 'insurance', level, p: 0.45 })))
    const trends = [
      { group: 'insurance', level: 'insured', yearA: 2021, yearB: 2024, diff: 0.08, p: 0.001 },
      { group: 'insurance', level: 'uninsured', yearA: 2021, yearB: 2024, diff: null, p: null },
    ]
    expect(headline('mde_any_treatment', 'split=insurance', cells, trends)).toBe(
      'From 2021 to 2024, among teens ages 12–17 who had a major depressive episode in the past year, the share who got treatment or medication for depression in the past year rose in one of the two groups shown; one could not be compared.',
    )
  })
  it('joins three kinds with commas and "and"', () => {
    const levels = ['under_20k', 'from_20k_to_49k', 'from_50k_to_74k', 'from_75k']
    const cells = levels.flatMap((level) => ['2021', '2024'].map((yearSet) => ({ yearSet, group: 'family_income', level, p: 0.2 })))
    const trends = levels.map((level, i) => ({ group: 'family_income', level, yearA: 2021, yearB: 2024, diff: i === 1 ? 0.03 : -0.03, p: i === 3 ? 0.5 : 0.01 }))
    expect(headline('mde_py', 'split=family_income', cells, trends)).toBe(
      'From 2021 to 2024, the share of teens ages 12–17 who had a major depressive episode in the past year fell in two of the four groups shown, rose in one and was about the same in one.',
    )
  })
})

describe('trendHeadline wording', () => {
  it('never uses causal or alarm words', () => {
    const outputs = [
      headline('mde_py', '', overall, [{ yearA: 2021, yearB: 2024, diff: -0.057, p: 0 }]),
      headline('mde_py', '', overall, [{ yearA: 2021, yearB: 2024, diff: 0.057, p: 0 }]),
      headline('mde_py', '', overall, [{ yearA: 2021, yearB: 2024, diff: -0.057, p: 0.3 }]),
      headline('mde_py', '', overall, []),
      headline('suicide_thoughts', 'split=sex', [], []),
    ]
    for (const text of outputs) expect(text).not.toMatch(BANNED)
  })
})
