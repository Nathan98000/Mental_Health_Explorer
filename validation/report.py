"""Write validation/REPORT.md: golden-table match counts, R cross-check maxima, cell counts
and suppression rates per cohort, and output file sizes. Local only (raw file + Rscript):

    NSDUH_RAW=/path/to/NSDUH_2021_2024_Tab.txt python -m validation.report
"""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

from pipeline import catalog, config
from pipeline.manifest import MANIFEST_PATH
from validation import crosscheck, golden
from validation.data import load_harmonized

REPORT_PATH = Path(__file__).parent / "REPORT.md"


def golden_section() -> list[str]:
    result = golden.compare(golden.extract())
    s = golden.summary(result)
    lines = [
        "## Golden tables (codebook Tables 4a/4b and 5a/5b)",
        "",
        "Every printed cell recomputed from the raw file with `pipeline.cube` and compared at printed precision.",
        "",
        "| Quantity | Matched | Of |",
        "| --- | ---: | ---: |",
        f"| Percentages (1 decimal) | {s['pct']['matched']} | {s['pct']['of']} |",
        f"| Standard errors of percentages (2 decimals) | {s['se']['matched']} | {s['se']['of']} |",
        f"| Total point estimates (thousands) | {s['total']['matched']} | {s['total']['of']} |",
        f"| **All cells** | **{s['matched']}** | **{s['cells']}** |",
        "",
    ]
    bad = result[~(result["pct_match"] & result["se_match"] & result["total_match"])]
    if len(bad):
        lines += ["Mismatches:", ""]
        lines += [f"- Table {r.table} {r.measure} {r.age} {r.label}: {r.pct} vs {r.target_pct}, SE {r.se} vs {r.target_se}, total {r.total} vs {r.target_total}" for r in bad.itertuples()]
        lines.append("")
    return lines


def crosscheck_section(frame) -> list[str]:
    s = crosscheck.run(frame)
    c, g, y = s["cells"], s["group_tests"], s["year_diffs"]
    return [
        "## R cross-check (survey package)",
        "",
        "Random cells from the launch catalog, computed by `pipeline.cube` and by R's `survey` package on the users' guide design",
        "(`svydesign(id=~VEREP, strata=~VESTR_C, weights=~w, nest=TRUE)`, `subset()` for domains). Largest discrepancies:",
        "",
        "| Check | n | Maximum | Tolerance |",
        "| --- | ---: | ---: | ---: |",
        f"| Cell proportion, absolute difference (percentage points) | {c['n']} | {c['max_dp_points']:.2e} | {c['tolerance']['dp_points']} |",
        f"| Cell SE, relative difference (`svyby(..., svymean)`) | {c['n']} | {c['max_se_rel']:.2e} | {c['tolerance']['se_rel']} |",
        f"| Group test W, relative difference (`svyby(..., covmat=TRUE)` + `vcov`) | {g['n']} | {g['max_w_rel']:.2e} | {g['tolerance']['w_rel']} |",
        f"| Year-difference SE, relative difference (`svycontrast`) | {y['n']} | {y['max_se_rel']:.2e} | {y['tolerance']['se_rel']} |",
        "",
        f"Result: **{'passed' if s['passed'] else 'FAILED'}**.",
        "",
    ]


def cells_section() -> list[str]:
    lines = ["## Estimate cells and suppression", "", "| Cohort | Indicators | Cells | Suppressed | Rate | One-way cells suppressed | Two-way cells suppressed |", "| --- | ---: | ---: | ---: | ---: | ---: | ---: |"]
    for cohort in catalog.COHORT_CODES:
        total = suppressed = one_way = one_way_sup = two_way = two_way_sup = files = 0
        for path in sorted((config.OUTPUT_DIR / "estimates" / cohort).glob("*.json")):
            doc = json.loads(path.read_text(encoding="utf-8"))
            files += 1
            for sup, g2 in zip(doc["cells"]["suppressed"], doc["cells"]["group2"]):
                total += 1
                suppressed += sup
                if g2 is None:
                    one_way += 1
                    one_way_sup += sup
                else:
                    two_way += 1
                    two_way_sup += sup
        lines.append(f"| {cohort} | {files} | {total:,} | {suppressed:,} | {100 * suppressed / total:.1f}% | {one_way_sup:,} of {one_way:,} | {two_way_sup:,} of {two_way:,} |")
    lines.append("")
    return lines


def sizes_section() -> list[str]:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    by_dir: dict[str, list[int]] = {}
    for name, entry in manifest["files"].items():
        by_dir.setdefault(name.split("/")[0], []).append(entry["bytes"])
    lines = ["## Output files (data/)", "", "| Folder | Files | Total | Largest |", "| --- | ---: | ---: | ---: |"]
    for folder, sizes in sorted(by_dir.items()):
        lines.append(f"| {folder} | {len(sizes)} | {sum(sizes) / 1e6:.2f} MB | {max(sizes) / 1000:.0f} KB |")
    total = sum(e["bytes"] for e in manifest["files"].values())
    lines.append(f"| **all** | {len(manifest['files'])} | **{total / 1e6:.2f} MB** | |")
    lines += ["", f"Manifest: generated {manifest['generated']}, pipeline `{(manifest['pipeline_sha'] or 'n/a')[:12]}`, catalog hash `{manifest['catalog_hash'][:12]}…`.", ""]
    return lines


def main() -> None:
    frame = load_harmonized()
    lines = [
        "# Validation report",
        "",
        f"Generated {dt.date.today().isoformat()} by `python -m validation.report` from the local NSDUH 2021–2024 public use file.",
        "",
        *golden_section(),
        *crosscheck_section(frame),
        *cells_section(),
        *sizes_section(),
    ]
    REPORT_PATH.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
    print(f"Wrote {REPORT_PATH}")


if __name__ == "__main__":
    main()
