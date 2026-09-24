"""The committed outputs in data/ conform to their JSON schemas (no survey data needed)."""
import json
from pathlib import Path

import jsonschema
import pytest

from pipeline import catalog, config

SCHEMA_DIR = config.OUTPUT_DIR / "schema"
ESTIMATES = sorted((config.OUTPUT_DIR / "estimates").glob("*/*.json"))
ASSOCIATIONS = sorted((config.OUTPUT_DIR / "associations").glob("*.json"))


def validator(name: str) -> jsonschema.Draft202012Validator:
    schema = json.loads((SCHEMA_DIR / name).read_text(encoding="utf-8"))
    jsonschema.Draft202012Validator.check_schema(schema)
    return jsonschema.Draft202012Validator(schema)


def launch_ids() -> set[tuple[str, str]]:
    return {(i["cohort"], i["id"]) for i in catalog.indicators() if i["status"] == "launch"}


def test_every_launch_indicator_has_a_shard():
    assert {(p.parent.name, p.stem) for p in ESTIMATES} == launch_ids()


@pytest.mark.parametrize("path", ESTIMATES, ids=lambda p: f"{p.parent.name}/{p.stem}")
def test_estimate_shard_matches_schema(path: Path):
    doc = json.loads(path.read_text(encoding="utf-8"))
    validator("estimates.schema.json").validate(doc)
    assert (doc["cohort"], doc["indicator"]) == (path.parent.name, path.stem)
    assert len({len(v) for v in doc["cells"].values()}) == 1
    assert path.stat().st_size <= 500_000


@pytest.mark.parametrize("path", ASSOCIATIONS, ids=lambda p: p.stem)
def test_associations_match_schema(path: Path):
    doc = json.loads(path.read_text(encoding="utf-8"))
    validator("associations.schema.json").validate(doc)
    assert doc["cohort"] == path.stem
    assert [p for p in doc["pairs"] if catalog.nested(p["outcome"], p["exposure"], doc["cohort"])] == []
    assert [m for m in doc["or_matrix"] if catalog.nested(m["a"], m["b"], doc["cohort"])] == []
    for m in doc["or_matrix"]:
        assert (m["precision_note"] is not None) == m["low_precision"]
        assert (m["estimate"] is None) == (m["reason"] is not None)


def test_manifest_lists_every_output_with_its_size():
    manifest = json.loads((config.OUTPUT_DIR / "manifest.json").read_text(encoding="utf-8"))
    listed = set(manifest["files"])
    on_disk = {p.relative_to(config.OUTPUT_DIR).as_posix() for p in [*ESTIMATES, *ASSOCIATIONS, config.OUTPUT_DIR / "availability.json"]}
    assert listed == on_disk
    for name, entry in manifest["files"].items():
        assert entry["bytes"] == (config.OUTPUT_DIR / name).stat().st_size
    assert len(manifest["catalog_hash"]) == 64


def test_web_catalog_matches_schema_and_is_current():
    from pipeline import export_catalog

    doc = json.loads(export_catalog.CATALOG_JSON.read_text(encoding="utf-8"))
    validator("catalog.schema.json").validate(doc)
    assert doc == export_catalog.build(), "data/catalog.json is stale: run python -m pipeline.export_catalog"
    topic_ids = {t["id"] for t in doc["topics"]}
    assert all(ind["topic"] in topic_ids for ind in doc["indicators"])
    for group in doc["groups"]:
        for level in group["levels"]:
            assert group["phrase"] is not None or level["phrase"] is not None, f"{group['id']}/{level['id']} has no population phrase"
