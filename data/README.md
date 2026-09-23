# Data outputs

Small, reviewed outputs from `pipeline/` that the website reads. Generated locally and committed; the
raw NSDUH file is never stored here.

- `availability.json` — for each cohort, indicator and survey year: whether the item was collected
  that year and how many respondents have a yes/no value (from `python -m pipeline.harmonize`).
- Estimate shards and the advanced-mode microdata extract arrive in phase 2.
