"""Paths and survey-design constants shared by the pipeline."""
from __future__ import annotations

import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = REPO_ROOT / "pipeline" / ".cache"      # git-ignored intermediate files
OUTPUT_DIR = REPO_ROOT / "data"                     # committed outputs used by the site

# The 1.6 GB NSDUH file never enters the repo. Point NSDUH_RAW at it, e.g.
#   export NSDUH_RAW="$HOME/Downloads/Projects/Youth_Mental_Health/NSDUH_2021_2024_Tab.txt"
RAW_ENV_VAR = "NSDUH_RAW"

# Design variables (combined 2021-2024 PUF codebook, "Weights and Design Variables").
YEAR = "YEAR"
STRATUM = "VESTR_C"          # variance estimation pseudo-stratum, 50 per year
PSU = "VEREP"                # variance estimation pseudo-replicate (PSU) within stratum
SINGLE_YEAR_WEIGHT = "ANALWT2_C1"
POOLED_WEIGHTS = {1: "ANALWT2_C1", 2: "ANALWT2_C2", 3: "ANALWT2_C3", 4: "ANALWT2_C4"}
DESIGN_COLUMNS = [YEAR, STRATUM, PSU, *POOLED_WEIGHTS.values()]

# Degrees of freedom for variance estimation: 50 pseudo-strata; pooling years from the
# same sample design keeps df at 50 (PUF users' guide, Section 10).
DEGREES_OF_FREEDOM = 50


def raw_path() -> Path:
    value = os.environ.get(RAW_ENV_VAR)
    if not value:
        raise RuntimeError(
            f"Set {RAW_ENV_VAR} to the path of NSDUH_2021_2024_Tab.txt (the raw file is not in the repo)."
        )
    path = Path(value).expanduser()
    if not path.exists():
        raise FileNotFoundError(f"{RAW_ENV_VAR} points to a missing file: {path}")
    return path
