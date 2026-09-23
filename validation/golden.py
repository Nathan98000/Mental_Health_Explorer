"""Reproduce the reference tables printed in the combined 2021-2024 PUF codebook.

validation/golden_tables.csv transcribes every printed cell of Tables 4a/4b (any tobacco
use in lifetime, past year and past month, all ages, 2021-2024, ANALWT2_C4) and 5a/5b
(any past-year prescription psychotherapeutic use, 2022-2023, ANALWT2_C2, by age group and
by sex, race/ethnicity, education and employment). `compare()` computes each cell with
pipeline.cube on the raw file and matches the percentage (1 decimal), its SE (2 decimals)
and the total point estimate (thousands) at printed precision. SEs of totals are not
compared: SAMHSA computes some with an alternative method for fixed domains.
"""
from __future__ import annotations

import csv
from pathlib import Path

import duckdb
import numpy as np
import pandas as pd

from pipeline import config, cube

TARGETS_PATH = Path(__file__).parent / "golden_tables.csv"
COLUMNS = ["CATAG6", "IRSEX", "NEWRACE2", "EDUHIGHCAT", "IRWRKSTAT18", "TOBFLAG", "TOBYR", "TOBMON", "PSYANYYR"]
AGE_CODES = {"all": [1, 2, 3, 4, 5, 6], "12-17": [1], "18-25": [2], "26+": [3, 4, 5, 6]}   # CATAG6
NOT_COLLECTED = -9


def targets() -> list[dict]:
    with TARGETS_PATH.open(encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    for row in rows:
        row["years"] = list(range(int(row["years"][:4]), int(row["years"][-4:]) + 1))
        row["codes"] = [int(c) for c in row["domain_codes"].split(";")] if row["domain_codes"] else None
        row["estimate_pct"] = float(row["estimate_pct"])
        row["se_pct"] = float(row["se_pct"])
        row["total_thousands"] = int(row["total_thousands"])
    return rows


def extract() -> pd.DataFrame:
    """All ages, the golden columns plus the design columns (pipeline/.cache/golden.parquet)."""
    from pipeline.ingest import ingest

    path = ingest(COLUMNS, name="golden")
    return duckdb.connect().execute("SELECT * FROM read_parquet(?)", [str(path)]).df()


def compare(frame: pd.DataFrame) -> pd.DataFrame:
    """One row per target cell with the computed values and match flags."""
    design = cube.Design.from_columns(frame[config.STRATUM].to_numpy(), frame[config.PSU].to_numpy())
    year = frame[config.YEAR].to_numpy()
    out = []
    for t in targets():
        y = frame[t["measure"]].to_numpy(dtype="float64", na_value=np.nan)
        y = np.where(y == NOT_COLLECTED, np.nan, y)
        keep = np.isin(year, t["years"]) & np.isin(frame["CATAG6"].to_numpy(), AGE_CODES[t["age"]])
        if t["domain_variable"]:
            keep &= np.isin(frame[t["domain_variable"]].to_numpy(dtype="float64", na_value=np.nan), t["codes"])
        w = frame[t["weight"]].to_numpy(dtype="float64")
        est = cube.cells(design, design.psu[keep], y[keep], w[keep], np.zeros(int(keep.sum()), dtype=np.int64), 1)
        pct, se, total = 100 * est.p[0], 100 * est.se[0], est.yes[0] / 1000
        out.append({
            "table": t["table"], "measure": t["measure"], "age": t["age"], "label": t["label"],
            "target_pct": t["estimate_pct"], "pct": round(pct, 1), "pct_match": round(pct, 1) == t["estimate_pct"],
            "target_se": t["se_pct"], "se": round(se, 2), "se_match": round(se, 2) == t["se_pct"],
            "target_total": t["total_thousands"], "total": int(round(total)), "total_match": int(round(total)) == t["total_thousands"],
            "n": int(est.n[0]), "pct_raw": pct, "se_raw": se, "total_raw": total,
        })
    return pd.DataFrame(out)


def summary(result: pd.DataFrame) -> dict:
    return {
        "cells": int(3 * len(result)),
        "matched": int(result["pct_match"].sum() + result["se_match"].sum() + result["total_match"].sum()),
        "pct": {"matched": int(result["pct_match"].sum()), "of": len(result)},
        "se": {"matched": int(result["se_match"].sum()), "of": len(result)},
        "total": {"matched": int(result["total_match"].sum()), "of": len(result)},
    }
