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


def test_implies_reference_same_cohort_indicators_without_cycles():
    ids = {(ind["cohort"], ind["id"]) for ind in catalog.indicators()}
    for ind in catalog.indicators():
        for target in ind.get("implies", []):
            assert (ind["cohort"], target) in ids, f"{ind['cohort']}:{ind['id']} implies unknown {target}"
            assert target != ind["id"]
    for cohort in catalog.COHORT_CODES:
        for start, closure in catalog.implications(cohort).items():
            assert start not in closure, f"cycle through {cohort}:{start}"


@pytest.mark.parametrize(
    "cohort, a, b, expected",
    [
        ("teen", "mde_severe", "mde_lifetime", True),
        ("teen", "mde_severe", "mde_or_sud", True),
        ("teen", "mde_and_sud", "mde_lifetime", True),
        ("teen", "mde_and_sud", "sud_py", True),
        ("teen", "sud_py", "mde_or_sud", True),
        ("teen", "binge_pm", "alcohol_pm", True),
        ("teen", "marijuana_pm", "illicit_py", True),
        ("teen", "nicotine_vape_pm", "tobacco_or_vape_py", True),
        ("teen", "mde_py", "nicotine_vape_py", False),
        ("teen", "alcohol_pm", "marijuana_py", False),
        ("teen", "mde_py", "sud_py", False),
        ("young_adult", "smi_py", "ami_py", True),
        ("young_adult", "ami_and_sud", "sud_py", True),
        ("young_adult", "mde_severe", "mde_py", True),
        ("young_adult", "mde_py", "suicide_thoughts", False),
    ],
)
def test_nested_covers_definitional_chains(cohort, a, b, expected):
    assert catalog.nested(a, b, cohort) is expected
    assert catalog.nested(b, a, cohort) is expected
