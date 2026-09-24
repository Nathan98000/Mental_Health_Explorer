# Catalog

What the site measures, as data rather than code:

- `indicators.yaml` — one entry per indicator and cohort: id, label, takeaway phrase, plain-language
  definition, source variable, the codes that count as yes and no, an optional universe (denominator
  restriction), the years the item was collected, caveats and launch status.
- `groups.yaml` — breakdown groups (sex, race and ethnicity, income, ...) with their levels and codes.
- `topics.yaml` — topics in display order; the only place topic wording lives.
- `schema.json` — JSON Schema for both files; `python -m pytest pipeline/tests` validates them.
- `puf_columns.txt` — the header of the NSDUH 2021–2024 public use file, so CI can check that every
  source variable exists without the data.

Codes come from the combined 2021–2024 PUF codebook. The local validation tests check every source
variable's unweighted frequencies against the codebook's `Freq` column and each indicator's years
against the data.

## Decisions

Confirmed for phase 1 and locked by `pipeline/tests/test_decisions.py`:

- `sud_py` (both cohorts) uses UD5ILALANY, drug **or** alcohol use disorder (yes = 1, no = 0); UD5ILAALANY
  means both at once and is not used.
- `difficulty_concentrating` (teens) uses LVLDIFMEM2 with yes = 3 ("a lot of difficulty or cannot do at
  all") and no = 1, 2, the Washington Group cutoff.
- Harmonized group columns store level ids (e.g. `female`, `from_20k_to_49k`); display labels live only in
  `groups.yaml`.
- Young-adult `spd_py`, `ami_py`, `smi_py` and `ami_and_sud` belong to topic `mental_illness`, displayed as
  "Mental illness and distress".

Confirmed in the phase 2 review:

- Pairs that are true by definition are left out of the associations (the public pairs and the advanced-mode
  odds-ratio matrix). One measure implying the other, directly or through a chain, is declared with `implies`
  in `indicators.yaml` (e.g. `mde_severe` ⇒ `mde_py` ⇒ `mde_lifetime`, `binge_pm` ⇒ `alcohol_pm`) and checked
  against the data locally (no respondent with A = 1 and B = 0).
- Odds-ratio matrix cells whose conditional rates include one that would be suppressed on its own are still
  fitted and published with `low_precision: true` and a precision note; a cell is null only when the model
  fails or a 2×2 cell has no respondents. The public pairs keep the strict suppression rule.
- The Home page note reads: "Early preview. This site is still being built. Numbers are computed from the
  survey and checked against SAMHSA's reference tables; a final review happens before launch."
