# Validation report

Generated 2026-09-23 by `python -m validation.report` from the local NSDUH 2021–2024 public use file.

## Golden tables (codebook Tables 4a/4b and 5a/5b)

Every printed cell recomputed from the raw file with `pipeline.cube` and compared at printed precision.

| Quantity | Matched | Of |
| --- | ---: | ---: |
| Percentages (1 decimal) | 82 | 82 |
| Standard errors of percentages (2 decimals) | 82 | 82 |
| Total point estimates (thousands) | 82 | 82 |
| **All cells** | **246** | **246** |

## R cross-check (survey package)

Random cells from the launch catalog, computed by `pipeline.cube` and by R's `survey` package on the users' guide design
(`svydesign(id=~VEREP, strata=~VESTR_C, weights=~w, nest=TRUE)`, `subset()` for domains). Largest discrepancies:

| Check | n | Maximum | Tolerance |
| --- | ---: | ---: | ---: |
| Cell proportion, absolute difference (percentage points) | 100 | 3.77e-13 | 0.001 |
| Cell SE, relative difference (`svyby(..., svymean)`) | 100 | 8.28e-15 | 0.005 |
| Group test W, relative difference (`svyby(..., covmat=TRUE)` + `vcov`) | 10 | 1.44e-13 | 0.005 |
| Year-difference SE, relative difference (`svycontrast`) | 10 | 9.89e-15 | 0.005 |

Result: **passed**.

## Estimate cells and suppression

| Cohort | Indicators | Cells | Suppressed | Rate | One-way cells suppressed | Two-way cells suppressed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| teen | 37 | 63,176 | 7,975 | 12.6% | 288 of 5,936 | 7,687 of 57,240 |
| young_adult | 21 | 51,909 | 3,036 | 5.8% | 119 of 3,993 | 2,917 of 47,916 |

## Output files (data/)

| Folder | Files | Total | Largest |
| --- | ---: | ---: | ---: |
| associations | 2 | 0.34 MB | 224 KB |
| availability.json | 1 | 0.02 MB | 17 KB |
| estimates | 58 | 14.85 MB | 334 KB |
| **all** | 61 | **15.21 MB** | |

Manifest: generated 2026-09-23, pipeline `29bd4d09bf42`, catalog hash `cd4876b86922…`.

## Site (Lighthouse, mobile, preview build)

Lighthouse 13.5.0 on 2026-09-24, mobile emulation against `vite preview` in local Chrome. Targets: performance ≥ 90 and accessibility ≥ 95.

| Page | Performance | Accessibility | LCP | Total blocking time | CLS |
| --- | ---: | ---: | ---: | ---: | ---: |
| `/` | 91 | 100 | 3.4 s | 0 ms | 0 |
| `/explore/teen/mde_py` | 95 | 100 | 2.9 s | 0 ms | 0 |

The Playwright suite (`npm run e2e`) checks every route with axe (WCAG 2.1 A and AA) in light and dark mode at 1280 px and 390 px, and that nothing scrolls horizontally at 360 px.
