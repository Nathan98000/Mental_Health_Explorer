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


@lru_cache(maxsize=None)
def implications(cohort: str) -> dict[str, frozenset[str]]:
    """For every indicator id in the cohort, the ids a yes implies by definition: the
    transitive closure of the catalog's `implies` (e.g. mde_severe -> mde_py -> mde_lifetime)."""
    direct = {ind["id"]: list(ind.get("implies", [])) for ind in indicators() if ind["cohort"] == cohort}
    closure = {}
    for start in direct:
        seen: set[str] = set()
        stack = list(direct[start])
        while stack:
            x = stack.pop()
            if x not in seen:
                seen.add(x)
                stack.extend(direct.get(x, []))
        closure[start] = frozenset(seen)
    return closure


def nested(a: str, b: str, cohort: str) -> bool:
    """True when either indicator implies the other, directly or through a chain, so the
    pair is true by definition and not a meaningful association."""
    closure = implications(cohort)
    return b in closure.get(a, ()) or a in closure.get(b, ())


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
