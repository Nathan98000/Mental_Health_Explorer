"""Golden tests: reproduce the reference tables printed in the combined 2021-2024
PUF codebook (Tables 4b and 5b). Needs the raw file, so it runs locally only:

    NSDUH_RAW=/path/to/NSDUH_2021_2024_Tab.txt python -m pytest validation -q
"""
import os

import duckdb
import numpy as np
import pytest

from pipeline import config
from pipeline.estimate import proportion

pytestmark = pytest.mark.skipif(not os.environ.get(config.RAW_ENV_VAR), reason="raw NSDUH file not available")

COLUMNS = ["CATAG6", "TOBYR", "TOBMON", "PSYANYYR"]


@pytest.fixture(scope="module")
def data():
    from pipeline.ingest import ingest

    path = ingest(COLUMNS, name="golden")
    return duckdb.connect().execute("SELECT * FROM read_parquet(?)", [str(path)]).df()


def est(df, var, weight, domain=None):
    return proportion(df[var].astype(float), df[weight], df[config.STRATUM], df[config.PSU], domain=domain)


def test_table_4b_past_year_tobacco_all_ages_2021_2024(data):
    e = est(data, "TOBYR", "ANALWT2_C4")
    assert round(100 * e.p, 1) == 22.7
    assert round(100 * e.se, 2) == 0.18


def test_table_4b_past_month_tobacco_all_ages_2021_2024(data):
    e = est(data, "TOBMON", "ANALWT2_C4")
    assert round(100 * e.p, 1) == 18.1
    assert round(100 * e.se, 2) == 0.16


def test_table_5b_psychotherapeutics_teens_2022_2023(data):
    pooled = data[data[config.YEAR].isin([2022, 2023])].reset_index(drop=True)
    e = est(pooled, "PSYANYYR", "ANALWT2_C2", domain=np.asarray(pooled["CATAG6"] == 1))
    assert round(100 * e.p, 1) == 20.2
    assert round(100 * e.se, 2) == 0.49
