import type { Cohort } from './data'

/** The six headline measures on the overview, per cohort, in display order. */
export const HEADLINES: Record<Cohort, readonly string[]> = {
  teen: ['mde_py', 'mde_severe', 'suicide_thoughts', 'nicotine_vape_py', 'marijuana_py', 'alcohol_pm'],
  young_adult: ['mde_py', 'spd_py', 'ami_py', 'suicide_thoughts', 'binge_pm', 'marijuana_py'],
}
