"""Phase 1 checks against the raw file and the combined codebook. Local only:

    NSDUH_RAW=/path/to/NSDUH_2021_2024_Tab.txt python -m pytest validation -q

The codebook PDF is expected next to the raw file (or set NSDUH_CODEBOOK).
"""
import json
import os
from pathlib import Path

import duckdb
import numpy as np
import pytest

from pipeline import catalog, config, harmonize
from pipeline.estimate import proportion
from validation import codebook

pytestmark = pytest.mark.skipif(not os.environ.get(config.RAW_ENV_VAR), reason="raw NSDUH file not available")

CODEBOOK_ENV_VAR = "NSDUH_CODEBOOK"
CODEBOOK_FILENAME = "nsduh-2021_2024-ds0001-info-codebook_v1.pdf"
TOTAL_ROWS = 232_441
COHORT_ROWS = {"teen": 45_618, "young_adult": 56_009}


@pytest.fixture(scope="module")
def extract():
    from pipeline.ingest import ingest_catalog

    return ingest_catalog()


@pytest.fixture(scope="module")
def harmonized(extract):
    df = harmonize.load_extract(extract)
    out = harmonize.harmonize(df)
    harmonize.write_parquet(out, harmonize.HARMONIZED_PATH)
    harmonize.AVAILABILITY_PATH.write_text(json.dumps(harmonize.availability(df, out), indent=1) + "\n", encoding="utf-8")
    return duckdb.connect().execute("SELECT * FROM read_parquet(?)", [str(harmonize.HARMONIZED_PATH)]).df()


@pytest.fixture(scope="module")
def codebook_entries():
    pdf = Path(os.environ.get(CODEBOOK_ENV_VAR) or config.raw_path().parent / CODEBOOK_FILENAME)
    text = codebook.extract_text(pdf, config.CACHE_DIR / "codebook_2021_2024.txt")
    return codebook.index(codebook.parse(text))


def observed_frequencies(extract, variable) -> dict[str, int]:
    rows = duckdb.connect().execute(
        f'SELECT "{variable}", count(*) FROM read_parquet(?) GROUP BY 1', [str(extract)]
    ).fetchall()
    return {"." if code is None else str(int(code)): n for code, n in rows}


@pytest.mark.parametrize("variable", catalog.referenced_columns())
def test_codebook_frequencies(extract, codebook_entries, variable):
    entry = codebook.lookup(codebook_entries, variable, set(catalog.puf_columns()))
    assert entry.total == TOTAL_ROWS
    assert observed_frequencies(extract, variable) == entry.freq


def test_availability_years_match_catalog(harmonized):
    availability = json.loads(harmonize.AVAILABILITY_PATH.read_text(encoding="utf-8"))
    mismatches = []
    for ind in catalog.indicators():
        derived = [int(y) for y, v in availability[ind["cohort"]][ind["id"]].items() if v["collected"]]
        if derived != ind["years"]:
            mismatches.append((ind["cohort"], ind["id"], derived, ind["years"]))
    assert mismatches == []


def teen_estimate(harmonized, indicator, year):
    sub = harmonized[harmonized[config.YEAR] == year].reset_index(drop=True)
    y = sub[indicator].to_numpy(dtype="float64", na_value=np.nan)
    return proportion(y, sub[config.SINGLE_YEAR_WEIGHT], sub[config.STRATUM], sub[config.PSU], domain=(sub["cohort"] == "teen").to_numpy())


@pytest.mark.parametrize("indicator, published", [("suicide_thoughts", 13.4), ("suicide_plan", 6.5)])
def test_teen_suicide_2022_matches_samhsa(harmonized, indicator, published):
    assert 100 * teen_estimate(harmonized, indicator, 2022).p == pytest.approx(published, abs=0.1)


def test_harmonized_row_counts(harmonized):
    assert harmonized["cohort"].value_counts().to_dict() == COHORT_ROWS
    assert "QUESTID2" not in harmonized.columns


@pytest.mark.parametrize("year, expected", [(2021, 20.54), (2024, 14.84)])
def test_teen_mde_regression(harmonized, year, expected):
    assert 100 * teen_estimate(harmonized, "mde_py", year).p == pytest.approx(expected, abs=0.01)
