"""Shared access to the local harmonized file for validation code (tests, cross-check, report)."""
from __future__ import annotations

import pandas as pd

from pipeline import cube, harmonize


def load_harmonized(rebuild: bool = False) -> pd.DataFrame:
    """pipeline/.cache/harmonized.parquet as a DataFrame, built from the raw file if missing."""
    if rebuild or not harmonize.HARMONIZED_PATH.exists():
        from pipeline.ingest import ingest_catalog

        ingest_catalog()
        harmonize.main()
    return cube.load_harmonized()
