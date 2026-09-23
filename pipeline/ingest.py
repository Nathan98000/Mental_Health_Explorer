"""Extract selected columns from the raw NSDUH tab-delimited file into Parquet.

Parsing all 2,638 columns is slow, so columns are selected *before* parsing:
`cut` when available (about 4 seconds for the full file), otherwise a streaming
Python fallback.
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
from pathlib import Path

import duckdb

from pipeline import config


def read_header(path: Path) -> list[str]:
    with path.open("r", encoding="latin-1", newline="") as f:
        return f.readline().rstrip("\r\n").split("\t")


def extract_columns(raw: Path, columns: list[str], out_tsv: Path) -> None:
    header = read_header(raw)
    missing = [c for c in columns if c not in header]
    if missing:
        raise KeyError(f"Columns not in file: {missing}")
    indexes = [header.index(c) + 1 for c in columns]  # 1-based for cut
    out_tsv.parent.mkdir(parents=True, exist_ok=True)
    if shutil.which("cut"):
        field_list = ",".join(str(i) for i in indexes)
        with out_tsv.open("wb") as out:
            cut = subprocess.Popen(["cut", "-f", field_list, str(raw)], stdout=subprocess.PIPE)
            assert cut.stdout is not None
            for chunk in iter(lambda: cut.stdout.read(1 << 20), b""):
                out.write(chunk.replace(b"\r", b""))
            if cut.wait() != 0:
                raise RuntimeError("cut failed")
        # cut keeps the file's column order; the Parquet step reorders by name.
    else:
        zero_based = [i - 1 for i in indexes]
        with raw.open("r", encoding="latin-1", newline="") as src, out_tsv.open("w", encoding="latin-1") as dst:
            for line in src:
                fields = line.rstrip("\r\n").split("\t")
                dst.write("\t".join(fields[i] for i in zero_based) + "\n")


def _sql_path(path: Path) -> str:
    return "'" + str(path).replace("'", "''") + "'"


def tsv_to_parquet(tsv: Path, parquet: Path, columns: list[str]) -> int:
    con = duckdb.connect()
    select = ", ".join(f'"{c}"' for c in columns)
    # COPY targets cannot be bound parameters, so paths are quoted literals.
    con.execute(
        f"""COPY (SELECT {select} FROM read_csv({_sql_path(tsv)}, delim='\t', header=true,
                  sample_size=-1, nullstr=''))
            TO {_sql_path(parquet)} (FORMAT parquet, COMPRESSION zstd)"""
    )
    return con.execute(f"SELECT count(*) FROM read_parquet({_sql_path(parquet)})").fetchone()[0]


def ingest(columns: list[str], name: str) -> Path:
    """Write pipeline/.cache/<name>.parquet with the design columns plus `columns`."""
    wanted = list(dict.fromkeys([*config.DESIGN_COLUMNS, *columns]))
    raw = config.raw_path()
    config.CACHE_DIR.mkdir(parents=True, exist_ok=True)
    tsv = config.CACHE_DIR / f"{name}.tsv"
    parquet = config.CACHE_DIR / f"{name}.parquet"
    extract_columns(raw, wanted, tsv)
    rows = tsv_to_parquet(tsv, parquet, wanted)
    tsv.unlink()
    print(f"Wrote {parquet} ({rows:,} rows, {len(wanted)} columns)")
    return parquet


def ingest_catalog() -> Path:
    """Write pipeline/.cache/catalog.parquet: every column the catalog references, the
    design columns, CATAG6/AGE3 and QUESTID2, for all rows (all ages)."""
    from pipeline import catalog

    return ingest(["QUESTID2", *catalog.referenced_columns()], "catalog")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog", action="store_true", help="extract the columns the catalog references (all rows)")
    parser.add_argument("--name", default="extract")
    parser.add_argument("columns", nargs="*")
    args = parser.parse_args()
    if args.catalog:
        if args.columns:
            parser.error("--catalog takes no column list")
        ingest_catalog()
    elif args.columns:
        ingest(args.columns, args.name)
    else:
        parser.error("give column names or --catalog")


if __name__ == "__main__":
    main()
