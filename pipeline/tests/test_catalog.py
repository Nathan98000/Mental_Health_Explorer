"""Catalog checks that need no survey data (run in CI)."""
from collections import Counter

import jsonschema
import pytest

from pipeline import catalog


def test_catalog_validates_against_schema():
    validator = jsonschema.Draft202012Validator(catalog.schema())
    validator.check_schema(catalog.schema())
    for path in (catalog.INDICATORS_PATH, catalog.GROUPS_PATH):
        catalog.load(path)  # raises ValidationError if the file does not conform


def test_indicator_ids_unique_per_cohort():
    counts = Counter((ind["cohort"], ind["id"]) for ind in catalog.indicators())
    assert [key for key, n in counts.items() if n > 1] == []


def test_source_and_universe_variables_exist_in_puf():
    columns = catalog.puf_columns()
    assert len(columns) == 2638
    missing = [(ind["cohort"], ind["id"], v) for ind in catalog.indicators() for v in catalog.indicator_columns(ind) if v not in columns]
    missing += [(g["id"], v) for g in catalog.groups() for v in catalog.group_sources(g) if v not in columns]
    assert missing == []


def test_puf_columns_file_is_a_header():
    names = catalog.PUF_COLUMNS_PATH.read_text(encoding="utf-8").split("\n")
    assert names[-1] == "" and all(n and n == n.strip() for n in names[:-1])
    assert len(set(names[:-1])) == len(names) - 1


@pytest.mark.parametrize("indicator", catalog.indicators(), ids=lambda i: f"{i['cohort']}:{i['id']}")
def test_yes_and_no_codes_are_disjoint(indicator):
    assert not set(indicator["yes"]) & set(indicator["no"])


@pytest.mark.parametrize("group", catalog.groups(), ids=lambda g: g["id"])
def test_group_levels_unique(group):
    ids = [level["id"] for level in group["levels"]]
    labels = [level["label"] for level in group["levels"]]
    codes = [code for level in group["levels"] for code in catalog.level_codes(group, level)]
    assert len(set(ids)) == len(ids)
    assert len(set(labels)) == len(labels)
    assert len(set(codes)) == len(codes)
    assert all(len(code) == len(catalog.group_sources(group)) for code in codes)


def test_codebook_name_matches_source():
    assert [ind["id"] for ind in catalog.indicators() if ind["codebook"] != ind["source"]] == []
