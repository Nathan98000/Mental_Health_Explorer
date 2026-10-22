/**
 * Plain-language takeaways. Pure functions: the callers look up the numbers and tests, these
 * only decide the wording. Change and difference wording is used only when the test says so;
 * nothing here is causal or alarming.
 */
import { formatPct, formatShare, formatSharePair, oneInN } from './format'

export const SIGNIFICANCE = 0.05
export const SUPPRESSED_TAKEAWAY = 'Not enough responses to report this reliably.'
export const IMPRECISE_TAKEAWAY = 'This estimate is too imprecise to report reliably.'
export const SAME_ANSWER_TAKEAWAY = "Everyone surveyed in this group gave the same answer, so this can't be estimated reliably."

/** The suppression note for a cell's reason: too imprecise, an estimate of 0% or 100%, or (the default) too few responses. */
export function suppressedTakeaway(reason: string | null | undefined): string {
  if (reason && /imprecise/i.test(reason)) return IMPRECISE_TAKEAWAY
  if (reason && /0% or 100%/.test(reason)) return SAME_ANSWER_TAKEAWAY
  return SUPPRESSED_TAKEAWAY
}

/** A 95% interval is "wide" when it spans at least this many points (10)... */
export const WIDE_INTERVAL_POINTS = 0.1
/** ...or its upper end is at least this many times its lower end (3). */
export const WIDE_INTERVAL_RATIO = 3

/** The one rule for an imprecise estimate: hi − lo ≥ 0.10 or hi / lo ≥ 3. False when either end is missing. */
export function isWideInterval(lo: number | null | undefined, hi: number | null | undefined): boolean {
  if (lo === null || lo === undefined || hi === null || hi === undefined) return false
  return hi - lo >= WIDE_INTERVAL_POINTS || (lo <= 0 ? hi > 0 : hi / lo >= WIDE_INTERVAL_RATIO)
}

export type LevelInput = {
  p: number
  /** 95% interval; when it is wide the sentence gives the range instead of "1 in N". */
  lo?: number | null
  hi?: number | null
  /** Population wording from the catalog, e.g. "teens ages 12–17" or "female teens ages 12–17". */
  population: string
  /** Indicator phrase from the catalog, e.g. "had a major depressive episode in the past year". */
  phrase: string
  /** When, e.g. "2024" or "2021–2024 combined". */
  when: string
}

/**
 * "About 1 in 7 teens ages 12–17 had a major depressive episode in the past year (15%, 2024)."
 * A wide interval gives the range instead, both ends with one decimal like every interval: "Between 2.1% and 15.2% of … (best estimate 6.1%, 2024)."
 */
export function levelSentence({ p, lo, hi, population, phrase, when }: LevelInput): string {
  if (isWideInterval(lo, hi)) return `Between ${formatPct(lo as number, 1)} and ${formatPct(hi as number, 1)} of ${population} ${phrase} (best estimate ${formatShare(p)}, ${when}).`
  const ratio = oneInN(p)
  if (ratio) return `About ${ratio} ${population} ${phrase} (${formatShare(p)}, ${when}).`
  return `${formatShare(p)} of ${population} ${phrase} (${when}).`
}

export type ChangeKind = 'fell' | 'rose' | 'same'

/** Direction of a year-vs-year change when the test is significant, "same" otherwise, null when not testable. */
export function changeKind(diff: number | null | undefined, pValue: number | null | undefined): ChangeKind | null {
  if (diff === null || diff === undefined || pValue === null || pValue === undefined) return null
  if (pValue < SIGNIFICANCE) return diff < 0 ? 'fell' : 'rose'
  return 'same'
}

/** `p` is the value the change ends at; the prior value is formatted with it under the pair rule (format.ts). */
export type ChangeInput = { priorP: number; priorYear: number; diff: number | null; pValue: number | null; p: number }

