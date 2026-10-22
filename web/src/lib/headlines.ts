import type { Cohort } from './data'

/**
 * The six headline measures on the overview, per cohort, in display order. A measure both cohorts
 * share (mde_py, suicide_thoughts, marijuana_py) sits in the same slot for both, so switching cohorts
 * keeps it in place.
 */
export const HEADLINES: Record<Cohort, readonly string[]> = {
  teen: ['mde_py', 'mde_severe', 'suicide_thoughts', 'nicotine_vape_py', 'marijuana_py', 'alcohol_pm'],
  young_adult: ['mde_py', 'spd_py', 'suicide_thoughts', 'ami_py', 'marijuana_py', 'binge_pm'],
}

/** Headline measures that are part of another one on the same page: the tile says so, e.g. severe depression is part of all depression. */
export const SUBSET_OF: Partial<Record<string, string>> = { mde_severe: 'mde_py' }
