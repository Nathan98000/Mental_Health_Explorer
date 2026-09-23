"""Associations between mental-health outcomes and exposures: data/associations/{cohort}.json.

For every outcome (launch indicators in depression_suicide or mental_illness) and exposure
(launch indicators in substance_use, school_family_peers or health) in a cohort, for the
latest common collected year and for all common years pooled:

- the outcome rate among exposure = 1 and among exposure = 0, with their difference and a
  t test, from pipeline.cube (same estimator as the estimate shards);
- the unadjusted odds ratio and the odds ratio adjusted for age band, sex, race/ethnicity
  (5 groups) and poverty, from design-based logistic regressions fitted by R's survey
  package (pipeline/models.R). Both are null, with a reason, when either rate is
  suppressed or the model fails.

Plus, for advanced mode, unadjusted odds ratios for every unordered pair of those
indicators in the latest common year.

    python -m pipeline.associations            # needs Rscript with survey and jsonlite
"""
from __future__ import annotations

import itertools
import json
import shutil
import subprocess
import time
from dataclasses import dataclass

import numpy as np

from pipeline import catalog, config, cube
from pipeline.cube import CohortData, contrast, dumps, load_harmonized

ASSOCIATIONS_DIR = config.OUTPUT_DIR / "associations"
MODELS_R = config.REPO_ROOT / "pipeline" / "models.R"
EXTRACT_PATH = config.CACHE_DIR / "models_extract.csv"
JOBS_PATH = config.CACHE_DIR / "models_jobs.json"
RESULTS_PATH = config.CACHE_DIR / "models_results.json"

OUTCOME_TOPICS = ("depression_suicide", "mental_illness")
EXPOSURE_TOPICS = ("substance_use", "school_family_peers", "health")
COVARIATES = ["age_band", "sex", "race_ethnicity_5", "poverty"]
OR_DECIMALS = 4
R_INSTALL_HINT = (
    "Rscript was not found. Install R (macOS: `brew install r`) and then run\n"
    '  Rscript -e \'install.packages(c("survey","jsonlite"), repos="https://cloud.r-project.org")\''
)


def launch(cohort: str, topics: tuple[str, ...]) -> list[dict]:
    return [i for i in catalog.indicators() if i["cohort"] == cohort and i["status"] == "launch" and i["topic"] in topics]


def common_years(a: dict, b: dict) -> list[int]:
    return sorted(set(a["years"]) & set(b["years"]))


def pair_year_sets(years: list[int]) -> dict[str, list[int]]:
    return {"latest": [years[-1]], "all": list(years)}


@dataclass
class Rate:
    p: float
    lo: float
    hi: float
    se: float
    n: int
    reason: str | None

    def to_json(self) -> dict:
        sup = self.reason is not None
        return {
            "p": None if sup else cube._r(self.p),
            "lo": None if sup else cube._r(self.lo),
            "hi": None if sup else cube._r(self.hi),
            "se": None if sup else cube._r(self.se),
            "n": int(self.n),
            "suppressed": sup,
            "reason": self.reason,
        }


class Rates:
    """Outcome rates by exposure level (cells 0 = unexposed, 1 = exposed) in a year set."""

    def __init__(self, data: CohortData, outcome: str, exposure: str, years: list[int]):
        y = data.indicator(outcome)
        x = data.indicator(exposure)
        keep = np.isin(data.year, years) & ~np.isnan(y) & ~np.isnan(x)
        cell = np.where(np.isnan(x), -1, x).astype(np.int64)
        self.cells = cube.cells(data.design, data.psu[keep], y[keep], data.weights[len(years)][keep], cell[keep], 2)
        self.diff = contrast(self.cells, 1, self.cells, 0, data.design.df)

    def rate(self, level: int) -> Rate:
        c = self.cells
        return Rate(c.p[level], c.lo[level], c.hi[level], c.se[level], int(c.n[level]), c.reason[level])

    @property
    def shown(self) -> bool:
        return self.cells.reason[0] is None and self.cells.reason[1] is None

    def reason(self) -> str | None:
        if self.cells.reason[1] is not None:
            return "rate among the exposed is suppressed"
        if self.cells.reason[0] is not None:
            return "rate among the unexposed is suppressed"
        return None


