"""The vectorized estimator equals the reference estimator on real cells. Local only."""
import os

import numpy as np
import pytest

from pipeline import catalog, config, cube
from pipeline.estimate import proportion
from validation.data import load_harmonized

pytestmark = pytest.mark.skipif(not os.environ.get(config.RAW_ENV_VAR), reason="raw NSDUH file not available")

RANDOM_CELLS = 200
TOL = 1e-12


def random_cells(frame, n=RANDOM_CELLS, seed=20240923):
    """(cohort, indicator, years, group, level) drawn at random from the catalog."""
    rng = np.random.default_rng(seed)
    launch = [i for i in catalog.indicators() if i["status"] == "launch"]
    groups = [g for g in catalog.groups() if not g.get("crosses_only")]
    out = []
    while len(out) < n:
        ind = launch[rng.integers(len(launch))]
        years = list(ind["years"])
        pick = rng.choice(["single", "all", "recent2"])
        years = [years[rng.integers(len(years))]] if pick == "single" else (years if pick == "all" else years[-2:])
        group = groups[rng.integers(len(groups))]
        if ind["cohort"] not in group["cohorts"]:
            continue
        levels = [l["id"] for l in group["levels"] if l["id"] in set(frame.loc[frame["cohort"] == ind["cohort"], group["id"]].dropna())]
        out.append((ind["cohort"], ind["id"], years, group["id"], levels[rng.integers(len(levels))]))
    return out


def test_vectorized_matches_reference_on_random_real_cells():
    frame = load_harmonized()
    weights = {k: frame[c].to_numpy(dtype="float64") for k, c in config.POOLED_WEIGHTS.items()}
    stratum, psu, year = frame[config.STRATUM].to_numpy(), frame[config.PSU].to_numpy(), frame[config.YEAR].to_numpy()
    cohorts = {c: cube.CohortData(frame, c) for c in catalog.COHORT_CODES}
    worst = 0.0
    for cohort, ind, years, group, level in random_cells(frame):
        data = cohorts[cohort]
        w = weights[len(years)]
        y = np.where((frame["cohort"] == cohort).to_numpy(), frame[ind].to_numpy(dtype="float64", na_value=np.nan), np.nan)
        domain = np.isin(year, years) & (frame[group].to_numpy() == level)
        ref = proportion(y, w, stratum, psu, domain=domain)

        spec = data.groups[group]
        keep = np.isin(data.year, years) & ~np.isnan(data.indicator(ind))
        est = cube.cells(data.design, data.psu[keep], data.indicator(ind)[keep], data.weights[len(years)][keep], spec["codes"][keep], len(spec["levels"]))
        k = spec["levels"].index(level)
        assert est.n[k] == ref.n
        for a, b in ((est.p[k], ref.p), (est.se[k], ref.se), (est.lo[k], ref.lo), (est.hi[k], ref.hi)):
            if np.isnan(b):
                assert np.isnan(a)
            else:
                worst = max(worst, abs(a - b))
                assert a == pytest.approx(b, abs=TOL)
        assert est.reason[k] == ref.reason
    print(f"max |difference| over {RANDOM_CELLS} cells: {worst:.2e}")
