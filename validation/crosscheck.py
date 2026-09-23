"""Cross-check the Python estimator against R's survey package on random real cells.

Draws, with a fixed seed, 100 cells (cohort × indicator × year set × one-way level or
overall), 10 group tests and 10 year differences from the launch catalog; computes them
with pipeline.cube; has validation/crosscheck.R compute the same quantities with
svyby(..., svymean), svyby(..., covmat=TRUE) + vcov and svycontrast on the users' guide
design; and reports the largest discrepancies:

- |Δp| in percentage points (tolerance 0.001) and the relative SE difference (0.5%);
- the relative difference in the Wald chi-square W (0.5%);
- the relative difference in the SE of a year-vs-year difference (0.5%).

    NSDUH_RAW=... python -m validation.crosscheck
"""
from __future__ import annotations

import json
import shutil
import subprocess

import numpy as np

from pipeline import catalog, config, cube
from pipeline.associations import R_INSTALL_HINT
from validation.data import load_harmonized

CROSSCHECK_R = config.REPO_ROOT / "validation" / "crosscheck.R"
EXTRACT_PATH = config.CACHE_DIR / "crosscheck_extract.csv"
JOBS_PATH = config.CACHE_DIR / "crosscheck_jobs.json"
RESULTS_PATH = config.CACHE_DIR / "crosscheck_results.json"
SUMMARY_PATH = config.CACHE_DIR / "crosscheck_summary.json"

N_CELLS, N_GROUP_TESTS, N_YEAR_DIFFS = 100, 10, 10
SEED = 20240923
TOL_P_POINTS = 0.001        # percentage points
TOL_RELATIVE = 0.005        # SE, W and difference SE


class Sampler:
    def __init__(self, frame, seed=SEED):
        self.rng = np.random.default_rng(seed)
        self.data = {c: cube.CohortData(frame, c) for c in catalog.COHORT_CODES}
        self.launch = [i for i in catalog.indicators() if i["status"] == "launch"]
        self.jobs: list[dict] = []
        self.python: dict[str, dict] = {}

    def pick_indicator(self) -> tuple[dict, cube.CohortData]:
        ind = self.launch[self.rng.integers(len(self.launch))]
        return ind, self.data[ind["cohort"]]

    def pick_year_set(self, ind: dict) -> tuple[str, list[int]]:
        sets = cube.year_sets(list(ind["years"]))
        name = list(sets)[self.rng.integers(len(sets))]
        return name, sets[name]

    def estimate(self, data: cube.CohortData, ind: dict, years: list[int], group: str | None) -> cube.Cells:
        y = data.indicator(ind["id"])
        keep = np.isin(data.year, years) & ~np.isnan(y)
        w = data.weights[len(years)]
        if group is None:
            return cube.cells(data.design, data.psu[keep], y[keep], w[keep], np.zeros(int(keep.sum()), dtype=np.int64), 1)
        spec = data.groups[group]
        return cube.cells(data.design, data.psu[keep], y[keep], w[keep], spec["codes"][keep], len(spec["levels"]))

    def add(self, kind: str, **spec) -> str:
        job_id = f"{kind}:{len(self.jobs)}"
        self.jobs.append({"id": job_id, "kind": kind, **spec})
        return job_id

    def sample_cells(self, n=N_CELLS) -> None:
        while sum(j["kind"] == "cell" for j in self.jobs) < n:
            ind, data = self.pick_indicator()
            name, years = self.pick_year_set(ind)
            group = None if self.rng.random() < 0.15 else data.one_way_groups()[self.rng.integers(len(data.one_way_groups()))]
            est = self.estimate(data, ind, years, group)
            if group is None:
                level, i = None, 0
            else:
                levels = data.groups[group]["levels"]
                i = int(self.rng.integers(len(levels)))
                level = levels[i]
            if est.n[i] == 0:
                continue
            job_id = self.add("cell", cohort=ind["cohort"], indicator=ind["id"], year_set=name, years=years,
                              weight=config.POOLED_WEIGHTS[len(years)], group=group, level=level)
            self.python[job_id] = {"p": float(est.p[i]), "se": float(est.se[i]), "n": int(est.n[i])}

    def sample_group_tests(self, n=N_GROUP_TESTS) -> None:
        while sum(j["kind"] == "group" for j in self.jobs) < n:
            ind, data = self.pick_indicator()
            name, years = self.pick_year_set(ind)
            group = data.one_way_groups()[self.rng.integers(len(data.one_way_groups()))]
            est = self.estimate(data, ind, years, group)
            levels = data.groups[group]["levels"]
            shown = [i for i in range(len(levels)) if est.reason[i] is None]
            test = cube.wald_f(est.p[shown], est.cov[np.ix_(shown, shown)]) if len(shown) >= 2 else None
            if test is None:
                continue
            job_id = self.add("group", cohort=ind["cohort"], indicator=ind["id"], year_set=name, years=years,
                              weight=config.POOLED_WEIGHTS[len(years)], group=group, levels=[levels[i] for i in shown])
            self.python[job_id] = {"w": test.w, "f": test.f, "p_value": test.p_value}

    def sample_year_diffs(self, n=N_YEAR_DIFFS) -> None:
        while sum(j["kind"] == "yeardiff" for j in self.jobs) < n:
            ind, data = self.pick_indicator()
            ya, yb = sorted(self.rng.choice(ind["years"], 2, replace=False).tolist())
            group = None if self.rng.random() < 0.3 else data.one_way_groups()[self.rng.integers(len(data.one_way_groups()))]
            a, b = self.estimate(data, ind, [ya], group), self.estimate(data, ind, [yb], group)
            if group is None:
                level, i = None, 0
            else:
                levels = data.groups[group]["levels"]
                i = int(self.rng.integers(len(levels)))
                level = levels[i]
            if a.n[i] == 0 or b.n[i] == 0:
                continue
            c = cube.contrast(b, i, a, i, data.design.df)
            job_id = self.add("yeardiff", cohort=ind["cohort"], indicator=ind["id"], years=[ya, yb], weight=config.POOLED_WEIGHTS[1],
                              group=group, level=level, year_a=ya, year_b=yb)
            self.python[job_id] = {"diff": float(c.diff[0]), "se": float(c.se[0])}


