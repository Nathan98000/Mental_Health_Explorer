"""Write data/catalog.json: the parts of the catalog the website needs (launch indicators,
groups with their population phrases, topics and cohorts). Committed and validated in CI
against data/schema/catalog.schema.json; python -m pipeline.export_catalog rewrites it."""
from __future__ import annotations

import json

import yaml

from pipeline import catalog, config

CATALOG_JSON = config.OUTPUT_DIR / "catalog.json"
TOPICS_PATH = catalog.CATALOG_DIR / "topics.yaml"

COHORTS = [
    {"id": "teen", "label": "Teens", "phrase": catalog.COHORT_LABELS["teen"], "people": "teens", "ages": "12–17"},
    {"id": "young_adult", "label": "Young adults", "phrase": catalog.COHORT_LABELS["young_adult"], "people": "young adults", "ages": "18–25"},
]

INDICATOR_FIELDS = ["id", "cohort", "topic", "label", "phrase", "universe_phrase", "definition", "source", "years", "caveats", "status"]


def topics() -> list[dict]:
    return list(catalog.load(TOPICS_PATH)["topics"])


def export_group(group: dict) -> dict:
    return {
        "id": group["id"],
        "label": group["label"],
        "cohorts": list(group["cohorts"]),
        "crosses_only": bool(group.get("crosses_only", False)),
        "phrase": group.get("phrase"),
        "levels": [{"id": level["id"], "label": level["label"], "phrase": level.get("phrase")} for level in group["levels"]],
    }


def build() -> dict:
    return {
        "cohorts": COHORTS,
        "topics": topics(),
        "groups": [export_group(g) for g in catalog.groups()],
        # universe_phrase is optional in the yaml (null = the whole cohort); every other field is required there.
        "indicators": [{k: ind.get(k) for k in INDICATOR_FIELDS} for ind in catalog.indicators() if ind["status"] == "launch"],
    }


def write() -> dict:
    doc = build()
    CATALOG_JSON.write_text(json.dumps(doc, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    return doc


if __name__ == "__main__":
    doc = write()
    print(f"Wrote {CATALOG_JSON}: {len(doc['indicators'])} launch indicators, {len(doc['groups'])} groups, {len(doc['topics'])} topics")
