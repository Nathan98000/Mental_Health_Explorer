"""The vectorized estimator equals the reference estimator, contrasts equal a single
linearized difference, and the Wald F matches hand-computed values (no survey data)."""
import json

import numpy as np
import pandas as pd
import pytest
from scipy import stats

from pipeline import catalog, config, cube
from pipeline.estimate import proportion, taylor_variance
from pipeline.tests.test_estimate import synthetic_survey

TOL = 1e-12


def groups_of(n, k, seed):
    return np.random.default_rng(seed).integers(0, k, n)


def reference_difference(y, w, h, j, dom_a, dom_b):
    """SE of p_A - p_B from one linearized variable z_A - z_B on the same records."""
    y = np.asarray(y, dtype=float)
    w = np.asarray(w, dtype=float)

    def z(dom):
        scope = ~np.isnan(y) & dom
        wy = np.where(scope, w * np.nan_to_num(y), 0.0)
        wd = np.where(scope, w, 0.0)
        p = wy.sum() / wd.sum()
        return (wy - p * wd) / wd.sum(), p

    za, pa = z(dom_a)
    zb, pb = z(dom_b)
    return pa - pb, np.sqrt(taylor_variance(za - zb, np.asarray(h), np.asarray(j)))


def test_cells_match_reference_estimator():
    y, w, h, j, _ = synthetic_survey(seed=3)
    y[::7] = np.nan
    cell = groups_of(len(y), 4, seed=4)
    est = cube.proportions(y, w, h, j, cell, 4)
    for k in range(4):
        ref = proportion(y, w, h, j, domain=cell == k)
        assert est.p[k] == pytest.approx(ref.p, abs=TOL)
        assert est.se[k] == pytest.approx(ref.se, abs=TOL)
        assert est.lo[k] == pytest.approx(ref.lo, abs=TOL)
        assert est.hi[k] == pytest.approx(ref.hi, abs=TOL)
        assert est.n[k] == ref.n
        assert est.weighted_n[k] == pytest.approx(ref.weighted_n, rel=TOL)
        assert est.reason[k] == ref.reason


def test_single_cell_equals_reference_with_domain():
    y, w, h, j, girl = synthetic_survey(seed=5)
    est = cube.proportions(y, w, h, j, np.where(girl, 0, -1), 1)
    ref = proportion(y, w, h, j, domain=girl)
    assert (est.p[0], est.se[0]) == pytest.approx((ref.p, ref.se), abs=TOL)


def test_empty_and_small_cells():
    y, w, h, j, _ = synthetic_survey(seed=6, rows_per_psu=2)
    cell = np.where(np.arange(len(y)) < 30, 0, -1)
    est = cube.proportions(y, w, h, j, cell, 2)
    assert est.reason == ["fewer than 50 respondents", "no respondents"]
    assert est.n.tolist() == [30, 0]
    assert np.isnan(est.p[1]) and np.isnan(est.se[1])


def test_rows_outside_the_subset_do_not_change_the_variance():
    # Passing only the in-domain rows gives the same answer as masking on the full file,
    # because absent PSUs are counted as zero.
    y, w, h, j, girl = synthetic_survey(seed=7)
    design = cube.Design.from_columns(h, j)
    full = cube.cells(design, design.psu, y, w, np.where(girl, 0, -1), 1)
    part = cube.cells(design, design.psu[girl], y[girl], w[girl], np.zeros(girl.sum(), dtype=int), 1)
    assert (part.p[0], part.se[0]) == pytest.approx((full.p[0], full.se[0]), abs=TOL)


