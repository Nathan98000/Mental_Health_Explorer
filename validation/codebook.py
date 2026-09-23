"""Parse the combined 2021-2024 PUF codebook into per-variable code frequencies.

Input is the text produced by `pdftotext -layout` (cached under pipeline/.cache/).
Each variable entry starts with a line like

    YMDEYR                      Len : 1 RC-YOUTH: PAST YEAR MAJOR DEPRESSIVE EPISODE (MDE)

followed by one line per code, `CODE = label ....... FREQ PCT`, where CODE is `.`
(blank in the file), `-9` or an integer; a long label may wrap onto a second line
before its FREQ. Footnote markers are printed as a trailing digit on the variable
name (`YUSUITHK1` is YUSUITHK with note 1), so lookups fall back to `name + digit`
only when that longer name is not itself a PUF column.
"""
from __future__ import annotations

import re
import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

ENTRY_RE = re.compile(r"^(?P<name>[A-Z][A-Z0-9_]*)\s+Len\s*:\s*\d+\s*(?P<label>.*)$")
VALUE_START_RE = re.compile(r"^\s+(?P<code>\.|-?\d+)\s*=\s*(?P<rest>.*)$")
VALUE_END_RE = re.compile(r"(?P<freq>\d+)\s+(?P<pct>\d+\.\d+)\s*$")


@dataclass
class Entry:
    name: str
    label: str
    freq: dict[str, int] = field(default_factory=dict)      # code -> unweighted count
    labels: dict[str, str] = field(default_factory=dict)    # code -> value label

    @property
    def total(self) -> int:
        return sum(self.freq.values())


def parse(text: str) -> list[Entry]:
    entries: list[Entry] = []
    current: Entry | None = None
    code: str | None = None
    parts: list[str] = []
    for line in text.splitlines():
        m = ENTRY_RE.match(line)
        if m:
            current = Entry(m["name"], m["label"].strip())
            entries.append(current)
            code = None
            continue
        if current is None:
            continue
        vm = VALUE_START_RE.match(line)
        if vm:
            code, parts = vm["code"], [vm["rest"]]
        elif code is not None and line.strip():
            parts.append(line.strip())
        else:
            continue
        joined = " ".join(parts)
        em = VALUE_END_RE.search(joined)
        if em:
            current.freq[code] = int(em["freq"])
            current.labels[code] = joined[: em.start()].rstrip(" .")
            code = None
    return entries


def index(entries: list[Entry]) -> dict[str, list[Entry]]:
    by_name: dict[str, list[Entry]] = {}
    for e in entries:
        by_name.setdefault(e.name, []).append(e)
    return by_name


def lookup(by_name: dict[str, list[Entry]], name: str, columns: set[str]) -> Entry:
    """The codebook entry for PUF column `name`, tolerating a footnote digit suffix."""
    candidates = by_name.get(name, [])
    if not candidates:
        for digit in "123456789":
            if name + digit not in columns:
                candidates += by_name.get(name + digit, [])
    if not candidates:
        raise KeyError(f"{name} not found in codebook")
    if len(candidates) > 1:
        raise KeyError(f"{name} has {len(candidates)} codebook entries")
    return candidates[0]


def extract_text(pdf: Path, cache: Path) -> str:
    """Return the codebook text, extracting it once with pdftotext (or pdfplumber)."""
    if cache.exists():
        return cache.read_text(encoding="utf-8")
    cache.parent.mkdir(parents=True, exist_ok=True)
    if shutil.which("pdftotext"):
        subprocess.run(["pdftotext", "-layout", str(pdf), str(cache)], check=True)
    else:
        import pdfplumber  # fallback; slower and layout is approximate

        with pdfplumber.open(str(pdf)) as doc:
            cache.write_text("\n".join((page.extract_text(layout=True) or "") for page in doc.pages), encoding="utf-8")
    return cache.read_text(encoding="utf-8")
