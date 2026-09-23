/**
 * Design-based estimates in the browser: a port of pipeline/estimate.py (and the
 * two-group contrast of pipeline/cube.py) for advanced mode.
 *
 * - weighted proportions with Taylor-linearized standard errors, strata × PSUs treated
 *   as a with-replacement design, domain estimation on the full sample;
 * - logit-transformed 95% confidence intervals with the t critical value (50 df);
 * - the 2024 NSDUH suppression rule (users' guide Table 11.1);
 * - the difference of two domain proportions with one linearized variable and a
 *   two-sided t test, using a dependency-free Student t CDF.
 *
 * validation/fixtures/estimator.json (from python -m pipeline.make_fixtures) pins the
 * outputs to the Python implementation.
 */

export const DEGREES_OF_FREEDOM = 50
/** Two-sided 95% critical value of Student's t with 50 df. */
export const T_CRIT_50 = 2.0085591121007611
export const SUPPRESSION_RSE_LIMIT = 0.175
export const SUPPRESSION_MIN_N = 50

export type Key = string | number
/** 1, 0, or null when not in the universe or missing. */
export type YValue = number | null

export type Estimate = {
  p: number
  se: number
  lo: number
  hi: number
  /** Unweighted respondents in the denominator. */
  n: number
  /** Sum of weights in the denominator. */
  weightedN: number
  suppressed: boolean
  reason: string | null
}

export type DifferenceTest = { diff: number; se: number; t: number; pValue: number }

/**
 * Between-PSU variance of linearized values z (with-replacement design):
 * sum_h n_h/(n_h - 1) sum_j (z_hj - mean_h)^2, where z_hj is the PSU total.
 * Strata with a single PSU contribute nothing.
 */
export function taylorVariance(z: number[], stratum: Key[], psu: Key[]): number {
  const totals = new Map<string, number>()
  const strata = new Map<string, string[]>()
  for (let i = 0; i < z.length; i++) {
    const h = String(stratum[i])
    const key = `${h}\u0000${String(psu[i])}`
    if (!totals.has(key)) {
      totals.set(key, 0)
      const members = strata.get(h)
      if (members) members.push(key)
      else strata.set(h, [key])
    }
    totals.set(key, (totals.get(key) as number) + z[i])
  }
  let variance = 0
  for (const keys of strata.values()) {
    const nh = keys.length
    if (nh < 2) continue
    let mean = 0
    for (const key of keys) mean += totals.get(key) as number
    mean /= nh
    let ss = 0
    for (const key of keys) ss += ((totals.get(key) as number) - mean) ** 2
    variance += (nh / (nh - 1)) * ss
  }
  return variance
}

/** 95% CI on the logit scale, as NSDUH does for proportions; NaN at 0 or 1. */
export function logitCI(p: number, se: number, tCrit = T_CRIT_50): [number, number] {
  if (!(p > 0 && p < 1) || !Number.isFinite(se)) return [NaN, NaN]
  const logit = Math.log(p / (1 - p))
  const half = (tCrit * se) / (p * (1 - p))
  const expit = (x: number) => 1 / (1 + Math.exp(-x))
  return [expit(logit - half), expit(logit + half)]
}

/** The reason an estimate must be suppressed, or null when it can be shown. */
export function suppression(p: number, se: number, n: number): string | null {
  if (n < SUPPRESSION_MIN_N) return `fewer than ${SUPPRESSION_MIN_N} respondents`
  if (p <= 0 || p >= 1) return 'estimate is 0% or 100%'
  const q = p <= 0.5 ? p : 1 - p
  if (se / q / -Math.log(q) > SUPPRESSION_RSE_LIMIT) return 'estimate is too imprecise'
  return null
}

function inScope(y: YValue[], domain?: boolean[] | null): boolean[] {
  return y.map((v, i) => v !== null && Number.isFinite(v) && (domain ? domain[i] : true))
}