@pytest.mark.parametrize("kind", ["level_vs_level", "level_vs_overall", "year_vs_year"])
def test_contrast_equals_one_linearized_difference(kind):
    y, w, h, j, girl = synthetic_survey(seed=8)
    year = np.tile([2021, 2022], len(y) // 2)
    if kind == "level_vs_level":
        est = cube.proportions(y, w, h, j, girl.astype(int), 2)
        c = cube.contrast(est, 1, est, 0)
        diff, se = reference_difference(y, w, h, j, girl, ~girl)
    elif kind == "level_vs_overall":
        levels = cube.proportions(y, w, h, j, girl.astype(int), 2)
        overall = cube.proportions(y, w, h, j)
        c = cube.contrast(levels, 1, overall, 0)
        diff, se = reference_difference(y, w, h, j, girl, np.ones(len(y), bool))
    else:
        design = cube.Design.from_columns(h, j)
        a = cube.cells(design, design.psu[year == 2021], y[year == 2021], w[year == 2021], np.zeros((year == 2021).sum(), int), 1)
        b = cube.cells(design, design.psu[year == 2022], y[year == 2022], w[year == 2022], np.zeros((year == 2022).sum(), int), 1)
        c = cube.contrast(b, 0, a, 0)
        diff, se = reference_difference(y, w, h, j, year == 2022, year == 2021)
    assert c.diff[0] == pytest.approx(diff, abs=TOL)
    assert c.se[0] == pytest.approx(se, abs=TOL)
    assert c.p_value[0] == pytest.approx(2 * stats.t.sf(abs(diff / se), config.DEGREES_OF_FREEDOM), abs=TOL)


def test_contrast_se_is_not_the_naive_root_sum_of_squares():
    y, w, h, j, girl = synthetic_survey(seed=9)
    levels = cube.proportions(y, w, h, j, girl.astype(int), 2)
    overall = cube.proportions(y, w, h, j)
    c = cube.contrast(levels, 1, overall, 0)
    naive = np.sqrt(levels.se[1] ** 2 + overall.se[0] ** 2)
    assert c.se[0] < naive


def test_wald_f_hand_checked():
    # C = [[1,-1,0],[1,0,-1]]: Cp = (-0.1, -0.3), CVC' = [[0.03,0.01],[0.01,0.04]],
    # W = (0.04*0.01 - 2*0.01*0.03 + 0.03*0.09) / (0.03*0.04 - 0.01^2) = 0.0025 / 0.0011 = 25/11,
    # F = W * (50 - 2 + 1) / (50 * 2) = 1225/1100 on (2, 49) df.
    test = cube.wald_f(np.array([0.2, 0.3, 0.5]), np.diag([0.01, 0.02, 0.03]), df=50)
    assert test.w == pytest.approx(25 / 11)
    assert test.f == pytest.approx(1225 / 1100)
    assert (test.df1, test.df2) == (2, 49)
    assert test.p_value == pytest.approx(stats.f.sf(1225 / 1100, 2, 49))


def test_wald_f_with_two_levels_is_the_squared_t_test():
    y, w, h, j, girl = synthetic_survey(seed=10)
    est = cube.proportions(y, w, h, j, girl.astype(int), 2)
    test = cube.wald_f(est.p, est.cov)
    c = cube.contrast(est, 0, est, 1)
    assert test.f == pytest.approx(c.t[0] ** 2)
    assert (test.df1, test.df2) == (1, 50)
    assert test.p_value == pytest.approx(c.p_value[0])


def test_wald_f_needs_two_levels_and_a_full_rank_covariance():
    assert cube.wald_f(np.array([0.2]), np.array([[0.01]])) is None
    assert cube.wald_f(np.array([0.2, 0.3]), np.zeros((2, 2))) is None


def test_year_sets():
    assert cube.year_sets([2022, 2023, 2024]) == {"2022": [2022], "2023": [2023], "2024": [2024], "all": [2022, 2023, 2024], "recent2": [2023, 2024]}
    assert cube.year_sets([2022, 2023]) == {"2022": [2022], "2023": [2023], "all": [2022, 2023], "recent2": [2022, 2023]}


# ----------------------------------------------------------------- shard builder

def synthetic_harmonized(seed=0, strata=50, rows_per_psu=12):
    """A frame shaped like pipeline/.cache/harmonized.parquet with random teen values."""
    rng = np.random.default_rng(seed)
    n = strata * 2 * rows_per_psu
    frame = pd.DataFrame({
        config.YEAR: rng.choice(catalog.YEARS, n),
        config.STRATUM: np.repeat(np.arange(strata) + 40001, 2 * rows_per_psu),
        config.PSU: np.tile(np.repeat([1, 2], rows_per_psu), strata),
        "cohort": "teen",
    })
    for k, col in config.POOLED_WEIGHTS.items():
        frame[col] = rng.uniform(500, 5000, n) / k
    for group in catalog.groups():
        if "teen" in group["cohorts"]:
            levels = [level["id"] for level in group["levels"]][: 3 if group["id"] == "age_band" else None]
            frame[group["id"]] = rng.choice(levels, n)
    frame["mde_py"] = pd.array(np.where(rng.random(n) < 0.9, (rng.random(n) < 0.2).astype(float), np.nan), dtype="Int8")
    return frame


@pytest.fixture(scope="module")
def shard():
    data = cube.CohortData(synthetic_harmonized(), "teen")
    return cube.build(data, "mde_py", [2021, 2022, 2023, 2024])


def test_shard_cells_are_parallel_arrays_over_every_year_set(shard):
    doc, text, dropped = shard
    cells = doc["cells"]
    lengths = {len(v) for v in cells.values()}
    assert len(lengths) == 1
    assert dropped == []
    assert set(cells["year_set"]) == {"2021", "2022", "2023", "2024", "all", "recent2"}
    overall = [i for i, g in enumerate(cells["group"]) if g is None]
    assert len(overall) == 6
    assert cells["n"][overall[0]] > 0 and cells["pop"][overall[0]] % cube.POP_UNIT == 0
    assert "race_ethnicity_5" not in {g for g, g2 in zip(cells["group"], cells["group2"]) if g2 is None}
    assert "race_ethnicity" not in {g for g, g2 in zip(cells["group"], cells["group2"]) if g2 is not None}
    assert all(g is None or g != g2 for g, g2 in zip(cells["group"], cells["group2"]))
    for i, sup in enumerate(cells["suppressed"]):
        assert (cells["p"][i] is None) == sup and (cells["reason"][i] is not None) == sup


def test_shard_tests_cover_overall_levels_and_groups(shard):
    doc, _, _ = shard
    trend = doc["trend_tests"]
    assert len({len(v) for v in trend.values()}) == 1
    assert (None, None, 2021, 2024) in set(zip(trend["group"], trend["level"], trend["year_a"], trend["year_b"]))
    tests = doc["group_tests"]
    by_key = {(t["year_set"], t["group"]): t for t in tests}
    assert ("all", "sex") in by_key and ("2024", "race_ethnicity") in by_key
    sex = by_key[("all", "sex")]
    assert sex["df"] == [1, 50] and 0 <= sex["p_value"] <= 1
    assert sex["overall_significant"] == (sex["p_value"] < cube.ALPHA)
    assert sex["pairwise_p"][0][1] == sex["pairwise_p"][1][0] and sex["pairwise_p"][0][0] is None
    assert len(sex["vs_overall"]["diff"]) == 2


def test_shard_is_deterministic_and_within_limit(shard):
    doc, text, _ = shard
    data = cube.CohortData(synthetic_harmonized(), "teen")
    assert cube.build(data, "mde_py", [2021, 2022, 2023, 2024])[1] == text
    assert len(text.encode("utf-8")) <= cube.SHARD_LIMIT
    assert json.loads(text) == doc


def test_shard_drops_recent2_crosses_first_when_too_large(shard, monkeypatch):
    data = cube.CohortData(synthetic_harmonized(), "teen")
    monkeypatch.setattr(cube, "SHARD_LIMIT", len(shard[1].encode("utf-8")) - 1)
    doc, text, dropped = cube.build(data, "mde_py", [2021, 2022, 2023, 2024])
    assert dropped == ["recent2"]
    assert len(text.encode("utf-8")) < len(shard[1].encode("utf-8"))
    assert "recent2" not in doc["crosses"]
    assert not any(ys == "recent2" and g2 is not None for ys, g2 in zip(doc["cells"]["year_set"], doc["cells"]["group2"]))
