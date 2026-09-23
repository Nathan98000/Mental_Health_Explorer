"""Turn the catalog extract into analysis-ready columns for ages 12-25.

Reads pipeline/.cache/catalog.parquet (see `python -m pipeline.ingest --catalog`) and
the catalog, and writes:

- pipeline/.cache/harmonized.parquet (git-ignored): one row per respondent aged 12-25
  with the design columns, YEAR, cohort, one column per group (level ids, missing when
  the respondent's codes match no level) and one int8 column per indicator id:
  1 = yes, 0 = no, missing outside the indicator's cohort or universe, or when the
  source value is not a listed yes/no code (blank, -9, 85-99). QUESTID2 is dropped.
- data/availability.json (committed): for each cohort, indicator and year, whether the
  item was collected (false when every value that year is -9 or blank within the
  cohort) and the number of respondents with a 1/0 value.
"""
from __future__ import annotations

import json

import duckdb
import numpy as np
import pandas as pd

from pipeline import catalog, config

NOT_COLLECTED = -9
HARMONIZED_PATH = config.CACHE_DIR / "harmonized.parquet"
AVAILABILITY_PATH = config.OUTPUT_DIR / "availability.json"


def load_extract(parquet=config.CACHE_DIR / "catalog.parquet") -> pd.DataFrame:
    codes = ", ".join(str(c) for c in catalog.COHORT_CODES.values())
    con = duckdb.connect()
    df = con.execute(f"SELECT * FROM read_parquet(?) WHERE CATAG6 IN ({codes})", [str(parquet)]).df()
    by_code = {code: name for name, code in catalog.COHORT_CODES.items()}
    df["cohort"] = pd.Categorical(df["CATAG6"].map(by_code), categories=list(catalog.COHORT_CODES))
    return df


def group_column(df: pd.DataFrame, group: dict) -> pd.Categorical:
    sources = catalog.group_sources(group)
    keys = list(zip(*(df[s].to_numpy() for s in sources)))
    lookup = {code: level["id"] for level in group["levels"] for code in catalog.level_codes(group, level)}
    values = np.array([lookup.get(k) for k in keys], dtype=object)
    values[~df["cohort"].isin(group["cohorts"]).to_numpy()] = None
    return pd.Categorical(values, categories=[level["id"] for level in group["levels"]])


def indicator_mask(df: pd.DataFrame, indicator: dict) -> np.ndarray:
    """Rows in the indicator's cohort and universe."""
    mask = (df["cohort"] == indicator["cohort"]).to_numpy(dtype=bool, copy=True)
    for var, codes in indicator.get("universe", {}).items():
        mask &= df[var].isin(codes).to_numpy()
    return mask


def indicator_values(df: pd.DataFrame, indicator: dict, mask: np.ndarray) -> np.ndarray:
    source = df[indicator["source"]]
    values = np.where(source.isin(indicator["yes"]), 1.0, np.where(source.isin(indicator["no"]), 0.0, np.nan))
    return np.where(mask, values, np.nan)


def harmonize(df: pd.DataFrame) -> pd.DataFrame:
    out = df[[*config.DESIGN_COLUMNS, "cohort"]].copy()
    for group in catalog.groups():
        out[group["id"]] = group_column(df, group)
    columns: dict[str, np.ndarray] = {}
    for ind in catalog.indicators():
        values = indicator_values(df, ind, indicator_mask(df, ind))
        columns[ind["id"]] = np.where(np.isnan(values), columns.get(ind["id"], np.full(len(df), np.nan)), values)
    for name, values in columns.items():
        out[name] = pd.array(values, dtype="Int8")
    return out


def availability(df: pd.DataFrame, harmonized: pd.DataFrame) -> dict:
    result: dict[str, dict[str, dict]] = {cohort: {} for cohort in catalog.COHORT_CODES}
    years = df[config.YEAR].to_numpy()
    for ind in catalog.indicators():
        in_cohort = (df["cohort"] == ind["cohort"]).to_numpy()
        source = df[ind["source"]].to_numpy(dtype="float64", na_value=np.nan)
        values = harmonized[ind["id"]].to_numpy(dtype="float64", na_value=np.nan)
        by_year = {}
        for year in catalog.YEARS:
            rows = in_cohort & (years == year)
            observed = source[rows]
            collected = bool(np.any(~np.isnan(observed) & (observed != NOT_COLLECTED)))
            by_year[str(year)] = {"collected": collected, "n_valid": int(np.sum(~np.isnan(values[rows])))}
        result[ind["cohort"]][ind["id"]] = by_year
    return result


def write_parquet(frame: pd.DataFrame, path) -> None:
    con = duckdb.connect()
    con.register("frame", frame)
    con.execute(f"COPY frame TO '{path}' (FORMAT parquet, COMPRESSION zstd)")


def main() -> None:
    df = load_extract()
    harmonized = harmonize(df)
    config.CACHE_DIR.mkdir(parents=True, exist_ok=True)
    write_parquet(harmonized, HARMONIZED_PATH)
    config.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    AVAILABILITY_PATH.write_text(json.dumps(availability(df, harmonized), indent=1) + "\n", encoding="utf-8")
    counts = harmonized["cohort"].value_counts().to_dict()
    print(f"Wrote {HARMONIZED_PATH} ({len(harmonized):,} rows: {counts}) and {AVAILABILITY_PATH}")


if __name__ == "__main__":
    main()
