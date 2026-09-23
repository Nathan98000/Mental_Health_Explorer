"""Advanced-mode microdata: pipeline/.cache/microdata_12_25.parquet (git-ignored).

The harmonized columns only (design variables, survey year, cohort, group level ids and
1/0 indicator columns), no identifiers, sorted by cohort, year, stratum and PSU and
zstd-compressed. It stays out of the repo until SAMHSA confirms redistribution of the
recoded public use file rows is acceptable (phase 5).

    python -m pipeline.export_microdata
"""
from __future__ import annotations

import duckdb

from pipeline import config
from pipeline.harmonize import HARMONIZED_PATH

MICRODATA_PATH = config.CACHE_DIR / "microdata_12_25.parquet"
ORDER = ["cohort", config.YEAR, config.STRATUM, config.PSU]


def main() -> None:
    con = duckdb.connect()
    columns = [r[0] for r in con.execute("DESCRIBE SELECT * FROM read_parquet(?)", [str(HARMONIZED_PATH)]).fetchall()]
    assert "QUESTID2" not in columns
    select = ", ".join(f'"{c}"' for c in columns)
    con.execute(
        f"""COPY (SELECT {select} FROM read_parquet('{HARMONIZED_PATH}') ORDER BY {", ".join(ORDER)})
            TO '{MICRODATA_PATH}' (FORMAT parquet, COMPRESSION zstd)"""
    )
    rows = con.execute("SELECT count(*) FROM read_parquet(?)", [str(MICRODATA_PATH)]).fetchone()[0]
    print(f"Wrote {MICRODATA_PATH}: {rows:,} rows, {len(columns)} columns, {MICRODATA_PATH.stat().st_size / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
