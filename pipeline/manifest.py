"""data/manifest.json: every committed output with its size and SHA-256, plus the catalog
content hash, the pipeline git SHA and the generation date. Rewritten by every step that
writes outputs (cube, associations)."""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import subprocess

from pipeline import catalog, config

MANIFEST_PATH = config.OUTPUT_DIR / "manifest.json"
CATALOG_FILES = [catalog.INDICATORS_PATH, catalog.GROUPS_PATH, catalog.CATALOG_DIR / "topics.yaml"]


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def catalog_hash() -> str:
    h = hashlib.sha256()
    for path in CATALOG_FILES:
        h.update(path.name.encode())
        h.update(path.read_bytes())
    return h.hexdigest()


def git_sha() -> str | None:
    try:
        out = subprocess.run(["git", "rev-parse", "HEAD"], cwd=config.REPO_ROOT, capture_output=True, text=True, check=True)
    except (OSError, subprocess.CalledProcessError):
        return None
    return out.stdout.strip()


def output_files() -> list:
    paths = sorted(config.OUTPUT_DIR.glob("estimates/*/*.json")) + sorted(config.OUTPUT_DIR.glob("associations/*.json"))
    availability = config.OUTPUT_DIR / "availability.json"
    return ([availability] if availability.exists() else []) + paths


def build_manifest() -> dict:
    files = {}
    for path in output_files():
        data = path.read_bytes()
        files[path.relative_to(config.OUTPUT_DIR).as_posix()] = {"bytes": len(data), "sha256": sha256(data)}
    return {
        "generated": dt.date.today().isoformat(),
        "pipeline_sha": git_sha(),
        "catalog_hash": catalog_hash(),
        "files": files,
    }


def write_manifest() -> dict:
    manifest = build_manifest()
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=1, sort_keys=True) + "\n", encoding="utf-8")
    return manifest


if __name__ == "__main__":
    m = write_manifest()
    print(f"Wrote {MANIFEST_PATH} ({len(m['files'])} files)")
