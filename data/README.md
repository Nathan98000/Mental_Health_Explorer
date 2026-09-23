# Data outputs

Small, reviewed outputs from `pipeline/` that the website reads. Generated locally and committed; the
raw NSDUH file is never stored here. Every file is deterministic: re-running the pipeline on the same
commit produces no diff. `schema/` holds JSON Schemas that CI validates the files against.

- `availability.json` — for each cohort, indicator and survey year: whether the item was collected
  that year and how many respondents have a yes/no value (from `python -m pipeline.harmonize`).
- `estimates/{cohort}/{indicator}.json` — one shard per launch indicator (`python -m pipeline.cube`,
  `schema/estimates.schema.json`). `year_sets`: each collected single year (ANALWT2_C1), `all`
  collected years (ANALWT2_Ck) and `recent2` (ANALWT2_C2). `cells` are column-wise parallel arrays:
  overall (`group` null), every one-way level, and every two-way cross of groups (with
  `race_ethnicity_5`); fields `p`, `lo`, `hi`, `se` (5 decimals), `n` (unweighted), `pop` (estimated
  number with a yes, nearest 1,000; an annual average for pooled year sets), `suppressed`, `reason`.
  Suppressed cells (users' guide Table 11.1) carry nulls. `trend_tests`: overall and one-way levels,
  every pair of single years (`diff` = later minus earlier, linearized `se`, two-sided t test on 50 df).
  `group_tests`: per year set and one-way group, the adjusted Wald F across the levels that are not
  suppressed, each level vs. overall, and a pairwise p-value matrix to be read only when
  `overall_significant`. Shards stay under 500 KB (`crosses` lists the year sets that keep two-way
  cells if one had to be trimmed). Totals are point estimates only (NSDUH uses an alternative SE method
  for some domains).
- `associations/{cohort}.json` — (`python -m pipeline.associations`, `schema/associations.schema.json`)
  for every outcome (depression/suicide, mental illness) × exposure (substance use, school/family/peers,
  health) in the latest and in all common collected years: the outcome rate among the exposed and the
  unexposed, their difference with a t test, the unadjusted odds ratio and the odds ratio adjusted for
  age band, sex, race/ethnicity (5 groups) and poverty, fitted with R `survey::svyglm`
  (quasibinomial; CI = exp(b ± t50·SE)). Odds ratios are null with a reason when a rate is suppressed
  or the model fails. `or_matrix`: unadjusted odds ratios for every unordered pair, latest common year.
- `manifest.json` — every file above with its size and SHA-256, the catalog content hash, the pipeline
  git SHA at generation time and the generation date.

The site copies these into `web/public/data/` before `npm run dev` and `npm run build`
(`web/scripts/sync-data.mjs`).
