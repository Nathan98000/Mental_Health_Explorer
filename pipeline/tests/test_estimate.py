"""Unit tests for the estimator on small synthetic designs (no survey data needed)."""
import math

import numpy as np
import pytest

from pipeline.estimate import logit_ci, proportion, suppression, taylor_variance


def tiny_design():
    # Two strata x two PSUs, hand-computed: p = 0.5, SE = 0.125.
    y = [1, 0, 1, 0, 1, 0]
    w = [1, 1, 2, 1, 1, 2]
    h = [1, 1, 1, 2, 2, 2]
    j = [1, 1, 2, 1, 2, 2]
    return y, w, h, j


def test_hand_computed_proportion_and_se():
    y, w, h, j = tiny_design()
    est = proportion(y, w, h, j)
    assert est.p == pytest.approx(0.5)
    assert est.se == pytest.approx(0.125)
    assert est.n == 6
    assert est.weighted_n == pytest.approx(8)


def test_single_psu_stratum_contributes_no_variance():
    z = np.array([0.1, -0.1, 0.3])
    assert taylor_variance(z, np.array([1, 1, 2]), np.array([1, 2, 1])) == pytest.approx(2 * 0.1**2 * 2)


def test_weights_scale_invariance():
    y, w, h, j = tiny_design()
    a = proportion(y, w, h, j)
    b = proportion(y, [x / 4 for x in w], h, j)  # e.g. ANALWT2_C1 vs ANALWT2_C4
    assert a.p == pytest.approx(b.p)
    assert a.se == pytest.approx(b.se)


def synthetic_survey(seed=0, strata=50, rows_per_psu=40):
    rng = np.random.default_rng(seed)
    n = strata * 2 * rows_per_psu
    h = np.repeat(np.arange(strata), 2 * rows_per_psu)
    j = np.tile(np.repeat([1, 2], rows_per_psu), strata)
    w = rng.uniform(100, 3000, n)
    girl = rng.random(n) < 0.5
    y = (rng.random(n) < np.where(girl, 0.22, 0.09)).astype(float)
    return y, w, h, j, girl


def test_domain_point_estimate_matches_subset():
    y, w, h, j, girl = synthetic_survey()
    dom = proportion(y, w, h, j, domain=girl)
    sub = np.average(y[girl], weights=w[girl])
    assert dom.p == pytest.approx(sub)
    assert dom.n == int(girl.sum())


def test_missing_values_are_excluded_from_denominator():
    y, w, h, j, _ = synthetic_survey(seed=1)
    y_missing = y.copy()
    y_missing[::10] = np.nan
    est = proportion(y_missing, w, h, j)
    keep = ~np.isnan(y_missing)
    assert est.p == pytest.approx(np.average(y_missing[keep], weights=w[keep]))
    assert est.n == int(keep.sum())


def test_logit_ci_is_asymmetric_and_bounded():
    lo, hi = logit_ci(0.05, 0.01)
    assert 0 < lo < 0.05 < hi < 1
    assert (0.05 - lo) < (hi - 0.05)


def test_logit_ci_undefined_at_bounds():
    assert all(math.isnan(v) for v in logit_ci(0.0, 0.01))


@pytest.mark.parametrize(
    "p, se, n, expected",
    [
        (0.20, 0.010, 49, "fewer than 50 respondents"),
        (0.00, 0.000, 500, "estimate is 0% or 100%"),
        (0.20, 0.010, 500, None),                         # (0.010/0.20)/ln(1/0.20) = 0.031
        (0.02, 0.010, 500, None),                         # (0.010/0.02)/ln(50) = 0.128
        (0.02, 0.014, 500, "estimate is too imprecise"),  # (0.014/0.02)/ln(50) = 0.179 > 0.175
    ],
)
def test_suppression_rule(p, se, n, expected):
    assert suppression(p, se, n) == expected


def test_suppression_mirrors_above_half():
    assert suppression(0.98, 0.0140, 500) == suppression(0.02, 0.0140, 500)