def build_jobs(data: CohortData, outcomes: list[dict], exposures: list[dict]) -> tuple[list[dict], list[dict], list[dict]]:
    """Pair entries, matrix entries (both without odds ratios yet) and the R job list."""
    pairs, matrix, jobs = [], [], []

    def job(**spec) -> int:
        jobs.append({"id": f"{data.cohort}:{len(jobs)}", "cohort": data.cohort, **spec})
        return len(jobs) - 1

    for outcome, exposure in itertools.product(outcomes, exposures):
        years = common_years(outcome, exposure)
        if not years:
            continue
        for name, subset in pair_year_sets(years).items():
            rates = Rates(data, outcome["id"], exposure["id"], subset)
            entry = {
                "outcome": outcome["id"],
                "exposure": exposure["id"],
                "year_set": name,
                "years": subset,
                "weight": config.POOLED_WEIGHTS[len(subset)],
                "exposed": rates.rate(1).to_json(),
                "unexposed": rates.rate(0).to_json(),
                "diff": cube._r(rates.diff.diff[0]) if rates.shown else None,
                "diff_se": cube._r(rates.diff.se[0]) if rates.shown else None,
                "p_value": cube._r(rates.diff.p_value[0]) if rates.shown else None,
                "or": {"estimate": None, "lo": None, "hi": None, "reason": rates.reason()},
                "adjusted_or": {"estimate": None, "lo": None, "hi": None, "n": None, "reason": rates.reason()},
                "_jobs": None,
            }
            if rates.shown:
                spec = {"years": subset, "weight": entry["weight"], "outcome": outcome["id"], "exposure": exposure["id"]}
                entry["_jobs"] = (job(adjust=False, **spec), job(adjust=True, **spec))
            pairs.append(entry)

    variables = list({i["id"]: i for i in [*outcomes, *exposures]}.values())
    for a, b in itertools.combinations(variables, 2):
        years = common_years(a, b)
        if not years:
            continue
        latest = [years[-1]]
        ab, ba = Rates(data, a["id"], b["id"], latest), Rates(data, b["id"], a["id"], latest)
        entry = {"a": a["id"], "b": b["id"], "year": latest[0], "estimate": None, "lo": None, "hi": None, "n": None,
                 "reason": None if ab.shown and ba.shown else "a conditional rate is suppressed", "_jobs": None}
        if ab.shown and ba.shown:
            entry["_jobs"] = (job(adjust=False, years=latest, weight=config.POOLED_WEIGHTS[1], outcome=a["id"], exposure=b["id"]),)
        matrix.append(entry)
    return pairs, matrix, jobs


def write_extract(frame, columns: list[str]) -> None:
    import duckdb

    config.CACHE_DIR.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect()
    con.register("frame", frame[columns])
    con.execute(f"COPY frame TO '{EXTRACT_PATH}' (HEADER, DELIMITER ',')")


def run_models(jobs: list[dict]) -> dict[str, dict]:
    if not shutil.which("Rscript"):
        raise RuntimeError(R_INSTALL_HINT)
    JOBS_PATH.write_text(json.dumps(jobs), encoding="utf-8")
    subprocess.run(["Rscript", str(MODELS_R), str(EXTRACT_PATH), str(JOBS_PATH), str(RESULTS_PATH)], check=True, cwd=config.REPO_ROOT)
    results = json.loads(RESULTS_PATH.read_text(encoding="utf-8"))
    return {r["id"]: r for r in results}


def odds_ratio(result: dict | None) -> dict:
    if result is None:
        return {"estimate": None, "lo": None, "hi": None, "reason": "model was not fitted"}
    if result.get("error"):
        return {"estimate": None, "lo": None, "hi": None, "reason": f"model failed: {result['error']}"}
    return {"estimate": round(result["or"], OR_DECIMALS), "lo": round(result["lo"], OR_DECIMALS), "hi": round(result["hi"], OR_DECIMALS), "reason": None}


def attach_results(pairs: list[dict], matrix: list[dict], jobs: list[dict], results: dict[str, dict]) -> None:
    def result(index: int | None):
        return None if index is None else results.get(jobs[index]["id"])

    for entry in pairs:
        ids = entry.pop("_jobs")
        if ids is not None:
            unadjusted, adjusted = (result(i) for i in ids)
            entry["or"] = odds_ratio(unadjusted)
            entry["adjusted_or"] = {**odds_ratio(adjusted), "n": None if adjusted is None or adjusted.get("error") else int(adjusted["n"])}
    for entry in matrix:
        ids = entry.pop("_jobs")
        if ids is not None:
            r = result(ids[0])
            entry.update(odds_ratio(r))
            entry["n"] = None if r is None or r.get("error") else int(r["n"])


def build(frame) -> dict[str, dict]:
    docs, all_jobs, plans = {}, [], {}
    for cohort in catalog.COHORT_CODES:
        data = CohortData(frame, cohort)
        outcomes, exposures = launch(cohort, OUTCOME_TOPICS), launch(cohort, EXPOSURE_TOPICS)
        pairs, matrix, jobs = build_jobs(data, outcomes, exposures)
        plans[cohort] = (pairs, matrix, jobs)
        all_jobs += jobs
        docs[cohort] = {
            "cohort": cohort,
            "outcomes": [i["id"] for i in outcomes],
            "exposures": [i["id"] for i in exposures],
            "covariates": COVARIATES,
            "pairs": pairs,
            "or_matrix": matrix,
        }
    columns = [*config.DESIGN_COLUMNS, "cohort", *COVARIATES] + sorted({j["outcome"] for j in all_jobs} | {j["exposure"] for j in all_jobs})
    write_extract(frame, columns)
    started = time.time()
    results = run_models(all_jobs)
    print(f"{len(all_jobs)} models fitted in {time.time() - started:.0f} s")
    for cohort, (pairs, matrix, jobs) in plans.items():
        attach_results(pairs, matrix, jobs, results)
    return docs


def main() -> None:
    from pipeline.manifest import write_manifest

    docs = build(load_harmonized())
    ASSOCIATIONS_DIR.mkdir(parents=True, exist_ok=True)
    for cohort, doc in docs.items():
        path = ASSOCIATIONS_DIR / f"{cohort}.json"
        text = dumps(doc)
        path.write_text(text, encoding="utf-8")
        fitted = sum(p["or"]["estimate"] is not None for p in doc["pairs"])
        print(f"{path.relative_to(config.REPO_ROOT)}: {len(doc['pairs'])} pair entries ({fitted} with odds ratios), "
              f"{len(doc['or_matrix'])} matrix pairs, {len(text.encode('utf-8')) / 1000:.0f} KB")
    write_manifest()


if __name__ == "__main__":
    main()