/** "That's down from 21% in 2021." / "That's about the same as in 2021 (21%)." / null when not testable. */
export function changeSentence({ priorP, priorYear, diff, pValue, p }: ChangeInput): string | null {
  const kind = changeKind(diff, pValue)
  if (!kind) return null
  const [prior] = formatSharePair(priorP, p)
  if (kind === 'same') return `That's about the same as in ${priorYear} (${prior}).`
  return `That's ${kind === 'fell' ? 'down' : 'up'} from ${prior} in ${priorYear}.`
}

/** The change line on an overview tile: "↓ Down from 21% in 2021", "↑ Up from 5% in 2022", "About the same as in 2021 (11%)". */
export function tileChange(kind: ChangeKind, priorP: number, priorYear: number, latestP: number): string {
  const [prior] = formatSharePair(priorP, latestP)
  if (kind === 'fell') return `↓ Down from ${prior} in ${priorYear}`
  if (kind === 'rose') return `↑ Up from ${prior} in ${priorYear}`
  return `About the same as in ${priorYear} (${prior})`
}

/** The overview's clause for each change kind, in the order the clauses are read. */
const SUMMARY_CLAUSE: Record<ChangeKind, (n: number) => string> = {
  fell: (n) => `${countWord(n)} fell`,
  rose: (n) => `${countWord(n)} rose`,
  same: (n) => `${countWord(n)} ${n === 1 ? 'was' : 'were'} about the same`,
}

/**
 * The overview's answer, from each tile's change kind (null when it has no test):
 * "Of these six measures, one fell and five were about the same between the first year each was asked and 2024."
 * `latestYear` is null when the tiles' latest years differ; the result is null when no tile has a test.
 */
export function overviewSummary(kinds: (ChangeKind | null)[], latestYear: number | null): string | null {
  const testable = kinds.filter((k): k is ChangeKind => k !== null)
  if (!testable.length) return null
  const clauses = (['fell', 'rose', 'same'] as const).map((kind) => ({ kind, n: testable.filter((k) => k === kind).length })).filter((c) => c.n > 0).map((c) => SUMMARY_CLAUSE[c.kind](c.n))
  const joined = clauses.length === 1 ? clauses[0] : `${clauses.slice(0, -1).join(', ')} and ${clauses[clauses.length - 1]}`
  const untestable = kinds.length - testable.length
  const tail = untestable ? `; ${countWord(untestable)} could not be compared` : ''
  return `Of these ${countWord(kinds.length)} measures, ${joined} between the first year each was asked and ${latestYear ?? 'the latest year'}${tail}.`
}

export type VsOverallInput = {
  overallP: number
  /** The level's own value, formatted with the overall value under the pair rule. */
  p: number
  /** Short cohort noun, e.g. "teens", with the denominator clause when there is one ("teens who had a major depressive episode in the past year"). */
  people: string
  overallSignificant: boolean
  diff: number | null
  pValue: number | null
}

export type VsOverallKind = 'higher' | 'lower' | 'similar'

/** "higher" or "lower" only when the group test and this level's test are both significant; "similar" otherwise; null when the level was not tested. */
export function vsOverallKind(overallSignificant: boolean, diff: number | null | undefined, pValue: number | null | undefined): VsOverallKind | null {
  if (diff === null || diff === undefined || pValue === null || pValue === undefined) return null
  if (overallSignificant && pValue < SIGNIFICANCE) return diff > 0 ? 'higher' : 'lower'
  return 'similar'
}

/** "That's higher than all teens (15%)." only when the group test and this level's test are both significant; otherwise "similar". */
export function vsOverallSentence({ overallP, p, people, overallSignificant, diff, pValue }: VsOverallInput): string {
  const kind = vsOverallKind(overallSignificant, diff, pValue)
  const [, overall] = formatSharePair(p, overallP)
  if (kind === 'higher' || kind === 'lower') return `That's ${kind} than all ${people} (${overall}).`
  return `That's similar to all ${people} (${overall}).`
}

