/**
 * Preview estimates for the placeholder home page, produced by the phase 0
 * prototype estimator (NSDUH 2021–2024 PUF, ANALWT2_C1, Taylor-linearized SEs,
 * logit 95% CIs with 50 df). These are replaced by pipeline outputs in phase 2.
 */
import type { TrendRow } from '../components/TrendChart'

export const MDE_SERIES = 'Major depressive episode'
export const MDE_SEVERE_SERIES = 'With severe impairment'

export const teenDepressionTrend: TrendRow[] = [
  { year: 2021, series: MDE_SERIES, p: 0.2054, lo: 0.192, hi: 0.2195 },
  { year: 2022, series: MDE_SERIES, p: 0.1932, lo: 0.1804, hi: 0.2067 },
  { year: 2023, series: MDE_SERIES, p: 0.1784, lo: 0.1659, hi: 0.1918 },
  { year: 2024, series: MDE_SERIES, p: 0.1484, lo: 0.1375, hi: 0.1599 },
  { year: 2021, series: MDE_SEVERE_SERIES, p: 0.1523, lo: 0.1391, hi: 0.1666 },
  { year: 2022, series: MDE_SEVERE_SERIES, p: 0.1434, lo: 0.1323, hi: 0.1551 },
  { year: 2023, series: MDE_SEVERE_SERIES, p: 0.1328, lo: 0.1214, hi: 0.1451 },
  { year: 2024, series: MDE_SEVERE_SERIES, p: 0.1098, lo: 0.1001, hi: 0.1203 },
]

export const teenMde2024 = { p: 0.1484, lo: 0.1375, hi: 0.1599, n: 10917, year: 2024 }
export const teenMde2021 = { p: 0.2054, lo: 0.192, hi: 0.2195, n: 10317, year: 2021 }
