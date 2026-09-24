"""Declared implications hold in the data, and every empirical nesting among association
measures is declared (local only: needs the harmonized file)."""
import itertools
import json
import os

import numpy as np
import pytest

from pipeline import catalog, config
from pipeline.associations import ASSOCIATIONS_DIR, EXPOSURE_TOPICS, OUTCOME_TOPICS, launch
from validation.data import load_harmonized

pytestmark = pytest.mark.skipif(not os.environ.get(config.RAW_ENV_VAR), reason="raw NSDUH file not available")


@pytest.fixture(scope="module")
def frame():
    return load_harmonized()


def counts(frame, cohort, a, b):
    """(respondents with a = 1 and b observed, respondents with a = 1 and b = 0) within the cohort, all years."""
    sub = frame[frame["cohort"] == cohort]
    ya = sub[a].to_numpy(dtype="float64", na_value=np.nan)
    yb = sub[b].to_numpy(dtype="float64", na_value=np.nan)
    both = ~np.isnan(ya) & ~np.isnan(yb)
    return int(((ya == 1) & both).sum()), int(((ya == 1) & (yb == 0)).sum())


def test_declared_implications_have_no_counterexample(frame):
    violations = []
    for ind in catalog.indicators():
        for target in ind.get("implies", []):
            n_a1, n_a1_b0 = counts(frame, ind["cohort"], ind["id"], target)
            if n_a1 == 0 or n_a1_b0 > 0:
                violations.append((ind["cohort"], ind["id"], target, n_a1, n_a1_b0))
    assert violations == []


@pytest.mark.parametrize("cohort", list(catalog.COHORT_CODES))
def test_every_empirical_nesting_is_declared(frame, cohort):
    ids = [i["id"] for i in launch(cohort, OUTCOME_TOPICS + EXPOSURE_TOPICS)]
    missed = []
    for a, b in itertools.permutations(ids, 2):
        n_a1, n_a1_b0 = counts(frame, cohort, a, b)
        if n_a1 > 0 and n_a1_b0 == 0 and b not in catalog.implications(cohort).get(a, ()):
            missed.append((a, b))
    assert missed == []


def test_teen_vape_association_regression():
    doc = json.loads((ASSOCIATIONS_DIR / "teen.json").read_text(encoding="utf-8"))
    pair = next(p for p in doc["pairs"] if (p["outcome"], p["exposure"], p["year_set"]) == ("mde_py", "nicotine_vape_py", "latest"))
    assert pair["years"] == [2024]
    assert 100 * pair["exposed"]["p"] == pytest.approx(35.54, abs=0.01)
    assert 100 * pair["unexposed"]["p"] == pytest.approx(11.99, abs=0.01)
