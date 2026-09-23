# Mental Health Explorer

An interactive, public website for exploring youth mental health in the United States, built on the
National Survey on Drug Use and Health (NSDUH) 2021–2024 public use file from SAMHSA. It covers teens
ages 12–17 and young adults ages 18–25.

**Status:** phase 2 (estimation engine) — committed estimates, tests and associations; the Home page reads them. Phase 3 adds the explorer pages.
**Live site:** https://nathan98000.github.io/Mental_Health_Explorer/

## How it fits together

```
raw NSDUH file (local only, 1.6 GB)
  └─ pipeline/  (Python + DuckDB, runs on your computer)
       ingest → harmonize → cube (estimates) → models.R (odds ratios)  ──►  data/  (JSON, committed)
                                                                              └─ web/  (React + TypeScript + Vite)  ──►  GitHub Pages
```

Every number on the site is a survey-weighted estimate with a 95% confidence interval and a
suppression check, following the NSDUH public use file users' guide.

| Folder | What's in it |
| --- | --- |
| `pipeline/` | Ingest (column selection → Parquet), harmonize (catalog → 1/0 indicator columns), the design-based estimator (`estimate.py` reference, `cube.py` vectorized), associations (`associations.py` + `models.R`), manifest, fixtures and the microdata export |
| `catalog/` | Indicator and group definitions (`indicators.yaml`, `groups.yaml`, `schema.json`) and the PUF column list |
| `validation/` | Local-only checks: codebook golden tables, R `survey` cross-check, codebook frequencies, regressions; `REPORT.md` |
| `data/` | Committed pipeline outputs read by the site: estimate shards, associations, manifest, availability and JSON schemas (see `data/README.md`) |
| `web/` | The website |

## Running it locally

Website:

```bash
cd web
npm install
npm run dev        # http://localhost:5173/Mental_Health_Explorer/
npm test && npm run lint && npm run typecheck
```

Pipeline (Python 3.11+):

```bash
pip install -r pipeline/requirements.txt
python -m pytest -q                                   # estimator + catalog tests (no data needed)
export NSDUH_RAW="/path/to/NSDUH_2021_2024_Tab.txt"   # the raw file never goes in the repo
python -m pipeline.ingest --catalog                   # -> pipeline/.cache/catalog.parquet (all rows, catalog columns)
python -m pipeline.harmonize                          # -> pipeline/.cache/harmonized.parquet + data/availability.json
python -m pipeline.cube                               # -> data/estimates/{cohort}/{indicator}.json + data/manifest.json (~30 s)
python -m pipeline.associations                       # -> data/associations/{cohort}.json; runs Rscript pipeline/models.R (~1 min)
python -m pipeline.export_microdata                   # -> pipeline/.cache/microdata_12_25.parquet (git-ignored, advanced mode)
python -m pipeline.make_fixtures                      # -> validation/fixtures/estimator.json (pins the TypeScript port)
python -m pytest validation -q                        # golden tables, R cross-check, codebook frequencies, regressions (~3 min)
python -m validation.report                           # -> validation/REPORT.md
```

R (for the odds ratios and the cross-check): install R (`brew install r` on macOS), then
`Rscript -e 'install.packages(c("survey","jsonlite"), repos="https://cloud.r-project.org")'`.
`pipeline/models.R` and `validation/crosscheck.R` are called by the Python drivers above with a CSV extract and a JSON job list.

## Data source and terms

Substance Abuse and Mental Health Services Administration, Center for Behavioral Health Statistics and
Quality. National Survey on Drug Use and Health 2021–2024 (combined public use file). Estimates here are
computed from the public file and may differ slightly from SAMHSA's published figures, which use the
restricted-use file. SAMHSA's data may be used only for statistical purposes; any attempt to identify
individual respondents is prohibited.

If you or someone you know is struggling, call or text 988 or chat at 988lifeline.org.
