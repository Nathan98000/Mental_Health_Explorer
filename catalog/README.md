# Catalog

What the site measures, as data rather than code:

- `indicators.yaml` — one entry per indicator and cohort: id, label, takeaway phrase, plain-language
  definition, source variable, the codes that count as yes and no, an optional universe (denominator
  restriction), the years the item was collected, caveats and launch status.
- `groups.yaml` — breakdown groups (sex, race and ethnicity, income, ...) with their levels and codes.
- `schema.json` — JSON Schema for both files; `python -m pytest pipeline/tests` validates them.
- `puf_columns.txt` — the header of the NSDUH 2021–2024 public use file, so CI can check that every
  source variable exists without the data.

Codes come from the combined 2021–2024 PUF codebook. The local validation tests check every source
variable's unweighted frequencies against the codebook's `Freq` column and each indicator's years
against the data.
