/** Format a proportion (0–1) as a percentage string, e.g. 0.1484 -> "15%". */
export function formatPct(p: number, digits = 0): string {
  return `${(p * 100).toFixed(digits)}%`
}

/** Format a confidence interval as "13.8% to 16.0%". */
export function formatRange(lo: number, hi: number, digits = 1): string {
  return `${formatPct(lo, digits)} to ${formatPct(hi, digits)}`
}

/**
 * Express a proportion as "1 in N" for plain-language takeaways.
 * Only meaningful for proportions at or below one half; larger values return null.
 */
export function oneInN(p: number): string | null {
  if (!(p > 0) || p > 0.5) return null
  return `1 in ${Math.round(1 / p)}`
}

/** Format a count with thousands separators, e.g. 10917 -> "10,917". */
export function formatCount(n: number): string {
  return n.toLocaleString('en-US')
}
