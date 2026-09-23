"""Vectorized design-based estimates from PSU-level totals, and the estimate shards.

Every number on the site is a weighted proportion for a domain (cohort × year set ×
cell) estimated on the full design, exactly as pipeline.estimate.proportion does it.
This module does the same thing for many cells at once: it sums w·y and w into the
PSUs (100 for NSDUH: 50 pseudo-strata × 2 pseudo-replicates, empty PSUs count as 0),
which gives every point estimate, and keeps each cell's linearized between-PSU
deviations (`Cells.L`). The with-replacement Taylor variance of a cell is the sum of
squares of its row of L, and the covariance of any two estimates on the same design is
the dot product of their rows, so contrasts (year vs. year, level vs. overall, level
vs. level) are the same as linearizing the difference itself on the same records, and a
group's adjusted Wald F uses the full covariance of its level proportions.

    python -m pipeline.cube            # data/estimates/{cohort}/{indicator}.json + manifest
    python -m pipeline.cube --cohort teen --indicator mde_py
"""
from __future__ import annotations

import argparse
import itertools
import json
import math
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats

from pipeline import catalog, config
from pipeline.estimate import T_CRIT, suppression
from pipeline.harmonize import AVAILABILITY_PATH, HARMONIZED_PATH

ESTIMATES_DIR = config.OUTPUT_DIR / "estimates"
SHARD_LIMIT = 500_000          # bytes per estimate file
DECIMALS = 5                   # p, lo, hi, se, diff, p_value
POP_UNIT = 1_000               # estimated numbers are rounded to the nearest thousand
ALPHA = 0.05
CROSS_RACE_GROUP = "race_ethnicity_5"   # used in two-way crosses instead of the 7-level group
ONE_WAY_EXCLUDED = {CROSS_RACE_GROUP}   # crosses-only groups get no one-way cells or tests


# --------------------------------------------------------------------------- estimator

