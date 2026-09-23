"""Design-based estimates for the NSDUH public use file.

Implements what the PUF users' guide prescribes:
- weighted proportions with Taylor-linearized standard errors, using VESTR_C as
  strata and VEREP as PSUs (with-replacement design, 50 degrees of freedom);
- domain (subpopulation) estimates computed on the full sample, so every PSU in
  a stratum counts toward the variance even when it has no domain members;
- logit-transformed 95% confidence intervals with t critical values;
- the 2024 NSDUH suppression rule (users' guide Table 11.1).
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
import pandas as pd

from pipeline.config import DEGREES_OF_FREEDOM

# Two-sided 95% critical value of Student's t with 50 df.
T_CRIT = {50: 2.0085591121007611}
SUPPRESSION_RSE_LIMIT = 0.175
SUPPRESSION_MIN_N = 50


@dataclass(frozen=True)
class Estimate:
    p: float                 # weighted proportion (0-1)
    se: float                # standard error of p
    lo: float                # lower bound of the 95% logit CI
    hi: float                # upper bound of the 95% logit CI
    n: int                   # unweighted respondents in the denominator
    weighted_n: float        # sum of weights in the denominator (population size for the right weight)
    suppressed: bool
    reason: str | None = None


def _as_float_array(values) -> np.ndarray:
    return np.asarray(values, dtype="float64")


def taylor_variance(z: np.ndarray, stratum: np.ndarray, psu: np.ndarray) -> float:
    """Between-PSU variance of linearized values z (with-replacement design).

    V = sum_h n_h / (n_h - 1) * sum_j (z_hj - mean_h)^2, where z_hj is the PSU total.
    Strata with a single PSU contribute nothing (they cannot be estimated).
    """
    frame = pd.DataFrame({"h": stratum, "j": psu, "z": z})
    psu_totals = frame.groupby(["h", "j"], sort=False)["z"].sum().reset_index()
    grouped = psu_totals.groupby("h")["z"]
    n_h = grouped.transform("size").to_numpy()
    dev = (psu_totals["z"] - grouped.transform("mean")).to_numpy()
    keep = n_h > 1
    return float(np.sum((n_h[keep] / (n_h[keep] - 1)) * dev[keep] ** 2))


def logit_ci(p: float, se: float, df: int = DEGREES_OF_FREEDOM) -> tuple[float, float]:
    """95% CI on the logit scale, as NSDUH does for proportions."""
    if not (0 < p < 1) or not math.isfinite(se):
        return (float("nan"), float("nan"))
    t = T_CRIT.get(df)
    if t is None:
        raise ValueError(f"No t critical value stored for df={df}")
    logit = math.log(p / (1 - p))
    half = t * se / (p * (1 - p))
    expit = lambda x: 1 / (1 + math.exp(-x))  # noqa: E731
    return (expit(logit - half), expit(logit + half))


def suppression(p: float, se: float, n: int) -> str | None:
    """Return the reason an estimate must be suppressed, or None if it can be shown."""
    if n < SUPPRESSION_MIN_N:
        return f"fewer than {SUPPRESSION_MIN_N} respondents"
    if p <= 0 or p >= 1:
        return "estimate is 0% or 100%"
    q = p if p <= 0.5 else 1 - p
    if (se / q) / (-math.log(q)) > SUPPRESSION_RSE_LIMIT:
        return "estimate is too imprecise"
    return None


def proportion(y, weight, stratum, psu, domain=None, df: int = DEGREES_OF_FREEDOM) -> Estimate:
    """Weighted proportion of y == 1 among respondents with non-missing y in the domain.

    y: 1 / 0 / NaN per respondent (NaN = not in universe or missing).
    domain: optional boolean mask; respondents outside it are treated as missing but
            kept in the design, which is what makes domain SEs correct.
    """
    y = _as_float_array(y)
    w = _as_float_array(weight)
    in_scope = ~np.isnan(y)
    if domain is not None:
        in_scope &= np.asarray(domain, dtype=bool)
    n = int(in_scope.sum())
    if n == 0:
        return Estimate(float("nan"), float("nan"), float("nan"), float("nan"), 0, 0.0, True, "no respondents")

    wy = np.where(in_scope, w * np.nan_to_num(y), 0.0)
    wd = np.where(in_scope, w, 0.0)
    total_w = float(wd.sum())
    p = float(wy.sum() / total_w)
    z = (wy - p * wd) / total_w
    se = math.sqrt(taylor_variance(z, np.asarray(stratum), np.asarray(psu)))
    lo, hi = logit_ci(p, se, df)
    reason = suppression(p, se, n)
    return Estimate(p, se, lo, hi, n, total_w, reason is not None, reason)
