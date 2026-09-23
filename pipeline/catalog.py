"""Load and validate the indicator and group catalog (catalog/*.yaml)."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

import jsonschema
import yaml

from pipeline.config import REPO_ROOT

CATALOG_DIR = REPO_ROOT / "catalog"
SCHEMA_PATH = CATALOG_DIR / "schema.json"
INDICATORS_PATH = CATALOG_DIR / "indicators.yaml"
GROUPS_PATH = CATALOG_DIR / "groups.yaml"
PUF_COLUMNS_PATH = CATALOG_DIR / "puf_columns.txt"

COHORT_CODES = {"teen": 1, "young_adult": 2}   # CATAG6 codes
COHORT_LABELS = {"teen": "teens ages 12–17", "young_adult": "young adults ages 18–25"}
AGE_COLUMNS = ["CATAG6", "AGE3"]
YEARS = [2021, 2022, 2023, 2024]


@lru_cache(maxsize=None)
def schema() -> dict:
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


def load(path: Path) -> dict:
    """Read one catalog file and validate it against the schema."""
    doc = yaml.safe_load(path.read_text(encoding="utf-8"))
    jsonschema.Draft202012Validator(schema()).validate(doc)
    return doc


@lru_cache(maxsize=None)
def indicators() -> tuple[dict, ...]:
    return tuple(load(INDICATORS_PATH)["indicators"])


@lru_cache(maxsize=None)
def groups() -> tuple[dict, ...]:
    return tuple(load(GROUPS_PATH)["groups"])


def group_sources(group: dict) -> list[str]:
    source = group["source"]
    return list(source) if isinstance(source, list) else [source]


def level_codes(group: dict, level: dict) -> list[tuple[int, ...]]:
    """Each code as a tuple with one entry per source variable."""
    return [tuple(c) if isinstance(c, list) else (c,) for c in level["codes"]]


def indicator_columns(indicator: dict) -> list[str]:
    return [indicator["source"], *indicator.get("universe", {})]


def referenced_columns() -> list[str]:
    """Every PUF column the catalog uses, plus the age columns, in a stable order."""
    columns = list(AGE_COLUMNS)
    for ind in indicators():
        columns += indicator_columns(ind)
    for group in groups():
        columns += group_sources(group)
    return list(dict.fromkeys(columns))


@lru_cache(maxsize=None)
def puf_columns() -> frozenset[str]:
    return frozenset(PUF_COLUMNS_PATH.read_text(encoding="utf-8").split())
