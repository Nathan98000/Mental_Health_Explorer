"""validation/fixtures/estimator.json equals the current Python estimator output (CI)."""
import json
import math

from pipeline import make_fixtures

TOL = 1e-12


def same(a, b, path="") -> list[str]:
    if isinstance(a, dict) and isinstance(b, dict):
        if a.keys() != b.keys():
            return [f"{path}: keys {sorted(a)} != {sorted(b)}"]
        return [m for k in a for m in same(a[k], b[k], f"{path}.{k}")]
    if isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            return [f"{path}: length {len(a)} != {len(b)}"]
        return [m for i, (x, y) in enumerate(zip(a, b)) for m in same(x, y, f"{path}[{i}]")]
    if isinstance(a, float) or isinstance(b, float):
        if isinstance(a, bool) or isinstance(b, bool) or a is None or b is None:
            return [] if a == b else [f"{path}: {a!r} != {b!r}"]
        return [] if math.isclose(a, b, rel_tol=0, abs_tol=TOL) else [f"{path}: {a!r} != {b!r}"]
    return [] if a == b else [f"{path}: {a!r} != {b!r}"]


def test_fixture_file_matches_current_output():
    committed = json.loads(make_fixtures.FIXTURE_PATH.read_text(encoding="utf-8"))
    assert same(make_fixtures.build(), committed) == []


def test_fixture_covers_every_kind_and_suppression_reason():
    doc = json.loads(make_fixtures.FIXTURE_PATH.read_text(encoding="utf-8"))
    kinds = {c["kind"] for c in doc["cases"]}
    reasons = {c["expected"]["reason"] for c in doc["cases"] if c["kind"] == "proportion"}
    assert kinds == {"proportion", "difference"}
    assert reasons == {None, "fewer than 50 respondents", "estimate is 0% or 100%", "estimate is too imprecise", "no respondents"}
    assert len(doc["cases"]) >= 20
