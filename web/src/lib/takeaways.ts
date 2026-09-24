/**
 * Plain-language takeaways. Pure functions: the callers look up the numbers and tests, these
 * only decide the wording. Change and difference wording is used only when the test says so;
 * nothing here is causal or alarming.
 */
import { formatPct, oneInN } from './format'

export const SIGNIFICANCE = 0.05
export const SUPPRESSED_TAKEAWAY = 'Not enough responses to report this reliably.'

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
 * A wide interval gives the range instead: "Between 2% and 15% of … (best estimate 6%, 2024)."
 */
export function levelSentence({ p, lo, hi, population, phrase, when }: LevelInput): string {
  if (isWideInterval(lo, hi)) return `Between ${formatPct(lo as number)} and ${formatPct(hi as number)} of ${population} ${phrase} (best estimate ${formatPct(p)}, ${when}).`
  const ratio = oneInN(p)
  if (ratio) return `About ${ratio} ${population} ${phrase} (${formatPct(p)}, ${when}).`
  return `${formatPct(p)} of ${population} ${phrase} (${when}).`
}

export type ChangeKind = 'fell' | 'rose' | 'same'

/** Direction of a year-vs-year change when the test is significant, "same" otherwise, null when not testable. */
export function changeKind(diff: number | null | undefined, pValue: number | null | undefined): ChangeKind | null {
  if (diff === null || diff === undefined || pValue === null || pValue === undefined) return null
  if (pValue < SIGNIFICANCE) return diff < 0 ? 'fell' : 'rose'
  return 'same'
}

export type ChangeInput = { priorP: number; priorYear: number; diff: number | null; pValue: number | null }

/** "That's down from 21% in 2021." / "That's about the same as in 2021 (21%)." / null when not testable. */
export function changeSentence({ priorP, priorYear, diff, pValue }: ChangeInput): string | null {
  const kind = changeKind(diff, pValue)
  if (!kind) return null
  if (kind === 'same') return `That's about the same as in ${priorYear} (${formatPct(priorP)}).`
  return `That's ${kind === 'fell' ? 'down' : 'up'} from ${formatPct(priorP)} in ${priorYear}.`
}

/** Short marker for headline tiles: "Fell since 2021", "Rose since 2021", "About the same as 2021". */
export function changeLabel(kind: ChangeKind, sinceYear: number): string {
  if (kind === 'fell') return `Fell since ${sinceYear}`
  if (kind === 'rose') return `Rose since ${sinceYear}`
  return `About the same as ${sinceYear}`
}

export type VsOverallInput = {
  overallP: number
  /** Short cohort noun, e.g. "teens", with the denominator clause when there is one ("teens who had a major depressive episode in the past year"). */
  people: string
  overallSignificant: boolean
  diff: number | null
  pValue: number | null
}

/** "That's higher than all teens (15%)." only when the group test and this level's test are both significant; otherwise "similar". */
export function vsOverallSentence({ overallP, people, overallSignificant, diff, pValue }: VsOverallInput): string {
  const differs = overallSignificant && diff !== null && pValue !== null && pValue < SIGNIFICANCE
  if (differs) return `That's ${diff > 0 ? 'higher' : 'lower'} than all ${people} (${formatPct(overallP)}).`
  return `That's similar to all ${people} (${formatPct(overallP)}).`
}

export type TakeawayInput = {
  suppressed: boolean
  level: LevelInput | null
  change?: ChangeInput | null
  vsOverall?: VsOverallInput | null
}

/** The sentences for an estimate card: level, then change, then comparison with everyone. */
export function takeaway({ suppressed, level, change, vsOverall }: TakeawayInput): string[] {
  if (suppressed || !level) return [SUPPRESSED_TAKEAWAY]
  const sentences = [levelSentence(level)]
  const changed = change ? changeSentence(change) : null
  if (changed) sentences.push(changed)
  if (vsOverall) sentences.push(vsOverallSentence(vsOverall))
  return sentences
}
