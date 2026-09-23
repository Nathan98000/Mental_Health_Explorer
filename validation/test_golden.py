"""Golden tests: reproduce every printed cell of the combined 2021-2024 PUF codebook's
Tables 4a/4b and 5a/5b (see validation/golden.py). Needs the raw file, so local only:

    NSDUH_RAW=/path/to/NSDUH_2021_2024_Tab.txt python -m pytest validation -q
"""
import os

import pytest

from pipeline import config
from validation import golden

pytestmark = pytest.mark.skipif(not os.environ.get(config.RAW_ENV_VAR), reason="raw NSDUH file not available")


@pytest.fixture(scope="module")
def result():
    return golden.compare(golden.extract())


def mismatches(result, column):
    bad = result[~result[f"{column}_match"]]
    return [f"{r.table} {r.measure} {r.age} {r.label}: {getattr(r, column)} != {getattr(r, f'target_{column}')}" for r in bad.itertuples()]


def test_targets_cover_every_printed_cell():
    rows = golden.targets()
    assert len(rows) == 33 + 49
    assert {r["table"] for r in rows} == {"4", "5"}


def test_percentages_match_at_printed_precision(result):
    assert mismatches(result, "pct") == []


def test_standard_errors_match_at_printed_precision(result):
    assert mismatches(result, "se") == []


def test_total_point_estimates_match_in_thousands(result):
    assert mismatches(result, "total") == []
