import fixtures from '../../../validation/fixtures/estimator.json'
import { differenceTest, logitCI, proportion, suppression, tCdf, tTwoSidedP, taylorVariance } from './estimator'

const TOL = 1e-9

type ProportionCase = {
  name: string
  kind: 'proportion'
  y: (number | null)[]
  w: number[]
  stratum: number[]
  psu: number[]
  domain: boolean[] | null
  expected: { p: number | null; se: number | null; lo: number | null; hi: number | null; n: number; weighted_n: number | null; suppressed: boolean; reason: string | null }
}

type DifferenceCase = {
  name: string
  kind: 'difference'
  y: (number | null)[]
  w: number[]
  stratum: number[]
  psu: number[]
  domain_a: boolean[]
  domain_b: boolean[]
  expected: { diff: number | null; se: number | null; t: number | null; p_value: number | null }
}

type Fixtures = { df: number; t_crit: number; t_cdf: { x: number; cdf: number }[]; cases: (ProportionCase | DifferenceCase)[] }

const doc = fixtures as Fixtures

/** Python writes NaN as null; the port returns NaN. */
function expectClose(actual: number, expected: number | null, label: string) {
  if (expected === null) {
    expect(actual, label).toBeNaN()
  } else {
    expect(Math.abs(actual - expected), `${label}: ${actual} vs ${expected}`).toBeLessThanOrEqual(TOL)
  }
}

describe('estimator fixtures (Python parity)', () => {
  const proportions = doc.cases.filter((c): c is ProportionCase => c.kind === 'proportion')
  const differences = doc.cases.filter((c): c is DifferenceCase => c.kind === 'difference')

  it('has the expected shape', () => {
    expect(doc.df).toBe(50)
    expect(proportions.length).toBeGreaterThan(10)
    expect(differences.length).toBeGreaterThan(3)
  })

  it.each(proportions.map((c) => [c.name, c] as const))('proportion: %s', (_name, c) => {
    const est = proportion(c.y, c.w, c.stratum, c.psu, c.domain)
    expectClose(est.p, c.expected.p, 'p')
    expectClose(est.se, c.expected.se, 'se')
    expectClose(est.lo, c.expected.lo, 'lo')
    expectClose(est.hi, c.expected.hi, 'hi')
    expectClose(est.weightedN, c.expected.weighted_n, 'weightedN')
    expect(est.n).toBe(c.expected.n)
    expect(est.suppressed).toBe(c.expected.suppressed)
    expect(est.reason).toBe(c.expected.reason)
  })

  it.each(differences.map((c) => [c.name, c] as const))('difference: %s', (_name, c) => {
    const test = differenceTest(c.y, c.w, c.stratum, c.psu, c.domain_a, c.domain_b)
    expectClose(test.diff, c.expected.diff, 'diff')
    expectClose(test.se, c.expected.se, 'se')
    expectClose(test.t, c.expected.t, 't')
    expectClose(test.pValue, c.expected.p_value, 'pValue')
  })

  it.each(doc.t_cdf.map((p) => [p.x, p.cdf] as const))('t(50) CDF at %s', (x, cdf) => {
    expectClose(tCdf(x, doc.df), cdf, 'cdf')
  })
})

describe('estimator basics', () => {
  it('reproduces the hand-computed tiny design (p = 0.5, SE = 0.125)', () => {
    const est = proportion([1, 0, 1, 0, 1, 0], [1, 1, 2, 1, 1, 2], [1, 1, 1, 2, 2, 2], [1, 1, 2, 1, 2, 2])
    expect(est.p).toBeCloseTo(0.5, 12)
    expect(est.se).toBeCloseTo(0.125, 12)
    expect(est.n).toBe(6)
    expect(est.weightedN).toBe(8)
  })

  it('ignores single-PSU strata in the variance', () => {
    expect(taylorVariance([0.1, -0.1, 0.3], [1, 1, 2], [1, 2, 1])).toBeCloseTo(2 * 0.1 ** 2 * 2, 12)
  })

  it('logit intervals are asymmetric, bounded and undefined at the ends', () => {
    const [lo, hi] = logitCI(0.05, 0.01)
    expect(lo).toBeGreaterThan(0)
    expect(hi).toBeLessThan(1)
    expect(0.05 - lo).toBeLessThan(hi - 0.05)
    expect(logitCI(0, 0.01)[0]).toBeNaN()
  })

  it('applies the 2024 suppression rule', () => {
    expect(suppression(0.2, 0.01, 49)).toBe('fewer than 50 respondents')
    expect(suppression(0, 0, 500)).toBe('estimate is 0% or 100%')
    expect(suppression(0.2, 0.01, 500)).toBeNull()
    expect(suppression(0.02, 0.014, 500)).toBe('estimate is too imprecise')
    expect(suppression(0.98, 0.014, 500)).toBe(suppression(0.02, 0.014, 500))
  })

  it('t distribution is symmetric and the critical value gives 5% two-sided', () => {
    expect(tCdf(0)).toBeCloseTo(0.5, 12)
    expect(tCdf(-1.7) + tCdf(1.7)).toBeCloseTo(1, 12)
    expect(tTwoSidedP(doc.t_crit)).toBeCloseTo(0.05, 9)
  })
})