@dataclass(frozen=True)
class Design:
    """Rows mapped to PSU columns, and PSU columns mapped to strata."""

    psu: np.ndarray            # PSU column index of each row
    psu_stratum: np.ndarray    # stratum index of each PSU column
    df: int = config.DEGREES_OF_FREEDOM

    @classmethod
    def from_columns(cls, stratum, psu, df: int = config.DEGREES_OF_FREEDOM) -> "Design":
        _, h = np.unique(np.asarray(stratum), return_inverse=True)
        j_codes, j = np.unique(np.asarray(psu), return_inverse=True)
        key = h.ravel() * len(j_codes) + j.ravel()
        uniq, index = np.unique(key, return_inverse=True)
        return cls(index.ravel().astype(np.intp), (uniq // len(j_codes)).astype(np.intp), df)

    @property
    def n_psu(self) -> int:
        return len(self.psu_stratum)

    def linearize(self, z: np.ndarray) -> np.ndarray:
        """PSU totals of linearized values, one row per cell, to deviations L with
        L @ L.T = sum_h n_h/(n_h-1) sum_j (z_hj - mean_h)(z'_hj - mean'_h)."""
        n_strata = int(self.psu_stratum.max()) + 1
        n_h = np.bincount(self.psu_stratum, minlength=n_strata).astype("float64")
        onehot = np.zeros((self.n_psu, n_strata))
        onehot[np.arange(self.n_psu), self.psu_stratum] = 1.0
        mean_h = (z @ onehot) / n_h
        dev = z - mean_h[:, self.psu_stratum]
        factor = np.where(n_h > 1, n_h / np.maximum(n_h - 1, 1), 0.0)
        return dev * np.sqrt(factor)[self.psu_stratum]


@dataclass
class Cells:
    """Estimates for a set of cells (domains) on one design."""

    p: np.ndarray
    se: np.ndarray
    lo: np.ndarray
    hi: np.ndarray
    n: np.ndarray               # unweighted respondents in each denominator
    weighted_n: np.ndarray      # sum of weights in each denominator
    yes: np.ndarray             # sum of w*y: the estimated number with y == 1
    L: np.ndarray               # linearized PSU deviations, one row per cell
    reason: list[str | None]    # suppression reason, None when the cell can be shown

    @property
    def suppressed(self) -> np.ndarray:
        return np.array([r is not None for r in self.reason], dtype=bool)

    @property
    def cov(self) -> np.ndarray:
        return self.L @ self.L.T

    def __len__(self) -> int:
        return len(self.p)


def logit_ci_array(p: np.ndarray, se: np.ndarray, df: int) -> tuple[np.ndarray, np.ndarray]:
    t = T_CRIT[df]
    lo = np.full(p.shape, np.nan)
    hi = np.full(p.shape, np.nan)
    ok = (p > 0) & (p < 1) & np.isfinite(se)
    pk, sk = p[ok], se[ok]
    logit = np.log(pk / (1 - pk))
    half = t * sk / (pk * (1 - pk))
    lo[ok] = 1 / (1 + np.exp(-(logit - half)))
    hi[ok] = 1 / (1 + np.exp(-(logit + half)))
    return lo, hi


def cells(design: Design, psu: np.ndarray, y, w, cell, n_cells: int) -> Cells:
    """Weighted proportion of y == 1 in each cell, from PSU totals.

    psu, y, w and cell are aligned per-row arrays: any subset of the design's rows (rows
    left out contribute nothing, exactly as out-of-domain rows do). y is 1/0/NaN; cell is
    the cell index of each row, -1 for rows in no cell.
    """
    y = np.asarray(y, dtype="float64")
    w = np.asarray(w, dtype="float64")
    cell = np.asarray(cell, dtype=np.int64)
    psu = np.asarray(psu, dtype=np.intp)
    keep = ~np.isnan(y) & (cell >= 0)
    c, ps = cell[keep], psu[keep]
    flat = c * design.n_psu + ps
    size = n_cells * design.n_psu
    a = np.bincount(flat, weights=w[keep] * y[keep], minlength=size).reshape(n_cells, design.n_psu)
    b = np.bincount(flat, weights=w[keep], minlength=size).reshape(n_cells, design.n_psu)
    n = np.bincount(c, minlength=n_cells)
    yes = a.sum(axis=1)
    weighted_n = b.sum(axis=1)
    with np.errstate(divide="ignore", invalid="ignore"):
        p = np.where(weighted_n > 0, yes / weighted_n, np.nan)
        z = np.where(weighted_n[:, None] > 0, (a - p[:, None] * b) / weighted_n[:, None], 0.0)
    L = design.linearize(z)
    se = np.sqrt((L * L).sum(axis=1))
    se = np.where(n > 0, se, np.nan)
    lo, hi = logit_ci_array(p, se, design.df)
    reason = [suppression(float(p[i]), float(se[i]), int(n[i])) if n[i] > 0 else "no respondents" for i in range(n_cells)]
    return Cells(p, se, lo, hi, n, weighted_n, yes, L, reason)


def proportions(y, weight, stratum, psu, cell=None, n_cells: int = 1, df: int = config.DEGREES_OF_FREEDOM) -> Cells:
    """Convenience wrapper with the signature of estimate.proportion: builds the design
    from the stratum and PSU columns. With no `cell`, every row is in the single cell."""
    design = Design.from_columns(stratum, psu, df)
    if cell is None:
        cell = np.zeros(len(design.psu), dtype=np.int64)
    return cells(design, design.psu, y, weight, cell, n_cells)


@dataclass
class Contrast:
    diff: np.ndarray
    se: np.ndarray
    t: np.ndarray
    p_value: np.ndarray


def contrast(a: Cells, i, b: Cells, j, df: int = config.DEGREES_OF_FREEDOM) -> Contrast:
    """a.p[i] - b.p[j] with its linearized SE (covariance included) and a two-sided t test.

    i and j are cell indices (scalars or arrays of the same length). Both Cells must come
    from the same design, which is what makes the covariance term right for overlapping
    domains (level vs. overall) and for the same PSUs observed in different years.
    """
    i = np.atleast_1d(np.asarray(i, dtype=np.intp))
    j = np.atleast_1d(np.asarray(j, dtype=np.intp))
    diff = a.p[i] - b.p[j]
    d = a.L[i] - b.L[j]
    se = np.sqrt((d * d).sum(axis=1))
    with np.errstate(divide="ignore", invalid="ignore"):
        t = diff / se
    p_value = np.where(np.isfinite(t), 2 * stats.t.sf(np.abs(t), df), np.nan)
    return Contrast(diff, se, t, p_value)


@dataclass
class WaldF:
    w: float        # Wald chi-square statistic
    f: float        # adjusted Wald F
    df1: int
    df2: int
    p_value: float


def wald_f(p: np.ndarray, cov: np.ndarray, df: int = config.DEGREES_OF_FREEDOM) -> WaldF | None:
    """Adjusted Wald F test that k proportions are equal (SUDAAN's WALDF).

    W = (Cp)'(CVC')^-1(Cp) with C the k-1 contrasts against the first level;
    F = W (d - q + 1) / (d q) on (q, d - q + 1) df, q = k - 1, d = design df.
    Returns None when fewer than two levels are given or the covariance is singular.
    """
    p = np.asarray(p, dtype="float64")
    k = len(p)
    if k < 2:
        return None
    q = k - 1
    c = np.hstack([np.ones((q, 1)), -np.eye(q)])
    cp = c @ p
    cvc = c @ np.asarray(cov, dtype="float64") @ c.T
    try:
        w = float(cp @ np.linalg.solve(cvc, cp))
    except np.linalg.LinAlgError:
        return None
    if not math.isfinite(w):
        return None
    df2 = df - q + 1
    f = w * df2 / (df * q)
    return WaldF(w, f, q, df2, float(stats.f.sf(f, q, df2)))


# --------------------------------------------------------------------------- shards

def year_sets(years: list[int]) -> dict[str, list[int]]:
    """Single collected years, then `all` (Ck) and `recent2` (C2)."""
    sets = {str(y): [y] for y in years}
    sets["all"] = list(years)
    if len(years) >= 2:
        sets["recent2"] = list(years[-2:])
    return sets


class CohortData:
    """One cohort's rows of the harmonized file, indexed against the full design."""

    def __init__(self, frame: pd.DataFrame, cohort: str):
        self.cohort = cohort
        self.design = Design.from_columns(frame[config.STRATUM].to_numpy(), frame[config.PSU].to_numpy())
        rows = np.flatnonzero((frame["cohort"] == cohort).to_numpy())
        self.frame = frame.iloc[rows]
        self.psu = self.design.psu[rows]
        self.year = self.frame[config.YEAR].to_numpy()
        self.weights = {k: self.frame[col].to_numpy(dtype="float64") for k, col in config.POOLED_WEIGHTS.items()}
        self.groups: dict[str, dict] = {}
        for group in catalog.groups():
            if cohort not in group["cohorts"]:
                continue
            observed = set(self.frame[group["id"]].dropna().unique())
            levels = [level["id"] for level in group["levels"] if level["id"] in observed]
            codes = pd.Categorical(self.frame[group["id"]], categories=levels).codes.astype(np.int64)
            self.groups[group["id"]] = {"levels": levels, "codes": codes, "crosses_only": bool(group.get("crosses_only"))}

    def one_way_groups(self) -> list[str]:
        return [g for g, spec in self.groups.items() if not spec["crosses_only"]]

    def cross_groups(self) -> list[str]:
        return [g for g in self.groups if g != "race_ethnicity"]

    def indicator(self, indicator_id: str) -> np.ndarray:
        return self.frame[indicator_id].to_numpy(dtype="float64", na_value=np.nan)


def _r(x, decimals: int = DECIMALS):
    x = float(x)
    if not math.isfinite(x):
        return None
    value = round(x, decimals)
    return 0.0 if value == 0 else value   # no "-0.0"


def _pop(yes: float, suppressed: bool):
    return None if suppressed else int(round(float(yes) / POP_UNIT)) * POP_UNIT


class ShardBuilder:
    def __init__(self, data: CohortData, indicator_id: str, years: list[int]):
        self.data = data
        self.indicator = indicator_id
        self.years = years
        self.sets = year_sets(years)
        self.y = data.indicator(indicator_id)
        self.cells: dict[tuple, Cells] = {}     # (year_set, group or None, group2 or None) -> Cells
        self.columns = {k: [] for k in ("year_set", "group", "level", "group2", "level2", "p", "lo", "hi", "se", "n", "pop", "suppressed", "reason")}

    def _estimate(self, keep: np.ndarray, w: np.ndarray, cell: np.ndarray, n_cells: int) -> Cells:
        d = self.data
        return cells(d.design, d.psu[keep], self.y[keep], w[keep], cell[keep], n_cells)

    def _append(self, year_set: str, est: Cells, labels: list[tuple]):
        for i, (group, level, group2, level2) in enumerate(labels):
            sup = est.reason[i] is not None
            c = self.columns
            c["year_set"].append(year_set)
            c["group"].append(group)
            c["level"].append(level)
            c["group2"].append(group2)
            c["level2"].append(level2)
            c["p"].append(None if sup else _r(est.p[i]))
            c["lo"].append(None if sup else _r(est.lo[i]))
            c["hi"].append(None if sup else _r(est.hi[i]))
            c["se"].append(None if sup else _r(est.se[i]))
            c["n"].append(int(est.n[i]))
            c["pop"].append(_pop(est.yes[i], sup))
            c["suppressed"].append(sup)
            c["reason"].append(est.reason[i])

    def build_cells(self, include_crosses: set[str]) -> None:
        d = self.data
        for name, years in self.sets.items():
            w = d.weights[len(years)]
            keep = np.isin(d.year, years) & ~np.isnan(self.y)
            ones = np.zeros(len(self.y), dtype=np.int64)
            overall = self._estimate(keep, w, ones, 1)
            self.cells[(name, None, None)] = overall
            self._append(name, overall, [(None, None, None, None)])
            for g in d.one_way_groups():
                spec = d.groups[g]
                est = self._estimate(keep, w, spec["codes"], len(spec["levels"]))
                self.cells[(name, g, None)] = est
                self._append(name, est, [(g, level, None, None) for level in spec["levels"]])
            if name not in include_crosses:
                continue
            for ga, gb in itertools.combinations(d.cross_groups(), 2):
                sa, sb = d.groups[ga], d.groups[gb]
                ka, kb = len(sa["levels"]), len(sb["levels"])
                both = (sa["codes"] >= 0) & (sb["codes"] >= 0)
                code = np.where(both, sa["codes"] * kb + sb["codes"], -1)
                est = self._estimate(keep, w, code, ka * kb)
                self.cells[(name, ga, gb)] = est
                self._append(name, est, [(ga, la, gb, lb) for la in sa["levels"] for lb in sb["levels"]])

    def trend_tests(self) -> dict:
        out = {k: [] for k in ("group", "level", "year_a", "year_b", "diff", "se", "p_value")}
        targets: list[tuple[str | None, str | None, int]] = [(None, None, 0)]
        for g in self.data.one_way_groups():
            targets += [(g, level, i) for i, level in enumerate(self.data.groups[g]["levels"])]
        for ya, yb in itertools.combinations(self.years, 2):
            for g, level, i in targets:
                a, b = self.cells[(str(ya), g, None)], self.cells[(str(yb), g, None)]
                ok = a.reason[i] is None and b.reason[i] is None
                c = contrast(b, i, a, i, self.data.design.df) if ok else None
                out["group"].append(g)
                out["level"].append(level)
                out["year_a"].append(ya)
                out["year_b"].append(yb)
                out["diff"].append(_r(c.diff[0]) if ok else None)
                out["se"].append(_r(c.se[0]) if ok else None)
                out["p_value"].append(_r(c.p_value[0]) if ok else None)
        return out

    def group_tests(self) -> list[dict]:
        tests = []
        df = self.data.design.df
        for name in self.sets:
            overall = self.cells[(name, None, None)]
            for g in self.data.one_way_groups():
                est = self.cells[(name, g, None)]
                levels = self.data.groups[g]["levels"]
                shown = [i for i in range(len(levels)) if est.reason[i] is None]
                test = wald_f(est.p[shown], est.cov[np.ix_(shown, shown)], df) if len(shown) >= 2 else None
                vs = contrast(est, shown, overall, np.zeros(len(shown), dtype=np.intp), df) if shown else None
                vs_diff: list = [None] * len(levels)
                vs_p: list = [None] * len(levels)
                for pos, i in enumerate(shown):
                    vs_diff[i] = _r(vs.diff[pos])
                    vs_p[i] = _r(vs.p_value[pos])
                pairwise: list[list] = [[None] * len(levels) for _ in levels]
                if len(shown) >= 2:
                    ii, jj = zip(*itertools.combinations(shown, 2))
                    pw = contrast(est, np.array(ii), est, np.array(jj), df)
                    for (i, j), p_value in zip(zip(ii, jj), pw.p_value):
                        pairwise[i][j] = pairwise[j][i] = _r(p_value)
                tests.append({
                    "year_set": name,
                    "group": g,
                    "levels": levels,
                    "tested": [levels[i] for i in shown],
                    "f": None if test is None else round(test.f, 4),
                    "df": None if test is None else [test.df1, test.df2],
                    "p_value": None if test is None else _r(test.p_value),
                    "overall_significant": bool(test is not None and test.p_value < ALPHA),
                    "vs_overall": {"diff": vs_diff, "p_value": vs_p},
                    "pairwise_p": pairwise,
                })
        return tests

    def shard(self, include_crosses: set[str]) -> dict:
        self.cells.clear()
        self.columns = {k: [] for k in self.columns}
        self.build_cells(include_crosses)
        return {
            "cohort": self.data.cohort,
            "indicator": self.indicator,
            "years": list(self.years),
            "year_sets": {name: {"years": years, "weight": config.POOLED_WEIGHTS[len(years)]} for name, years in self.sets.items()},
            "crosses": sorted(include_crosses, key=list(self.sets).index),
            "cells": self.columns,
            "trend_tests": self.trend_tests(),
            "group_tests": self.group_tests(),
        }


def dumps(obj) -> str:
    return json.dumps(obj, separators=(",", ":"), ensure_ascii=False, allow_nan=False) + "\n"


def build(data: CohortData, indicator_id: str, years: list[int]) -> tuple[dict, str, list[str]]:
    """The shard, its JSON text and the year sets whose crosses were dropped to fit the size limit."""
    builder = ShardBuilder(data, indicator_id, years)
    include = set(builder.sets)
    candidates = ["recent2", "all", *[str(y) for y in reversed(years)]]   # drop order
    dropped: list[str] = []
    while True:
        shard = builder.shard(include)
        text = dumps(shard)
        remaining = [c for c in candidates if c in include]
        if len(text.encode("utf-8")) <= SHARD_LIMIT or not remaining:
            return shard, text, dropped
        include.discard(remaining[0])
        dropped.append(remaining[0])


def collected_years(availability: dict, cohort: str, indicator_id: str) -> list[int]:
    return [int(y) for y, v in availability[cohort][indicator_id].items() if v["collected"]]


def load_harmonized(path: Path = HARMONIZED_PATH) -> pd.DataFrame:
    import duckdb

    return duckdb.connect().execute("SELECT * FROM read_parquet(?)", [str(path)]).df()


def main() -> None:
    parser = argparse.ArgumentParser(description="Write data/estimates/{cohort}/{indicator}.json")
    parser.add_argument("--cohort", choices=list(catalog.COHORT_CODES))
    parser.add_argument("--indicator")
    args = parser.parse_args()
    from pipeline.manifest import write_manifest

    frame = load_harmonized()
    availability = json.loads(AVAILABILITY_PATH.read_text(encoding="utf-8"))
    written = 0
    for cohort in catalog.COHORT_CODES:
        if args.cohort and cohort != args.cohort:
            continue
        data = CohortData(frame, cohort)
        for ind in catalog.indicators():
            if ind["cohort"] != cohort or ind["status"] != "launch" or (args.indicator and ind["id"] != args.indicator):
                continue
            years = collected_years(availability, cohort, ind["id"])
            shard, text, dropped = build(data, ind["id"], years)
            path = ESTIMATES_DIR / cohort / f"{ind['id']}.json"
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text, encoding="utf-8")
            written += 1
            note = f"  (dropped crosses for {', '.join(dropped)})" if dropped else ""
            print(f"{path.relative_to(config.REPO_ROOT)}: {len(shard['cells']['p'])} cells, {len(text.encode('utf-8')) / 1000:.0f} KB{note}")
    manifest = write_manifest()
    print(f"Wrote {written} shards; manifest lists {len(manifest['files'])} files")


if __name__ == "__main__":
    main()