/** Linearized values of a domain proportion, its estimate and denominator sizes. */
function linearize(y: YValue[], w: number[], scope: boolean[]) {
  let sumWy = 0
  let sumW = 0
  let n = 0
  for (let i = 0; i < y.length; i++) {
    if (!scope[i]) continue
    n += 1
    sumWy += w[i] * (y[i] as number)
    sumW += w[i]
  }
  const p = sumWy / sumW
  const z = y.map((v, i) => (scope[i] ? (w[i] * (v as number) - p * w[i]) / sumW : 0))
  return { p, z, n, sumW }
}

/**
 * Weighted proportion of y == 1 among respondents with non-missing y in the domain.
 * Respondents outside the domain are treated as missing but kept in the design.
 */
export function proportion(y: YValue[], w: number[], stratum: Key[], psu: Key[], domain?: boolean[] | null): Estimate {
  const scope = inScope(y, domain)
  const { p, z, n, sumW } = linearize(y, w, scope)
  if (n === 0) {
    return { p: NaN, se: NaN, lo: NaN, hi: NaN, n: 0, weightedN: 0, suppressed: true, reason: 'no respondents' }
  }
  const se = Math.sqrt(taylorVariance(z, stratum, psu))
  const [lo, hi] = logitCI(p, se)
  const reason = suppression(p, se, n)
  return { p, se, lo, hi, n, weightedN: sumW, suppressed: reason !== null, reason }
}

/**
 * p_A - p_B for two domains on the same records, with the SE of one linearized
 * variable z_A - z_B (so overlapping domains and shared PSUs are handled) and a
 * two-sided t test on `df` degrees of freedom.
 */
export function differenceTest(
  y: YValue[],
  w: number[],
  stratum: Key[],
  psu: Key[],
  domainA: boolean[],
  domainB: boolean[],
  df = DEGREES_OF_FREEDOM,
): DifferenceTest {
  const a = linearize(y, w, inScope(y, domainA))
  const b = linearize(y, w, inScope(y, domainB))
  const diff = a.p - b.p
  const se = Math.sqrt(taylorVariance(a.z.map((v, i) => v - b.z[i]), stratum, psu))
  const t = diff / se
  return { diff, se, t, pValue: Number.isFinite(t) ? tTwoSidedP(t, df) : NaN }
}

// ---------------------------------------------------------------- Student t CDF

/** log Γ(x) by the Lanczos approximation (g = 7, n = 9), ~1e-15 relative accuracy. */
export function logGamma(x: number): number {
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ]
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x)
  x -= 1
  let a = c[0]
  const t = x + 7.5
  for (let i = 1; i < 9; i++) a += c[i] / (x + i)
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a)
}

/** Continued fraction for the incomplete beta function (modified Lentz's method). */
function betaContinuedFraction(a: number, b: number, x: number): number {
  const tiny = 1e-300
  const eps = 1e-16
  const qab = a + b
  const qap = a + 1
  const qam = a - 1
  let c = 1
  let d = 1 - (qab * x) / qap
  if (Math.abs(d) < tiny) d = tiny
  d = 1 / d
  let h = d
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < tiny) d = tiny
    c = 1 + aa / c
    if (Math.abs(c) < tiny) c = tiny
    d = 1 / d
    h *= d * c
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < tiny) d = tiny
    c = 1 + aa / c
    if (Math.abs(c) < tiny) c = tiny
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < eps) break
  }
  return h
}

/** Regularized incomplete beta function I_x(a, b). */
export function regularizedIncompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x))
  if (x < (a + 1) / (a + b + 2)) return (front * betaContinuedFraction(a, b, x)) / a
  return 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b
}

/** Two-sided tail probability P(|T| > |t|) for Student's t with df degrees of freedom. */
export function tTwoSidedP(t: number, df = DEGREES_OF_FREEDOM): number {
  return regularizedIncompleteBeta(df / (df + t * t), df / 2, 0.5)
}

/** Cumulative distribution function of Student's t with df degrees of freedom. */
export function tCdf(x: number, df = DEGREES_OF_FREEDOM): number {
  const tail = 0.5 * tTwoSidedP(x, df)
  return x >= 0 ? 1 - tail : tail
}