def write_extract(frame, jobs: list[dict]) -> None:
    import duckdb

    groups = sorted({j["group"] for j in jobs if j["group"]})
    indicators = sorted({j["indicator"] for j in jobs})
    columns = [*config.DESIGN_COLUMNS, "cohort", *groups, *indicators]
    config.CACHE_DIR.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect()
    con.register("frame", frame[columns])
    con.execute(f"COPY frame TO '{EXTRACT_PATH}' (HEADER, DELIMITER ',')")


def run_r(jobs: list[dict]) -> dict[str, dict]:
    if not shutil.which("Rscript"):
        raise RuntimeError(R_INSTALL_HINT)
    JOBS_PATH.write_text(json.dumps(jobs), encoding="utf-8")
    subprocess.run(["Rscript", str(CROSSCHECK_R), str(EXTRACT_PATH), str(JOBS_PATH), str(RESULTS_PATH)], check=True, cwd=config.REPO_ROOT)
    return {r["id"]: r for r in json.loads(RESULTS_PATH.read_text(encoding="utf-8"))}


def relative(a: float, b: float) -> float:
    """|a - b| / |b|, with 0 when both are 0 (e.g. an SE of 0 for a cell with no variation)."""
    if b == 0:
        return 0.0 if a == 0 else float("inf")
    return abs(a - b) / abs(b)


def run(frame=None) -> dict:
    """Run the cross-check and return a summary with the maxima and the worst jobs."""
    frame = load_harmonized() if frame is None else frame
    sampler = Sampler(frame)
    sampler.sample_cells()
    sampler.sample_group_tests()
    sampler.sample_year_diffs()
    write_extract(frame, sampler.jobs)
    r = run_r(sampler.jobs)

    rows = []
    for job in sampler.jobs:
        py, rr = sampler.python[job["id"]], r[job["id"]]
        if job["kind"] == "cell":
            rows.append({**job, "python": py, "r": rr, "dp_points": 100 * abs(py["p"] - rr["p"]), "se_rel": relative(py["se"], rr["se"])})
        elif job["kind"] == "group":
            rows.append({**job, "python": py, "r": rr, "w_rel": relative(py["w"], rr["w"])})
        else:
            rows.append({**job, "python": py, "r": rr, "dp_points": 100 * abs(py["diff"] - rr["diff"]), "se_rel": relative(py["se"], rr["se"])})

    cells = [x for x in rows if x["kind"] == "cell"]
    groups = [x for x in rows if x["kind"] == "group"]
    diffs = [x for x in rows if x["kind"] == "yeardiff"]
    summary = {
        "cells": {"n": len(cells), "max_dp_points": max(x["dp_points"] for x in cells), "max_se_rel": max(x["se_rel"] for x in cells),
                  "tolerance": {"dp_points": TOL_P_POINTS, "se_rel": TOL_RELATIVE}},
        "group_tests": {"n": len(groups), "max_w_rel": max(x["w_rel"] for x in groups), "tolerance": {"w_rel": TOL_RELATIVE}},
        "year_diffs": {"n": len(diffs), "max_dp_points": max(x["dp_points"] for x in diffs), "max_se_rel": max(x["se_rel"] for x in diffs),
                       "tolerance": {"se_rel": TOL_RELATIVE}},
        "rows": rows,
    }
    summary["passed"] = (
        summary["cells"]["max_dp_points"] <= TOL_P_POINTS and summary["cells"]["max_se_rel"] <= TOL_RELATIVE
        and summary["group_tests"]["max_w_rel"] <= TOL_RELATIVE and summary["year_diffs"]["max_se_rel"] <= TOL_RELATIVE
    )
    SUMMARY_PATH.write_text(json.dumps(summary, indent=1), encoding="utf-8")
    return summary


def main() -> None:
    s = run()
    print(f"cells: {s['cells']['n']}, max |Δp| = {s['cells']['max_dp_points']:.2e} points, max rel SE diff = {s['cells']['max_se_rel']:.2e}")
    print(f"group tests: {s['group_tests']['n']}, max rel W diff = {s['group_tests']['max_w_rel']:.2e}")
    print(f"year differences: {s['year_diffs']['n']}, max rel SE diff = {s['year_diffs']['max_se_rel']:.2e}")
    print("PASSED" if s["passed"] else "FAILED")


if __name__ == "__main__":
    main()