export type TakeawayInput = {
  suppressed: boolean
  /** The cell's suppression reason, for the wording of the note. */
  reason?: string | null
  level: LevelInput | null
  change?: ChangeInput | null
  vsOverall?: VsOverallInput | null
}

/** The sentences for an estimate card: level, then change, then comparison with everyone. */
export function takeaway({ suppressed, reason, level, change, vsOverall }: TakeawayInput): string[] {
  if (suppressed || !level) return [suppressedTakeaway(reason)]
  const sentences = [levelSentence(level)]
  const changed = change ? changeSentence(change) : null
  if (changed) sentences.push(changed)
  if (vsOverall) sentences.push(vsOverallSentence(vsOverall))
  return sentences
}

/** Small counts as words, e.g. 3 -> "three"; 11 and up stay as digits. */
export function countWord(n: number): string {
  return ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][n] ?? String(n)
}

const CHANGE_VERB: Record<ChangeKind, string> = { fell: 'fell', rose: 'rose', same: 'was about the same' }

export type TrendHeadlineInput = {
  /** The cohort phrase, e.g. "teens ages 12–17". */
  cohort: string
  /** The cohort phrase with the measure's denominator clause, e.g. "teens ages 12–17 who had a major depressive episode in the past year". */
  people: string
  /** The measure's denominator clause, or null when it is asked of everyone. */
  universe: string | null
  phrase: string
  yearA: number
  yearB: number
  /** One entry per series: its change kind (null when not testable) and its values in the two years. */
  series: { kind: ChangeKind | null; a: number | null; b: number | null }[]
  split: boolean
}

/** One series' change: "fell from 21% in 2021 to 15% in 2024" / "was about the same in 2024 (15%) as in 2021 (16%)". */
function changeClause(kind: ChangeKind, a: number, b: number, yearA: number, yearB: number): string {
  const [fa, fb] = formatSharePair(a, b)
  if (kind === 'same') return `was about the same in ${yearB} (${fb}) as in ${yearA} (${fa})`
  return `${kind} from ${fa} in ${yearA} to ${fb} in ${yearB}`
}

/** The answer-first sentence above a trend chart; changes are named only when the test says so. */
export function trendHeadlineSentence({ cohort, people, universe, phrase, yearA, yearB, series, split }: TrendHeadlineInput): string {
  if (!split) {
    const s = series[0]
    if (!s || !s.kind || s.a === null || s.b === null) return `The ${yearA} and ${yearB} estimates for ${people} can't be compared.`
    const clause = changeClause(s.kind, s.a, s.b, yearA, yearB)
    return universe ? `Among ${cohort} ${universe}, the share who ${phrase} ${clause}.` : `The share of ${people} who ${phrase} ${clause}.`
  }
  const lead = universe ? `From ${yearA} to ${yearB}, among ${cohort} ${universe}, the share who ${phrase}` : `From ${yearA} to ${yearB}, the share of ${people} who ${phrase}`
  const testable = series.filter((s) => s.kind !== null)
  const untestable = series.length - testable.length
  if (!testable.length) return `The ${yearA} and ${yearB} estimates for ${people} can't be compared in any group shown.`
  const counts = (['fell', 'rose', 'same'] as const).map((kind) => ({ kind, n: testable.filter((s) => s.kind === kind).length })).filter((c) => c.n > 0)
  const tail = untestable ? `; ${countWord(untestable)} could not be compared` : ''
  if (counts.length === 1 && !untestable) return `${lead} ${CHANGE_VERB[counts[0].kind]} in every group shown.`
  const clauses = counts.map((c, i) => (i === 0 ? `${CHANGE_VERB[c.kind]} in ${countWord(c.n)} of the ${countWord(series.length)} groups shown` : `${CHANGE_VERB[c.kind]} in ${countWord(c.n)}`))
  const joined = clauses.length === 1 ? clauses[0] : `${clauses.slice(0, -1).join(', ')} and ${clauses[clauses.length - 1]}`
  return `${lead} ${joined}${tail}.`
}
