"""Lock the Phase 1 catalog decisions (no survey data needed)."""
import re

import pytest

from pipeline import catalog

TOPICS_PATH = catalog.CATALOG_DIR / "topics.yaml"
MENTAL_ILLNESS_INDICATORS = ["spd_py", "ami_py", "smi_py", "ami_and_sud"]


def topics() -> list[dict]:
    return catalog.load(TOPICS_PATH)["topics"]  # validated against the schema


def indicator(cohort: str, id: str) -> dict:
    return next(i for i in catalog.indicators() if i["cohort"] == cohort and i["id"] == id)


def test_topics_file_matches_schema_enum_and_usage():
    ids = [t["id"] for t in topics()]
    assert len(set(ids)) == len(ids)
    assert set(ids) == set(catalog.schema()["$defs"]["topic_id"]["enum"])
    assert set(ids) == {i["topic"] for i in catalog.indicators()}  # every topic used, none missing


@pytest.mark.parametrize("cohort", list(catalog.COHORT_CODES))
def test_sud_py_is_drug_or_alcohol_use_disorder(cohort):
    ind = indicator(cohort, "sud_py")
    assert ind["source"] == "UD5ILALANY"
    assert (ind["yes"], ind["no"]) == ([1], [0])
    assert not any(i["source"] == "UD5ILAALANY" for i in catalog.indicators())  # "both at once" recode


def test_difficulty_concentrating_uses_washington_group_cutoff():
    ind = indicator("teen", "difficulty_concentrating")
    assert ind["source"] == "LVLDIFMEM2"
    assert (ind["yes"], ind["no"]) == ([3], [1, 2])


@pytest.mark.parametrize("id", MENTAL_ILLNESS_INDICATORS)
def test_young_adult_mental_illness_topic(id):
    assert indicator("young_adult", id)["topic"] == "mental_illness"
    assert {t["id"]: t["label"] for t in topics()}["mental_illness"] == "Mental illness and distress"


@pytest.mark.parametrize("group", catalog.groups(), ids=lambda g: g["id"])
def test_group_level_ids_are_slugs_and_unique(group):
    ids = [level["id"] for level in group["levels"]]
    assert all(re.fullmatch(r"[a-z0-9_]+", i) for i in ids)
    assert len(set(ids)) == len(ids)
