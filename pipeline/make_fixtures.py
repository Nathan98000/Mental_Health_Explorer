"""Write validation/fixtures/estimator.json: synthetic cases with the Python estimator's
outputs, so the TypeScript port (web/src/stats/estimator.ts) can be checked against them.

    python -m pipeline.make_fixtures

A CI test asserts the file equals the current Python output; a Vitest test asserts the
TypeScript output matches it to 1e-9.
"""
from __future__ import annotations

import json
import math

import numpy as np
from scipy import stats

from pipeline import config, cube
from pipeline.estimate import T_CRIT, proportion

FIXTURE_PATH = config.REPO_ROOT / "validation" / "fixtures" / "estimator.json"
T_CDF_POINTS = [-4.0, -1.3, -0.25, 0.0, 0.5, 1.0, 1.5, 2.0, T_CRIT[50], 2.5, 3.0, 5.0, 10.0]


def _num(x):
    x = float(x)
    return None if not math.isfinite(x) else x


def design(rng, strata=10, rows_per_psu=4, psus=2):
    n = strata * psus * rows_per_psu
    h = np.repeat(np.arange(strata) + 1, psus * rows_per_psu)
    j = np.tile(np.repeat(np.arange(psus) + 1, rows_per_psu), strata)
    w = rng.uniform(100, 3000, n).round(3)
    return n, h, j, w


def bernoulli(rng, n, rate):
    return (rng.random(n) < rate).astype(float)


def proportion_case(name, y, w, h, j, domain=None):
    est = proportion(y, w, h, j, domain=domain)
    return {
        "name": name,
        "kind": "proportion",
        "y": [None if math.isnan(v) else int(v) for v in y],
        "w": [float(v) for v in w],
        "stratum": [int(v) for v in h],
        "psu": [int(v) for v in j],
        "domain": None if domain is None else [bool(v) for v in domain],
        "expected": {
            "p": _num(est.p), "se": _num(est.se), "lo": _num(est.lo), "hi": _num(est.hi),
            "n": est.n, "weighted_n": _num(est.weighted_n), "suppressed": est.suppressed, "reason": est.reason,
        },
    }


def difference_case(name, y, w, h, j, domain_a, domain_b):
    d = cube.Design.from_columns(h, j)
    a = cube.cells(d, d.psu, y, w, np.where(domain_a, 0, -1), 1)
    b = cube.cells(d, d.psu, y, w, np.where(domain_b, 0, -1), 1)
    c = cube.contrast(a, 0, b, 0, d.df)
    return {
        "name": name,
        "kind": "difference",
        "y": [None if math.isnan(v) else int(v) for v in y],
        "w": [float(v) for v in w],
        "stratum": [int(v) for v in h],
        "psu": [int(v) for v in j],
        "domain_a": [bool(v) for v in domain_a],
        "domain_b": [bool(v) for v in domain_b],
        "expected": {"diff": _num(c.diff[0]), "se": _num(c.se[0]), "t": _num(c.t[0]), "p_value": _num(c.p_value[0])},
    }


def build() -> dict:
    rng = np.random.default_rng(20240923)
    cases = []

    n, h, j, w = design(rng)
    y = bernoulli(rng, n, 0.3)
    cases.append(proportion_case("basic", y, w, h, j))
    cases.append(proportion_case("weights_scaled_by_quarter", y, w / 4, h, j))
    ym = y.copy()
    ym[::5] = np.nan
    cases.append(proportion_case("missing_values", ym, w, h, j))
    girl = rng.random(n) < 0.5
    cases.append(proportion_case("domain", y, w, h, j, girl))
    cases.append(proportion_case("domain_and_missing", ym, w, h, j, girl))
    cases.append(proportion_case("small_domain_under_50", y, w, h, j, np.arange(n) < 40))
    cases.append(proportion_case("empty_domain", y, w, h, j, np.zeros(n, bool)))
    cases.append(proportion_case("all_zero", np.zeros(n), w, h, j))
    cases.append(proportion_case("all_one", np.ones(n), w, h, j))
    cases.append(proportion_case("rare_and_imprecise", bernoulli(rng, n, 0.03), w, h, j))
    cases.append(proportion_case("common_and_imprecise", bernoulli(rng, n, 0.97), w, h, j))
    cases.append(proportion_case("above_one_half", bernoulli(rng, n, 0.7), w, h, j))
    cases.append(proportion_case("string_like_integer_keys", y, w, h + 40000, j))
    single = h.copy()
    single_psu = np.where(h == 1, 1, j)   # stratum 1 has one PSU: contributes no variance
    cases.append(proportion_case("single_psu_stratum", y, w, single, single_psu))

    n2, h2, j2, w2 = design(rng, strata=50, rows_per_psu=3)
    y2 = bernoulli(rng, n2, 0.15)
    cases.append(proportion_case("fifty_strata", y2, w2, h2, j2))
    year = np.tile([2021, 2022], n2 // 2)
    group = rng.integers(0, 3, n2)
    cases.append(proportion_case("fifty_strata_domain_year", y2, w2, h2, j2, year == 2022))
    cases.append(difference_case("difference_year_vs_year", y2, w2, h2, j2, year == 2022, year == 2021))
    cases.append(difference_case("difference_level_vs_overall", y2, w2, h2, j2, group == 0, np.ones(n2, bool)))
    cases.append(difference_case("difference_level_vs_level", y2, w2, h2, j2, group == 0, group == 1))
    y2m = y2.copy()
    y2m[::7] = np.nan
    cases.append(difference_case("difference_with_missing", y2m, w2, h2, j2, group == 2, group != 2))
    cases.append(difference_case("difference_ten_strata", y, w, h, j, girl, ~girl))

    return {
        "df": config.DEGREES_OF_FREEDOM,
        "t_crit": T_CRIT[config.DEGREES_OF_FREEDOM],
        "t_cdf": [{"x": x, "cdf": float(stats.t.cdf(x, config.DEGREES_OF_FREEDOM))} for x in T_CDF_POINTS],
        "cases": cases,
    }


def dumps(doc: dict) -> str:
    return json.dumps(doc, indent=1) + "\n"


def main() -> None:
    doc = build()
    FIXTURE_PATH.parent.mkdir(parents=True, exist_ok=True)
    FIXTURE_PATH.write_text(dumps(doc), encoding="utf-8")
    print(f"Wrote {FIXTURE_PATH} ({len(doc['cases'])} cases)")


if __name__ == "__main__":
    main()
