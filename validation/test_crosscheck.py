"""Python estimates agree with R's survey package (see validation/crosscheck.py). Local only:
needs the raw file and Rscript with the survey and jsonlite packages."""
import os
import shutil

import pytest

from pipeline import config
from validation import crosscheck

pytestmark = [
    pytest.mark.skipif(not os.environ.get(config.RAW_ENV_VAR), reason="raw NSDUH file not available"),
    pytest.mark.skipif(not shutil.which("Rscript"), reason="Rscript not installed"),
]


@pytest.fixture(scope="module")
def summary():
    return crosscheck.run()


def test_cells_match_svyby_svymean(summary):
    assert summary["cells"]["n"] == crosscheck.N_CELLS
    assert summary["cells"]["max_dp_points"] <= crosscheck.TOL_P_POINTS
    assert summary["cells"]["max_se_rel"] <= crosscheck.TOL_RELATIVE


def test_group_tests_match_svyby_covmat(summary):
    assert summary["group_tests"]["n"] == crosscheck.N_GROUP_TESTS
    assert summary["group_tests"]["max_w_rel"] <= crosscheck.TOL_RELATIVE


def test_year_differences_match_svycontrast(summary):
    assert summary["year_diffs"]["n"] == crosscheck.N_YEAR_DIFFS
    assert summary["year_diffs"]["max_se_rel"] <= crosscheck.TOL_RELATIVE
    assert summary["year_diffs"]["max_dp_points"] <= crosscheck.TOL_P_POINTS
