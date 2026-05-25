# Federal AI Policy Section — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new top-level `/policy` section in the dashboard that surfaces the federal AI policy tracker (compliance scorecard + pages-by-agency chart + document directory + governing-documents block), plus a cross-link subsection on every `/agencies/[slug]` page.

**Architecture:** ETL loads the existing `audit/research/ai_strategies/{documents,coverage}.csv` files into two new SQLite tables; the dashboard reads them through a new `lib/db/policy.ts` query module and a view-model, rendering one server-side page composed of private `_sections/`.

**Tech Stack:** Python 3 + sqlite3 (ETL); Next.js 16 App Router, TypeScript, better-sqlite3, TanStack Table, Recharts, Tailwind v4, Vitest (dashboard).

**Spec:** `dashboard/docs/superpowers/specs/2026-05-25-ai-policy-section-design.md`

**Two repos involved:**
- ETL workspace: `/Users/michaelboyce/Documents/Programming/ifp/ai-use-case-inventory/2025-aia-use-case-inventory/` (paths in Phase 1 are relative to here)
- Dashboard (separate repo): `dashboard/` (paths in Phase 2+ are relative to here)

**File map**

ETL repo (`2025-aia-use-case-inventory/`):
- Create `migrations/m012_ai_policy_tracker.py` — schema for two tables.
- Create `scripts/load_ai_policy_tracker.py` — CSV → SQLite loader (idempotent wipe-and-reload).
- Create `tests/test_migration_m012_ai_policy_tracker.py`.
- Create `tests/test_load_ai_policy_tracker.py`.
- Modify `Makefile` — wire loader into `fix` chain.

Dashboard repo (`dashboard/`):
- Update `data/federal_ai_inventory_2025.db` (synced from ETL).
- Update `tests/fixtures/schema.sql` (regenerated from new DB).
- Update `tests/fixtures/seed.sql` (add a handful of policy rows for query tests).
- Create `lib/types/policy.ts` — TS types.
- Create `lib/db/policy.ts` — query functions.
- Create `tests/lib/db/policy.test.ts` — query tests.
- Create `app/policy/page.tsx` — page (server component).
- Create `app/policy/_view-model.ts` — view-model.
- Create `app/policy/_sections/compliance-scorecard.tsx`.
- Create `app/policy/_sections/pages-by-agency-chart.tsx`.
- Create `app/policy/_sections/document-directory.tsx`.
- Create `app/policy/_sections/governing-docs-block.tsx`.
- Create `components/agency/agency-policy-documents.tsx` — cross-link subsection.
- Modify `components/navigation.tsx` — add "Policy" to `PRIMARY` (kicker `VI`).
- Modify `app/agencies/[slug]/page.tsx` — render the new subsection.

**Files NOT to touch** (unrelated WIP in the dashboard repo as of 2026-05-25): `app/use-cases/page.tsx`, `components/use-case/filters/index.tsx`.

---

## Phase 1 — ETL: data into the DB

### Task 1: Migration m012 — schema for the two tables

**Working dir:** `2025-aia-use-case-inventory/`

**Files:**
- Create: `migrations/m012_ai_policy_tracker.py`
- Test: `tests/test_migration_m012_ai_policy_tracker.py`

- [ ] **Step 1: Write the failing test**

Create `tests/test_migration_m012_ai_policy_tracker.py`:

```python
"""Tests for migrations/m012_ai_policy_tracker.py — creates the two
agency_ai_policy_* tables and their indexes. Idempotent."""
import sqlite3

from migrations import m012_ai_policy_tracker as m012


def _conn():
    c = sqlite3.connect(":memory:")
    c.row_factory = sqlite3.Row
    return c


def _columns(conn: sqlite3.Connection, table: str) -> list[str]:
    return [r["name"] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()]


def _indexes(conn: sqlite3.Connection, table: str) -> list[str]:
    return [r["name"] for r in conn.execute(f"PRAGMA index_list({table})").fetchall()]


def test_creates_agency_ai_policy_documents_with_expected_columns():
    conn = _conn()
    m012.apply(conn)
    cols = _columns(conn, "agency_ai_policy_documents")
    assert "id" in cols
    assert "agency_abbr" in cols
    assert "agency_name" in cols
    assert "agency_type" in cols
    assert "issuing_office" in cols
    assert "document_type" in cols
    assert "document_title" in cols
    assert "publication_year" in cols
    assert "publication_date" in cols
    assert "pages" in cols
    assert "issuing_memo" in cols
    assert "superseded" in cols
    assert "is_public" in cols
    assert "url" in cols
    assert "local_path" in cols
    assert "access_status" in cols
    assert "date_accessed" in cols
    assert "notes" in cols


def test_creates_agency_ai_policy_compliance_with_expected_columns():
    conn = _conn()
    m012.apply(conn)
    cols = _columns(conn, "agency_ai_policy_compliance")
    assert "agency_abbr" in cols
    assert "agency_name" in cols
    assert "agency_type" in cols
    assert "searched" in cols
    assert "date_searched" in cols
    assert "ai_landing_page_url" in cols
    assert "ai_strategy_year" in cols
    assert "compliance_plan_year" in cols
    assert "genai_policy_year" in cols
    assert "caio_status" in cols
    assert "other_policy_count" in cols
    assert "total_documents" in cols
    assert "gaps" in cols
    assert "notes" in cols


def test_creates_expected_indexes_on_documents():
    conn = _conn()
    m012.apply(conn)
    idx = _indexes(conn, "agency_ai_policy_documents")
    # Indexes generated by CREATE INDEX (not auto-indexes from PK) start with
    # 'idx_'.
    expected = {
        "idx_agency_ai_policy_documents_agency_abbr",
        "idx_agency_ai_policy_documents_agency_type",
        "idx_agency_ai_policy_documents_document_type",
        "idx_agency_ai_policy_documents_publication_year",
    }
    assert expected.issubset(set(idx))


def test_compliance_table_has_agency_abbr_as_primary_key():
    conn = _conn()
    m012.apply(conn)
    rows = conn.execute("PRAGMA table_info(agency_ai_policy_compliance)").fetchall()
    pk_col = next(r["name"] for r in rows if r["pk"] == 1)
    assert pk_col == "agency_abbr"


def test_apply_is_idempotent():
    conn = _conn()
    m012.apply(conn)
    m012.apply(conn)  # second run must not raise
    cols = _columns(conn, "agency_ai_policy_documents")
    assert "id" in cols
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /Users/michaelboyce/Documents/Programming/ifp/ai-use-case-inventory/2025-aia-use-case-inventory
pytest tests/test_migration_m012_ai_policy_tracker.py -v
```
Expected: FAIL with `ModuleNotFoundError: No module named 'migrations.m012_ai_policy_tracker'`.

- [ ] **Step 3: Write the migration**

Create `migrations/m012_ai_policy_tracker.py`:

```python
"""Add `agency_ai_policy_documents` and `agency_ai_policy_compliance` —
the two tables behind the dashboard's `/policy` section.

`agency_ai_policy_documents` is one row per published federal AI policy
document (agency-issued strategies / compliance plans / genAI policies /
governance charters / etc., plus the foundational executive orders and OMB
memoranda tagged `agency_type='White House / OMB'`). Columns mirror the
research tracker's `audit/research/ai_strategies/documents.csv`.

`agency_ai_policy_compliance` is one row per agency searched, capturing
search status + per-artifact years (M-25-21 AI Strategy, compliance plan,
genAI policy) + CAIO status. Columns mirror `coverage.csv`.

Both tables are idempotent (DDL guarded by existence checks) and intended to
be truncated-and-reloaded by `scripts/load_ai_policy_tracker.py`. There are
no foreign keys to `agencies` because the tracker covers two synthetic
"agencies" (EOP, OMB) that don't appear in the agencies table.
"""
from __future__ import annotations

import sqlite3

MIGRATION_ID = "012_ai_policy_tracker"


def _table_exists(conn: sqlite3.Connection, table: str) -> bool:
    return (
        conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            (table,),
        ).fetchone()
        is not None
    )


def _index_exists(conn: sqlite3.Connection, name: str) -> bool:
    return (
        conn.execute(
            "SELECT name FROM sqlite_master WHERE type='index' AND name=?",
            (name,),
        ).fetchone()
        is not None
    )


def apply(conn: sqlite3.Connection) -> None:
    if not _table_exists(conn, "agency_ai_policy_documents"):
        conn.execute(
            """
            CREATE TABLE agency_ai_policy_documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agency_abbr TEXT NOT NULL,
                agency_name TEXT NOT NULL,
                agency_type TEXT NOT NULL,
                issuing_office TEXT,
                document_type TEXT NOT NULL,
                document_title TEXT NOT NULL,
                publication_year INTEGER NOT NULL,
                publication_date TEXT,
                pages INTEGER,
                issuing_memo TEXT,
                superseded INTEGER NOT NULL DEFAULT 0,
                is_public INTEGER NOT NULL DEFAULT 1,
                url TEXT NOT NULL,
                local_path TEXT,
                access_status TEXT NOT NULL,
                date_accessed TEXT NOT NULL,
                notes TEXT
            )
            """
        )

    for col, ddl_idx in (
        ("agency_abbr", "idx_agency_ai_policy_documents_agency_abbr"),
        ("agency_type", "idx_agency_ai_policy_documents_agency_type"),
        ("document_type", "idx_agency_ai_policy_documents_document_type"),
        ("publication_year", "idx_agency_ai_policy_documents_publication_year"),
    ):
        if not _index_exists(conn, ddl_idx):
            conn.execute(
                f"CREATE INDEX {ddl_idx} ON agency_ai_policy_documents ({col})"
            )

    if not _table_exists(conn, "agency_ai_policy_compliance"):
        conn.execute(
            """
            CREATE TABLE agency_ai_policy_compliance (
                agency_abbr TEXT PRIMARY KEY,
                agency_name TEXT NOT NULL,
                agency_type TEXT NOT NULL,
                searched INTEGER NOT NULL DEFAULT 1,
                date_searched TEXT NOT NULL,
                ai_landing_page_url TEXT,
                ai_strategy_year INTEGER,
                compliance_plan_year INTEGER,
                genai_policy_year INTEGER,
                caio_status TEXT,
                other_policy_count INTEGER NOT NULL DEFAULT 0,
                total_documents INTEGER NOT NULL DEFAULT 0,
                gaps TEXT,
                notes TEXT
            )
            """
        )

    conn.commit()
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pytest tests/test_migration_m012_ai_policy_tracker.py -v
```
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add migrations/m012_ai_policy_tracker.py tests/test_migration_m012_ai_policy_tracker.py
git commit -m "feat(db): m012 add agency_ai_policy_{documents,compliance} tables"
```

---

### Task 2: Loader script that reads the CSVs into the new tables

**Working dir:** `2025-aia-use-case-inventory/`

**Files:**
- Create: `scripts/load_ai_policy_tracker.py`
- Test: `tests/test_load_ai_policy_tracker.py`

- [ ] **Step 1: Write the failing test**

Create `tests/test_load_ai_policy_tracker.py`:

```python
"""Tests for scripts/load_ai_policy_tracker.py — reads
audit/research/ai_strategies/{documents,coverage}.csv into the two
agency_ai_policy_* tables. Idempotent wipe-and-reload."""
import sqlite3
import textwrap
from pathlib import Path

from migrations import m012_ai_policy_tracker as m012
from scripts import load_ai_policy_tracker as loader


def _conn():
    c = sqlite3.connect(":memory:")
    c.row_factory = sqlite3.Row
    m012.apply(c)
    return c


def _write_csvs(tmp: Path, docs_csv: str, cov_csv: str) -> Path:
    d = tmp / "ai_strategies"
    d.mkdir()
    (d / "documents.csv").write_text(textwrap.dedent(docs_csv))
    (d / "coverage.csv").write_text(textwrap.dedent(cov_csv))
    return d


DOCS_HEADER = (
    "agency_abbr,agency_name,agency_type,issuing_office,document_type,"
    "document_title,publication_year,publication_date,pages,issuing_memo,"
    "superseded,is_public,url,local_path,access_status,date_accessed,notes\n"
)
COV_HEADER = (
    "agency_abbr,agency_name,agency_type,searched,date_searched,"
    "ai_landing_page_url,ai_strategy_year,compliance_plan_year,"
    "genai_policy_year,caio_status,other_policy_count,total_documents,"
    "gaps,notes\n"
)


def test_loads_documents_and_coverage_row_counts(tmp_path):
    base = _write_csvs(
        tmp_path,
        DOCS_HEADER
        + "DHS,Department of Homeland Security,Cabinet,DHS OCIO,M-25-21 AI Strategy,DHS AI Strategy,2025,2025-09-26,10,M-25-21,no,yes,https://example.gov/dhs.pdf,documents/DHS/x.pdf,Downloaded,2026-05-21,\n"
        + "DHS,Department of Homeland Security,Cabinet,DHS OCIO,M-25-21 Compliance Plan,DHS Plan,2025,2025-09-26,12,M-25-21,no,yes,https://example.gov/dhs-plan.pdf,documents/DHS/y.pdf,Downloaded,2026-05-21,\n",
        COV_HEADER
        + "DHS,Department of Homeland Security,Cabinet,yes,2026-05-21,https://www.dhs.gov/ai,2025,2025,,Designated,2,2,,\n",
    )
    conn = _conn()
    loader.load(conn, base)
    assert conn.execute(
        "SELECT COUNT(*) FROM agency_ai_policy_documents"
    ).fetchone()[0] == 2
    assert conn.execute(
        "SELECT COUNT(*) FROM agency_ai_policy_compliance"
    ).fetchone()[0] == 1


def test_loader_coerces_year_and_pages_to_int(tmp_path):
    base = _write_csvs(
        tmp_path,
        DOCS_HEADER
        + "VA,Department of Veterans Affairs,Cabinet,VA OIT,M-25-21 AI Strategy,Building the Future,2026,,,M-25-21,no,yes,https://va.gov/x,,Link only,2026-05-21,\n",
        COV_HEADER
        + "VA,Department of Veterans Affairs,Cabinet,yes,2026-05-21,https://va.gov/ai,2026,,,Designated,0,1,,\n",
    )
    conn = _conn()
    loader.load(conn, base)
    row = conn.execute(
        "SELECT publication_year, pages FROM agency_ai_policy_documents"
    ).fetchone()
    assert row["publication_year"] == 2026
    assert row["pages"] is None  # blank pages stays NULL, not 0


def test_loader_coerces_boolean_flags(tmp_path):
    base = _write_csvs(
        tmp_path,
        DOCS_HEADER
        + "DOJ,Department of Justice,Cabinet,DOJ,M-24-10 Compliance Plan,DOJ Plan,2024,2024-10-01,11,M-24-10,yes,yes,https://justice.gov/x,documents/DOJ/x.pdf,Downloaded,2026-05-21,\n",
        COV_HEADER
        + "DOJ,Department of Justice,Cabinet,yes,2026-05-21,https://justice.gov/ai,,2024,,Designated,1,2,No M-25-21 strategy,\n",
    )
    conn = _conn()
    loader.load(conn, base)
    row = conn.execute(
        "SELECT superseded, is_public FROM agency_ai_policy_documents"
    ).fetchone()
    assert row["superseded"] == 1
    assert row["is_public"] == 1


def test_loader_is_idempotent(tmp_path):
    base = _write_csvs(
        tmp_path,
        DOCS_HEADER
        + "OPM,Office of Personnel Management,Independent,OPM,M-25-21 AI Strategy,OPM Strategy,2025,2025-09-30,7,M-25-21,no,yes,https://opm.gov/x.pdf,documents/OPM/x.pdf,Downloaded,2026-05-21,\n",
        COV_HEADER
        + "OPM,Office of Personnel Management,Independent,yes,2026-05-21,https://opm.gov/ai,2025,2025,,Designated,0,2,,\n",
    )
    conn = _conn()
    loader.load(conn, base)
    loader.load(conn, base)
    assert conn.execute(
        "SELECT COUNT(*) FROM agency_ai_policy_documents"
    ).fetchone()[0] == 1
    assert conn.execute(
        "SELECT COUNT(*) FROM agency_ai_policy_compliance"
    ).fetchone()[0] == 1
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pytest tests/test_load_ai_policy_tracker.py -v
```
Expected: FAIL — `ModuleNotFoundError: No module named 'scripts.load_ai_policy_tracker'`.

- [ ] **Step 3: Write the loader**

Create `scripts/load_ai_policy_tracker.py`:

```python
"""Load `audit/research/ai_strategies/{documents,coverage}.csv` into the two
`agency_ai_policy_*` tables (created by migration m012). Idempotent
wipe-and-reload: both tables are TRUNCATEd before each run.

Usage:
    python3 scripts/load_ai_policy_tracker.py            # defaults to repo paths
    python3 scripts/load_ai_policy_tracker.py --check    # dry-run, prints counts

Wired into the Makefile `fix` chain after `scripts/run_migrations.py`.
"""
from __future__ import annotations

import argparse
import csv
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CSV_DIR = ROOT / "audit" / "research" / "ai_strategies"
DEFAULT_DB = ROOT / "data" / "federal_ai_inventory_2025.db"


def _to_int(v: str) -> int | None:
    v = (v or "").strip()
    if not v:
        return None
    try:
        return int(v)
    except ValueError:
        return None


def _to_bool(v: str) -> int:
    return 1 if (v or "").strip().lower() == "yes" else 0


def _opt(v: str) -> str | None:
    v = (v or "").strip()
    return v if v else None


def load(conn: sqlite3.Connection, csv_dir: Path = DEFAULT_CSV_DIR) -> tuple[int, int]:
    """Truncate-and-reload both tables. Returns (n_documents, n_compliance)."""
    docs_path = csv_dir / "documents.csv"
    cov_path = csv_dir / "coverage.csv"
    if not docs_path.exists():
        raise FileNotFoundError(docs_path)
    if not cov_path.exists():
        raise FileNotFoundError(cov_path)

    conn.execute("DELETE FROM agency_ai_policy_documents")
    conn.execute("DELETE FROM agency_ai_policy_compliance")

    n_docs = 0
    with docs_path.open(newline="") as f:
        for row in csv.DictReader(f):
            year = _to_int(row["publication_year"])
            if year is None:
                # The tracker invariant is "every row has publication_year";
                # treat a violation as a hard error so loader runs surface it.
                raise ValueError(
                    f"documents.csv row missing publication_year: {row['document_title']!r}"
                )
            conn.execute(
                """
                INSERT INTO agency_ai_policy_documents (
                    agency_abbr, agency_name, agency_type, issuing_office,
                    document_type, document_title, publication_year,
                    publication_date, pages, issuing_memo, superseded,
                    is_public, url, local_path, access_status, date_accessed,
                    notes
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    row["agency_abbr"].strip(),
                    row["agency_name"].strip(),
                    row["agency_type"].strip(),
                    _opt(row.get("issuing_office", "")),
                    row["document_type"].strip(),
                    row["document_title"].strip(),
                    year,
                    _opt(row.get("publication_date", "")),
                    _to_int(row.get("pages", "")),
                    _opt(row.get("issuing_memo", "")),
                    _to_bool(row.get("superseded", "")),
                    _to_bool(row.get("is_public", "yes")),
                    row["url"].strip(),
                    _opt(row.get("local_path", "")),
                    row["access_status"].strip(),
                    row["date_accessed"].strip(),
                    _opt(row.get("notes", "")),
                ),
            )
            n_docs += 1

    n_cov = 0
    with cov_path.open(newline="") as f:
        for row in csv.DictReader(f):
            conn.execute(
                """
                INSERT INTO agency_ai_policy_compliance (
                    agency_abbr, agency_name, agency_type, searched,
                    date_searched, ai_landing_page_url, ai_strategy_year,
                    compliance_plan_year, genai_policy_year, caio_status,
                    other_policy_count, total_documents, gaps, notes
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    row["agency_abbr"].strip(),
                    row["agency_name"].strip(),
                    row["agency_type"].strip(),
                    _to_bool(row.get("searched", "yes")),
                    row["date_searched"].strip(),
                    _opt(row.get("ai_landing_page_url", "")),
                    _to_int(row.get("ai_strategy_year", "")),
                    _to_int(row.get("compliance_plan_year", "")),
                    _to_int(row.get("genai_policy_year", "")),
                    _opt(row.get("caio_status", "")),
                    _to_int(row.get("other_policy_count", "0")) or 0,
                    _to_int(row.get("total_documents", "0")) or 0,
                    _opt(row.get("gaps", "")),
                    _opt(row.get("notes", "")),
                ),
            )
            n_cov += 1

    conn.commit()
    return n_docs, n_cov


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--db", type=Path, default=DEFAULT_DB)
    ap.add_argument("--csv-dir", type=Path, default=DEFAULT_CSV_DIR)
    ap.add_argument("--check", action="store_true", help="dry-run; rollback")
    args = ap.parse_args()

    conn = sqlite3.connect(args.db)
    conn.row_factory = sqlite3.Row
    try:
        n_docs, n_cov = load(conn, args.csv_dir)
        if args.check:
            conn.rollback()
            print(f"[check] would load {n_docs} documents, {n_cov} agencies")
        else:
            print(f"loaded {n_docs} documents, {n_cov} agencies")
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pytest tests/test_load_ai_policy_tracker.py -v
```
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add scripts/load_ai_policy_tracker.py tests/test_load_ai_policy_tracker.py
git commit -m "feat(etl): load_ai_policy_tracker — CSV→DB loader"
```

---

### Task 3: Wire the loader into `make fix`

**Working dir:** `2025-aia-use-case-inventory/`

**Files:**
- Modify: `Makefile`

- [ ] **Step 1: Edit the Makefile**

Open `Makefile` and find the existing line `python3 scripts/run_migrations.py`. Add the loader call immediately after it (so migrations run first, then the loader inserts into the newly-created tables). Find:

```makefile
	python3 scripts/run_migrations.py
	python3 scripts/seed_federal_hierarchy.py
```

Replace with:

```makefile
	python3 scripts/run_migrations.py
	# Load the federal AI policy/strategy tracker (CSVs at
	# audit/research/ai_strategies/) into agency_ai_policy_{documents,
	# compliance} (tables created by migration m012). Idempotent
	# wipe-and-reload. Feeds the dashboard's /policy section.
	python3 scripts/load_ai_policy_tracker.py
	python3 scripts/seed_federal_hierarchy.py
```

- [ ] **Step 2: Verify Makefile syntax**

```bash
make -n fix | grep -A0 load_ai_policy_tracker
```
Expected: prints the `python3 scripts/load_ai_policy_tracker.py` line.

- [ ] **Step 3: Commit**

```bash
git add Makefile
git commit -m "build: wire load_ai_policy_tracker into make fix"
```

---

### Task 4: Run `make fix`; sync the rebuilt DB into the dashboard repo

**Working dir:** `2025-aia-use-case-inventory/`

**Files:**
- Run: `make fix`
- Modify: `dashboard/data/federal_ai_inventory_2025.db` (binary; tracked per dashboard .gitignore `!data/federal_ai_inventory_2025.db`)

- [ ] **Step 1: Rebuild the DB**

```bash
cd /Users/michaelboyce/Documents/Programming/ifp/ai-use-case-inventory/2025-aia-use-case-inventory
make fix
```
Expected: completes without error; loader line prints `loaded N documents, M agencies` (currently 103 documents and 45 agencies in `audit/research/ai_strategies/`).

- [ ] **Step 2: Verify the new tables populated**

```bash
sqlite3 data/federal_ai_inventory_2025.db <<'SQL'
SELECT 'documents', COUNT(*) FROM agency_ai_policy_documents
UNION ALL SELECT 'compliance', COUNT(*) FROM agency_ai_policy_compliance
UNION ALL SELECT 'agency_types', COUNT(DISTINCT agency_type) FROM agency_ai_policy_documents
UNION ALL SELECT 'pages_sum', COALESCE(SUM(pages),0) FROM agency_ai_policy_documents WHERE agency_type != 'White House / OMB';
SQL
```
Expected (current snapshot): `documents=103`, `compliance=45`, `agency_types=3` (Cabinet / Independent / White House / OMB), `pages_sum=1171`.

- [ ] **Step 3: Run the ETL test suite to make sure nothing regressed**

```bash
pytest tests/ -q
```
Expected: previous count + the 9 new tests, all pass.

- [ ] **Step 4: Sync the DB into the dashboard repo**

```bash
cp data/federal_ai_inventory_2025.db dashboard/data/federal_ai_inventory_2025.db
```

- [ ] **Step 5: Commit (ETL repo) — Makefile run already committed; nothing else changed in the ETL repo here**

(No ETL commit needed at this step; the DB is regenerated, not tracked in the ETL repo.)

---

### Task 5: Regenerate dashboard test fixture schema + seed; commit DB

**Working dir:** `2025-aia-use-case-inventory/dashboard/`

**Files:**
- Modify: `data/federal_ai_inventory_2025.db` (tracked binary)
- Modify: `tests/fixtures/schema.sql`
- Modify: `tests/fixtures/seed.sql`

- [ ] **Step 1: Regenerate the schema fixture from the new DB**

```bash
cd /Users/michaelboyce/Documents/Programming/ifp/ai-use-case-inventory/2025-aia-use-case-inventory/dashboard
sqlite3 data/federal_ai_inventory_2025.db .schema > tests/fixtures/schema.sql
```

- [ ] **Step 2: Verify the new tables are in the regenerated schema**

```bash
grep -E 'agency_ai_policy_(documents|compliance)' tests/fixtures/schema.sql | head
```
Expected: lines for both CREATE TABLEs and 4 CREATE INDEX statements.

- [ ] **Step 3: Add minimal policy rows to the seed fixture**

Append the following to `tests/fixtures/seed.sql` (placed after the existing `agencies` seed so the abbreviations exist):

```sql
-- Federal AI policy tracker — minimal seed for /policy query tests.
-- Three agency rows (Cabinet x2, Independent x1) + the two governing-document
-- groups (EOP, OMB). Years span 2024–2026 to exercise filtering.

INSERT INTO agency_ai_policy_compliance
  (agency_abbr, agency_name, agency_type, searched, date_searched,
   ai_landing_page_url, ai_strategy_year, compliance_plan_year,
   genai_policy_year, caio_status, other_policy_count, total_documents,
   gaps, notes)
VALUES
  ('DHS','Department of Homeland Security','Cabinet',1,'2026-05-21',
    'https://www.dhs.gov/ai',2025,2025,NULL,'Designated',2,4,NULL,NULL),
  ('DOJ','Department of Justice','Cabinet',1,'2026-05-21',
    'https://www.justice.gov/ai',NULL,2024,NULL,'Designated',1,2,
    'No public M-25-21 strategy',NULL),
  ('NSF','National Science Foundation','Independent',1,'2026-05-21',
    'https://www.nsf.gov/policies/ai',2025,2025,NULL,'Named: Thu Williams',0,2,NULL,NULL);

INSERT INTO agency_ai_policy_documents
  (agency_abbr, agency_name, agency_type, issuing_office, document_type,
   document_title, publication_year, publication_date, pages, issuing_memo,
   superseded, is_public, url, local_path, access_status, date_accessed, notes)
VALUES
  ('DHS','Department of Homeland Security','Cabinet','DHS OCIO',
    'M-25-21 AI Strategy','DHS AI Strategy',2025,'2025-09-26',10,'M-25-21',
    0,1,'https://example.gov/dhs-strategy.pdf',NULL,'Downloaded','2026-05-21',NULL),
  ('DHS','Department of Homeland Security','Cabinet','DHS OCIO',
    'M-25-21 Compliance Plan','DHS Compliance Plan',2025,'2025-09-26',12,'M-25-21',
    0,1,'https://example.gov/dhs-plan.pdf',NULL,'Downloaded','2026-05-21',NULL),
  ('DOJ','Department of Justice','Cabinet','DOJ',
    'M-24-10 Compliance Plan','DOJ M-24-10 Compliance Plan',2024,'2024-10-01',11,'M-24-10',
    1,1,'https://justice.gov/plan.pdf',NULL,'Downloaded','2026-05-21',NULL),
  ('NSF','National Science Foundation','Independent','NSF',
    'M-25-21 AI Strategy','NSF AI Strategy',2025,'2025-09-30',22,'M-25-21',
    0,1,'https://nsf.gov/strategy.pdf',NULL,'Downloaded','2026-05-21',NULL),
  ('NSF','National Science Foundation','Independent','NSF',
    'M-25-21 Compliance Plan','NSF Compliance Plan',2025,'2025-09-30',7,'M-25-21',
    0,1,'https://nsf.gov/plan.pdf',NULL,'Downloaded','2026-05-21',NULL),
  ('EOP','Executive Office of the President','White House / OMB','The White House',
    'Executive Order','EO 14179: Removing Barriers to American Leadership in AI',
    2025,'2025-01-23',2,NULL,0,1,'https://www.govinfo.gov/eo14179.pdf',NULL,
    'Downloaded','2026-05-21',NULL),
  ('OMB','Office of Management and Budget','White House / OMB','OMB',
    'OMB Memorandum','OMB M-25-21: Accelerating Federal Use of AI',
    2025,'2025-04-03',25,NULL,0,1,'https://www.whitehouse.gov/M-25-21.pdf',NULL,
    'Downloaded','2026-05-21',NULL);
```

- [ ] **Step 4: Verify the dashboard test suite still passes against the new fixture**

```bash
npm test
```
Expected: all existing tests still pass (no policy tests yet; they come in Task 7).

- [ ] **Step 5: Commit**

```bash
git add data/federal_ai_inventory_2025.db tests/fixtures/schema.sql tests/fixtures/seed.sql
git commit -m "data(policy): sync DB with m012 + ai_policy_tracker; update test fixtures"
```

---

## Phase 2 — Dashboard data layer

### Task 6: TypeScript types for policy rows

**Working dir:** `2025-aia-use-case-inventory/dashboard/`

**Files:**
- Create: `lib/types/policy.ts`

- [ ] **Step 1: Create the types module**

```typescript
// lib/types/policy.ts
//
// Types backing the dashboard's /policy section. Mirror the columns of
// `agency_ai_policy_documents` and `agency_ai_policy_compliance`, with
// SQLite booleans (0/1) normalized to TypeScript booleans by the query layer.

export type AgencyType = "Cabinet" | "Independent" | "White House / OMB";

export type AccessStatus =
  | "Downloaded"
  | "Link only"
  | "Not public"
  | "Not found";

export type IssuingMemo =
  | "M-24-10"
  | "M-25-21"
  | "M-25-22"
  | "EO"
  | null;

/** A single published AI policy document. */
export interface PolicyDocument {
  id: number;
  agency_abbr: string;
  agency_name: string;
  agency_type: AgencyType;
  issuing_office: string | null;
  document_type: string;
  document_title: string;
  publication_year: number;
  publication_date: string | null; // YYYY-MM-DD
  pages: number | null;
  issuing_memo: IssuingMemo;
  superseded: boolean;
  is_public: boolean;
  url: string;
  local_path: string | null;
  access_status: AccessStatus;
  date_accessed: string;
  notes: string | null;
}

/** Per-agency M-25-21 compliance summary. */
export interface AgencyCompliance {
  agency_abbr: string;
  agency_name: string;
  agency_type: Exclude<AgencyType, "White House / OMB">;
  searched: boolean;
  date_searched: string;
  ai_landing_page_url: string | null;
  ai_strategy_year: number | null;
  compliance_plan_year: number | null;
  genai_policy_year: number | null;
  caio_status: string | null;
  other_policy_count: number;
  total_documents: number;
  gaps: string | null;
  notes: string | null;
}

/** Aggregate counts shown in the /policy header strip. */
export interface PolicyStats {
  total_pages: number;        // agency docs only — excludes White House / OMB
  total_documents: number;    // agency docs only
  total_agencies: number;     // distinct agencies searched (45)
  strategies_published: number; // agencies with a M-25-21 AI Strategy doc
  plans_published: number;      // agencies with a M-25-21 Compliance Plan doc
  last_refreshed: string;       // MAX(date_searched) from compliance table
}

/** Per-agency total pages, for the horizontal bar chart. */
export interface AgencyPolicyPages {
  agency_abbr: string;
  agency_name: string;
  agency_type: "Cabinet" | "Independent";
  pages: number;
  docs: number;
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit -p tsconfig.json
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/types/policy.ts
git commit -m "feat(types): add PolicyDocument / AgencyCompliance / PolicyStats types"
```

---

### Task 7: `lib/db/policy.ts` query module + tests

**Working dir:** `2025-aia-use-case-inventory/dashboard/`

**Files:**
- Create: `lib/db/policy.ts`
- Test: `tests/lib/db/policy.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/db/policy.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { installTestDb, uninstallTestDb } from "@/tests/setup";
import {
  getPolicyStats,
  getAgencyCompliance,
  getAgencyPagesByPolicy,
  getPolicyDocuments,
  getGoverningDocuments,
  getDocumentsForAgency,
} from "@/lib/db/policy";

describe("lib/db/policy", () => {
  beforeAll(() => installTestDb());
  afterAll(() => uninstallTestDb());

  describe("getPolicyStats", () => {
    it("counts agency pages only (excludes governing docs)", () => {
      const s = getPolicyStats();
      // Seed: DHS 10+12, DOJ 11, NSF 22+7 = 62. Governing 2+25 excluded.
      expect(s.total_pages).toBe(62);
    });
    it("counts agency documents (excludes governing docs)", () => {
      const s = getPolicyStats();
      // Seed: 5 agency docs + 2 governing → 5 agency docs counted.
      expect(s.total_documents).toBe(5);
    });
    it("counts distinct agencies searched", () => {
      const s = getPolicyStats();
      expect(s.total_agencies).toBe(3); // DHS, DOJ, NSF
    });
    it("counts agencies with a published M-25-21 AI Strategy", () => {
      const s = getPolicyStats();
      expect(s.strategies_published).toBe(2); // DHS + NSF
    });
    it("counts agencies with a published M-25-21 Compliance Plan", () => {
      const s = getPolicyStats();
      expect(s.plans_published).toBe(2); // DHS + NSF
    });
    it("exposes last_refreshed date", () => {
      const s = getPolicyStats();
      expect(s.last_refreshed).toBe("2026-05-21");
    });
  });

  describe("getAgencyCompliance", () => {
    it("returns one row per agency, sorted by Cabinet first then name", () => {
      const rows = getAgencyCompliance();
      expect(rows.map((r) => r.agency_abbr)).toEqual(["DHS", "DOJ", "NSF"]);
    });
    it("normalizes searched 0/1 to boolean", () => {
      const rows = getAgencyCompliance();
      expect(typeof rows[0].searched).toBe("boolean");
      expect(rows[0].searched).toBe(true);
    });
  });

  describe("getAgencyPagesByPolicy", () => {
    it("returns one row per agency with summed pages, descending", () => {
      const rows = getAgencyPagesByPolicy();
      // DHS 22, NSF 29, DOJ 11 -> sorted desc by pages
      expect(rows.map((r) => r.agency_abbr)).toEqual(["NSF", "DHS", "DOJ"]);
      expect(rows.find((r) => r.agency_abbr === "DHS")?.pages).toBe(22);
      expect(rows.find((r) => r.agency_abbr === "NSF")?.pages).toBe(29);
    });
    it("excludes governing documents", () => {
      const rows = getAgencyPagesByPolicy();
      expect(rows.find((r) => r.agency_abbr === "EOP")).toBeUndefined();
      expect(rows.find((r) => r.agency_abbr === "OMB")).toBeUndefined();
    });
  });

  describe("getPolicyDocuments", () => {
    it("returns all agency documents, sorted year DESC then agency", () => {
      const rows = getPolicyDocuments();
      // Excludes governing; all 5 seed agency rows.
      expect(rows).toHaveLength(5);
      // 2025 rows first (DHS x2, NSF x2), then 2024 (DOJ).
      expect(rows[rows.length - 1].publication_year).toBe(2024);
    });
    it("filters by agency_abbr", () => {
      const rows = getPolicyDocuments({ agency_abbr: "NSF" });
      expect(rows).toHaveLength(2);
      expect(rows.every((r) => r.agency_abbr === "NSF")).toBe(true);
    });
    it("filters by document_type", () => {
      const rows = getPolicyDocuments({ document_type: "M-25-21 AI Strategy" });
      expect(rows).toHaveLength(2);
    });
    it("filters by publication_year", () => {
      const rows = getPolicyDocuments({ publication_year: 2024 });
      expect(rows).toHaveLength(1);
      expect(rows[0].agency_abbr).toBe("DOJ");
    });
    it("normalizes superseded/is_public to booleans", () => {
      const doj = getPolicyDocuments({ agency_abbr: "DOJ" })[0];
      expect(doj.superseded).toBe(true);
      expect(doj.is_public).toBe(true);
    });
  });

  describe("getGoverningDocuments", () => {
    it("returns only White House / OMB docs, oldest first", () => {
      const rows = getGoverningDocuments();
      expect(rows).toHaveLength(2);
      expect(rows[0].publication_year).toBeLessThanOrEqual(
        rows[1].publication_year,
      );
      expect(
        rows.every((r) => r.agency_type === "White House / OMB"),
      ).toBe(true);
    });
  });

  describe("getDocumentsForAgency", () => {
    it("returns just that agency's documents", () => {
      const rows = getDocumentsForAgency("DHS");
      expect(rows).toHaveLength(2);
      expect(rows.every((r) => r.agency_abbr === "DHS")).toBe(true);
    });
    it("returns [] for an unknown agency", () => {
      expect(getDocumentsForAgency("ZZZ")).toEqual([]);
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- policy
```
Expected: FAIL — `Cannot find module '@/lib/db/policy'`.

- [ ] **Step 3: Write the query module**

Create `lib/db/policy.ts`:

```typescript
// lib/db/policy.ts
//
// Queries backing the dashboard's /policy section and the /agencies/[slug]
// policy subsection. All read from the `agency_ai_policy_documents` and
// `agency_ai_policy_compliance` tables (created by ETL migration m012,
// populated by scripts/load_ai_policy_tracker.py).

import { getDb } from "@/lib/db/shared/init";
import type {
  AgencyCompliance,
  AgencyPolicyPages,
  PolicyDocument,
  PolicyStats,
} from "@/lib/types/policy";

const DOC_COLUMNS = `
  id, agency_abbr, agency_name, agency_type, issuing_office, document_type,
  document_title, publication_year, publication_date, pages, issuing_memo,
  superseded, is_public, url, local_path, access_status, date_accessed, notes
`;

type RawDocumentRow = Omit<PolicyDocument, "superseded" | "is_public"> & {
  superseded: number;
  is_public: number;
};

type RawComplianceRow = Omit<AgencyCompliance, "searched"> & {
  searched: number;
};

function hydrateDoc(r: RawDocumentRow): PolicyDocument {
  return { ...r, superseded: r.superseded === 1, is_public: r.is_public === 1 };
}

function hydrateCompliance(r: RawComplianceRow): AgencyCompliance {
  return { ...r, searched: r.searched === 1 };
}

export function getPolicyStats(): PolicyStats {
  const db = getDb();
  // Pages and document counts deliberately exclude White House / OMB rows —
  // governing documents are the federal foundation, not agency policy.
  const agg = db
    .prepare<[], { total_pages: number; total_documents: number }>(
      `SELECT
         COALESCE(SUM(pages), 0) AS total_pages,
         COUNT(*) AS total_documents
       FROM agency_ai_policy_documents
       WHERE agency_type != 'White House / OMB'`,
    )
    .get()!;

  const compliance = db
    .prepare<[], {
      total_agencies: number;
      strategies_published: number;
      plans_published: number;
      last_refreshed: string | null;
    }>(
      `SELECT
         COUNT(*) AS total_agencies,
         SUM(CASE WHEN ai_strategy_year IS NOT NULL THEN 1 ELSE 0 END)
           AS strategies_published,
         SUM(CASE WHEN compliance_plan_year IS NOT NULL THEN 1 ELSE 0 END)
           AS plans_published,
         MAX(date_searched) AS last_refreshed
       FROM agency_ai_policy_compliance
       WHERE searched = 1`,
    )
    .get()!;

  return {
    total_pages: agg.total_pages,
    total_documents: agg.total_documents,
    total_agencies: compliance.total_agencies,
    strategies_published: compliance.strategies_published,
    plans_published: compliance.plans_published,
    last_refreshed: compliance.last_refreshed ?? "",
  };
}

export function getAgencyCompliance(): AgencyCompliance[] {
  const stmt = getDb().prepare<[], RawComplianceRow>(
    `SELECT * FROM agency_ai_policy_compliance
      ORDER BY
        CASE WHEN agency_type = 'Cabinet' THEN 0 ELSE 1 END,
        agency_name COLLATE NOCASE`,
  );
  return stmt.all().map(hydrateCompliance);
}

export function getAgencyPagesByPolicy(): AgencyPolicyPages[] {
  const stmt = getDb().prepare<[], AgencyPolicyPages>(
    `SELECT
       agency_abbr,
       agency_name,
       agency_type,
       COALESCE(SUM(pages), 0) AS pages,
       COUNT(*) AS docs
     FROM agency_ai_policy_documents
     WHERE agency_type != 'White House / OMB'
     GROUP BY agency_abbr, agency_name, agency_type
     ORDER BY pages DESC, agency_abbr ASC`,
  );
  return stmt.all();
}

export interface PolicyDocumentFilters {
  agency_abbr?: string;
  document_type?: string;
  publication_year?: number;
  issuing_memo?: string;
}

export function getPolicyDocuments(
  filters: PolicyDocumentFilters = {},
): PolicyDocument[] {
  const where: string[] = ["agency_type != 'White House / OMB'"];
  const params: (string | number)[] = [];
  if (filters.agency_abbr) {
    where.push("agency_abbr = ?");
    params.push(filters.agency_abbr);
  }
  if (filters.document_type) {
    where.push("document_type = ?");
    params.push(filters.document_type);
  }
  if (filters.publication_year !== undefined) {
    where.push("publication_year = ?");
    params.push(filters.publication_year);
  }
  if (filters.issuing_memo) {
    where.push("issuing_memo = ?");
    params.push(filters.issuing_memo);
  }
  const sql = `
    SELECT ${DOC_COLUMNS} FROM agency_ai_policy_documents
     WHERE ${where.join(" AND ")}
     ORDER BY publication_year DESC, agency_abbr ASC, document_type ASC
  `;
  const stmt = getDb().prepare<typeof params, RawDocumentRow>(sql);
  return stmt.all(...params).map(hydrateDoc);
}

export function getGoverningDocuments(): PolicyDocument[] {
  const stmt = getDb().prepare<[], RawDocumentRow>(
    `SELECT ${DOC_COLUMNS} FROM agency_ai_policy_documents
      WHERE agency_type = 'White House / OMB'
      ORDER BY publication_year ASC, document_title ASC`,
  );
  return stmt.all().map(hydrateDoc);
}

export function getDocumentsForAgency(abbr: string): PolicyDocument[] {
  const stmt = getDb().prepare<[string], RawDocumentRow>(
    `SELECT ${DOC_COLUMNS} FROM agency_ai_policy_documents
      WHERE agency_abbr = ?
      ORDER BY publication_year DESC, document_type ASC`,
  );
  return stmt.all(abbr).map(hydrateDoc);
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- policy
```
Expected: 16 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/db/policy.ts tests/lib/db/policy.test.ts
git commit -m "feat(db): lib/db/policy.ts — query module for /policy section"
```

---

## Phase 3 — /policy page

### Task 8: Stub `/policy` page + view-model + nav entry

**Working dir:** `2025-aia-use-case-inventory/dashboard/`

**Files:**
- Create: `app/policy/page.tsx`
- Create: `app/policy/_view-model.ts`
- Modify: `components/navigation.tsx`

- [ ] **Step 1: Create the view-model**

Create `app/policy/_view-model.ts`:

```typescript
// app/policy/_view-model.ts — server-side data shaping for /policy.

import {
  getAgencyCompliance,
  getAgencyPagesByPolicy,
  getGoverningDocuments,
  getPolicyDocuments,
  getPolicyStats,
} from "@/lib/db/policy";
import type {
  AgencyCompliance,
  AgencyPolicyPages,
  PolicyDocument,
  PolicyStats,
} from "@/lib/types/policy";

export interface PolicyViewModel {
  stats: PolicyStats;
  compliance: AgencyCompliance[];
  pagesByAgency: AgencyPolicyPages[];
  documents: PolicyDocument[];
  governing: PolicyDocument[];
}

export async function buildPolicyViewModel(): Promise<PolicyViewModel> {
  return {
    stats: getPolicyStats(),
    compliance: getAgencyCompliance(),
    pagesByAgency: getAgencyPagesByPolicy(),
    documents: getPolicyDocuments(),
    governing: getGoverningDocuments(),
  };
}
```

- [ ] **Step 2: Create the page stub**

Create `app/policy/page.tsx`:

```tsx
// app/policy/page.tsx — top-level /policy section.

import { buildPolicyViewModel } from "./_view-model";

export const metadata = { title: "Federal AI Policy" };

export default async function PolicyPage() {
  const vm = await buildPolicyViewModel();

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-8 md:px-8">
      <header className="mb-8">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-stamp">
          VI · Policy
        </p>
        <h1 className="mt-1 font-display text-4xl italic leading-tight md:text-5xl">
          Federal AI Policy
        </h1>
        <p className="mt-2 max-w-[60ch] text-sm text-foreground/70">
          M-25-21 compliance · {vm.stats.total_agencies} agencies · last
          refreshed {vm.stats.last_refreshed}
        </p>
      </header>

      <p className="text-sm text-foreground/60">
        {vm.stats.total_documents} agency documents · {vm.stats.total_pages.toLocaleString()} pages of policy ·
        {" "}{vm.stats.strategies_published}/{vm.stats.total_agencies} M-25-21 strategies ·
        {" "}{vm.stats.plans_published}/{vm.stats.total_agencies} compliance plans
      </p>
    </main>
  );
}
```

- [ ] **Step 3: Add "Policy" to the nav PRIMARY array**

Open `components/navigation.tsx`. Find:

```tsx
const PRIMARY: Array<{ href: string; label: string; kicker: string }> = [
  { href: "/agencies", label: "Agencies", kicker: "I" },
  { href: "/use-cases", label: "Use Cases", kicker: "III" },
  { href: "/products", label: "Products", kicker: "IV" },
  { href: "/analytics", label: "Analytics", kicker: "V" },
];
```

Replace with:

```tsx
const PRIMARY: Array<{ href: string; label: string; kicker: string }> = [
  { href: "/agencies", label: "Agencies", kicker: "I" },
  { href: "/use-cases", label: "Use Cases", kicker: "III" },
  { href: "/products", label: "Products", kicker: "IV" },
  { href: "/analytics", label: "Analytics", kicker: "V" },
  { href: "/policy", label: "Policy", kicker: "VI" },
];
```

- [ ] **Step 4: Verify the page renders**

```bash
npm run dev &
sleep 6
curl -s http://localhost:3000/policy | grep -E '(Federal AI Policy|VI · Policy)' | head -3
kill %1 2>/dev/null
```
Expected: matches both strings.

- [ ] **Step 5: Run lint and type check**

```bash
npx tsc --noEmit -p tsconfig.json && npx eslint app/policy components/navigation.tsx
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/policy components/navigation.tsx
git commit -m "feat(policy): stub /policy page + nav entry"
```

---

### Task 9: Header stat cards

**Working dir:** `2025-aia-use-case-inventory/dashboard/`

**Files:**
- Modify: `app/policy/page.tsx`

- [ ] **Step 1: Replace the summary paragraph with stat cards**

In `app/policy/page.tsx`, replace the `<p>` paragraph that follows `<header>` with this block:

```tsx
      <section className="mb-10 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Pages of policy"
          value={vm.stats.total_pages.toLocaleString()}
          hint="agency-issued only"
        />
        <StatCard
          label="Documents"
          value={vm.stats.total_documents.toString()}
          hint="agency-issued only"
        />
        <StatCard
          label="M-25-21 Strategies"
          value={`${vm.stats.strategies_published} / ${vm.stats.total_agencies}`}
          hint="public agency strategy"
        />
        <StatCard
          label="M-25-21 Compliance Plans"
          value={`${vm.stats.plans_published} / ${vm.stats.total_agencies}`}
          hint="public agency plan"
        />
      </section>
```

And add this helper component at the bottom of the file (above or below `PolicyPage`):

```tsx
function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-sm border border-border bg-card/40 p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-foreground/60">
        {label}
      </p>
      <p className="mt-1 font-display text-3xl leading-none text-foreground">
        {value}
      </p>
      <p className="mt-1 text-[11px] text-foreground/50">{hint}</p>
    </div>
  );
}
```

- [ ] **Step 2: Verify the page renders the stats**

```bash
npm run dev &
sleep 6
curl -s http://localhost:3000/policy | grep -c 'Pages of policy\|M-25-21'
kill %1 2>/dev/null
```
Expected: a count of at least 3 (matches "Pages of policy" once plus both M-25-21 labels).

- [ ] **Step 3: Commit**

```bash
git add app/policy/page.tsx
git commit -m "feat(policy): header stat cards"
```

---

### Task 10: Pages-by-agency horizontal bar chart

**Working dir:** `2025-aia-use-case-inventory/dashboard/`

**Files:**
- Create: `app/policy/_sections/pages-by-agency-chart.tsx`
- Modify: `app/policy/page.tsx`

- [ ] **Step 1: Create the chart section wrapper**

`HorizontalBarChart` takes `data: BarDatum[]` where `BarDatum = { label, count }`, plus an optional `colorMap` (label → hex). It wraps itself in `ChartFrame`, so the wrapper here must **not** double-wrap.

Create `app/policy/_sections/pages-by-agency-chart.tsx`:

```tsx
"use client";

import type { AgencyPolicyPages } from "@/lib/types/policy";
import { HorizontalBarChart } from "@/components/charts/horizontal-bar-chart";

const CABINET_COLOR = "#1f5c8b";
const INDEPENDENT_COLOR = "#5a9bbf";

interface Props {
  rows: AgencyPolicyPages[];
}

export function PagesByAgencyChart({ rows }: Props) {
  const data = rows.map((r) => ({ label: r.agency_abbr, count: r.pages }));
  const colorMap = Object.fromEntries(
    rows.map((r) => [
      r.agency_abbr,
      r.agency_type === "Cabinet" ? CABINET_COLOR : INDEPENDENT_COLOR,
    ]),
  );

  // HorizontalBarChart manages its own ChartFrame. Pass a height that scales
  // with row count so all ~45 agency bars are visible.
  return (
    <HorizontalBarChart
      data={data}
      colorMap={colorMap}
      height={Math.max(380, rows.length * 18)}
      labelWidth={64}
    />
  );
}
```

- [ ] **Step 2: Wire the chart into the page (right column of the two-column block)**

In `app/policy/page.tsx`, add this import:

```tsx
import { PagesByAgencyChart } from "./_sections/pages-by-agency-chart";
```

Then append the two-column block after the stat cards section:

```tsx
      <section className="mb-12 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-sm border border-border bg-card/40 p-4">
          <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-stamp">
            Compliance scorecard
          </h2>
          <p className="text-sm text-foreground/60">
            Scorecard table lands in the next task.
          </p>
        </div>
        <div className="rounded-sm border border-border bg-card/40 p-4">
          <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-stamp">
            Pages of policy by agency
          </h2>
          <PagesByAgencyChart rows={vm.pagesByAgency} />
        </div>
      </section>
```

- [ ] **Step 3: Verify in browser via Playwright screenshot**

```bash
npm run dev &
sleep 7
playwright screenshot --full-page --viewport-size 1280,1800 "http://localhost:3000/policy" /tmp/policy-task10.png
kill %1 2>/dev/null
```
Open `/tmp/policy-task10.png` and confirm the chart renders with visible bars (one per agency) on the right side of the two-column block, with Cabinet bars darker than Independent.

- [ ] **Step 4: Commit**

```bash
git add app/policy/_sections/pages-by-agency-chart.tsx app/policy/page.tsx
git commit -m "feat(policy): pages-by-agency chart in two-column block"
```

---

### Task 11: Compliance scorecard table

**Working dir:** `2025-aia-use-case-inventory/dashboard/`

**Files:**
- Create: `app/policy/_sections/compliance-scorecard.tsx`
- Modify: `app/policy/page.tsx`

- [ ] **Step 1: Create the scorecard component (server component)**

Create `app/policy/_sections/compliance-scorecard.tsx`:

```tsx
// app/policy/_sections/compliance-scorecard.tsx
// Compliance scorecard table — one row per agency, ✓ / — per artifact.
// Server component. The optional type filter is implemented via search params
// on the parent page if/when needed; v1 renders all agencies.

import type { AgencyCompliance } from "@/lib/types/policy";

interface Props {
  rows: AgencyCompliance[];
}

function yearCell(year: number | null): string {
  return year !== null ? String(year) : "—";
}

function caioCell(status: string | null): string {
  if (!status) return "—";
  if (status.startsWith("Named:")) {
    const name = status.split("Named:", 2)[1].split(";")[0].split("(")[0].trim();
    return name.length > 24 ? "designated" : name;
  }
  if (status.startsWith("Designated")) return "designated";
  return status.length > 24 ? "—" : status;
}

export function ComplianceScorecard({ rows }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="py-1.5 pr-3 font-mono text-[10px] uppercase tracking-wider text-foreground/60">
              Agency
            </th>
            <th className="py-1.5 px-1 text-center font-mono text-[10px] uppercase tracking-wider text-foreground/60">
              M-25-21 Strategy
            </th>
            <th className="py-1.5 px-1 text-center font-mono text-[10px] uppercase tracking-wider text-foreground/60">
              M-25-21 Plan
            </th>
            <th className="py-1.5 px-1 text-center font-mono text-[10px] uppercase tracking-wider text-foreground/60">
              Gen-AI
            </th>
            <th className="py-1.5 pl-3 font-mono text-[10px] uppercase tracking-wider text-foreground/60">
              CAIO
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.agency_abbr} className="border-b border-border/60">
              <td className="py-1 pr-3">
                <span className="font-mono text-[11px] font-bold">
                  {r.agency_abbr}
                </span>
                <span className="ml-2 text-foreground/55">{r.agency_name}</span>
              </td>
              <td className="py-1 px-1 text-center font-mono">
                {yearCell(r.ai_strategy_year)}
              </td>
              <td className="py-1 px-1 text-center font-mono">
                {yearCell(r.compliance_plan_year)}
              </td>
              <td className="py-1 px-1 text-center font-mono text-foreground/70">
                {yearCell(r.genai_policy_year)}
              </td>
              <td className="py-1 pl-3 text-foreground/70">{caioCell(r.caio_status)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Replace the scorecard placeholder in `page.tsx`**

Replace the left-column placeholder `<p>Scorecard table lands in the next task.</p>` with:

```tsx
          <ComplianceScorecard rows={vm.compliance} />
```

And add the import at the top:

```tsx
import { ComplianceScorecard } from "./_sections/compliance-scorecard";
```

- [ ] **Step 3: Verify with Playwright screenshot**

```bash
npm run dev &
sleep 7
playwright screenshot --full-page --viewport-size 1280,1800 "http://localhost:3000/policy" /tmp/policy-task11.png
kill %1 2>/dev/null
```
Confirm the scorecard table renders on the left with one row per agency.

- [ ] **Step 4: Commit**

```bash
git add app/policy/_sections/compliance-scorecard.tsx app/policy/page.tsx
git commit -m "feat(policy): compliance scorecard table"
```

---

### Task 12: Full-width document directory (TanStack table)

**Working dir:** `2025-aia-use-case-inventory/dashboard/`

**Files:**
- Create: `app/policy/_sections/document-directory.tsx`
- Modify: `app/policy/page.tsx`

- [ ] **Step 1: Inspect the AgenciesTable filter pattern**

```bash
sed -n '1,80p' components/agencies-table.tsx
```
Use the same filter-primitives + TanStack column-def + useReactTable pattern. Mirror the visual style (filter chips above a sortable table).

- [ ] **Step 2: Create the directory component**

Create `app/policy/_sections/document-directory.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import type { PolicyDocument } from "@/lib/types/policy";

interface Props {
  documents: PolicyDocument[];
}

const ch = createColumnHelper<PolicyDocument>();

const columns: ColumnDef<PolicyDocument, unknown>[] = [
  ch.accessor("agency_abbr", {
    header: "Agency",
    cell: (info) => (
      <span className="font-mono text-[11px] font-bold">{info.getValue()}</span>
    ),
  }),
  ch.accessor("document_title", {
    header: "Title",
    cell: (info) => (
      <a
        href={info.row.original.url}
        target="_blank"
        rel="noopener noreferrer"
        className="underline-offset-2 hover:underline"
      >
        {info.getValue()}
      </a>
    ),
  }),
  ch.accessor("document_type", { header: "Type" }),
  ch.accessor("publication_year", { header: "Year" }),
  ch.accessor("issuing_memo", {
    header: "Memo",
    cell: (info) => info.getValue() ?? "—",
  }),
  ch.accessor("pages", {
    header: "Pages",
    cell: (info) => info.getValue() ?? "—",
  }),
];

export function DocumentDirectory({ documents }: Props) {
  const [agency, setAgency] = useState<string>("");
  const [docType, setDocType] = useState<string>("");
  const [year, setYear] = useState<string>("");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "publication_year", desc: true },
  ]);

  const agencyOptions = useMemo(
    () => Array.from(new Set(documents.map((d) => d.agency_abbr))).sort(),
    [documents],
  );
  const typeOptions = useMemo(
    () => Array.from(new Set(documents.map((d) => d.document_type))).sort(),
    [documents],
  );
  const yearOptions = useMemo(
    () =>
      Array.from(new Set(documents.map((d) => d.publication_year)))
        .sort((a, b) => b - a)
        .map(String),
    [documents],
  );

  const filtered = useMemo(
    () =>
      documents.filter(
        (d) =>
          (!agency || d.agency_abbr === agency) &&
          (!docType || d.document_type === docType) &&
          (!year || String(d.publication_year) === year),
      ),
    [documents, agency, docType, year],
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-3 text-[11px]">
        <FilterSelect
          label="Agency"
          value={agency}
          options={agencyOptions}
          onChange={setAgency}
        />
        <FilterSelect
          label="Document type"
          value={docType}
          options={typeOptions}
          onChange={setDocType}
        />
        <FilterSelect
          label="Year"
          value={year}
          options={yearOptions}
          onChange={setYear}
        />
        <span className="self-center text-foreground/55">
          {filtered.length} of {documents.length} documents
        </span>
      </div>

      <table className="min-w-full border-collapse text-[12px]">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-b border-border text-left">
              {hg.headers.map((h) => (
                <th
                  key={h.id}
                  onClick={h.column.getToggleSortingHandler()}
                  className="cursor-pointer py-1.5 pr-3 font-mono text-[10px] uppercase tracking-wider text-foreground/60"
                >
                  {flexRender(h.column.columnDef.header, h.getContext())}
                  {{ asc: " ↑", desc: " ↓" }[h.column.getIsSorted() as string] ?? ""}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-b border-border/60">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="py-1 pr-3 align-top">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-foreground/70">
      <span>{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-sm border border-border bg-background px-2 py-0.5 text-[11px]"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
```

- [ ] **Step 3: Wire it into the page**

In `app/policy/page.tsx`, add the import:

```tsx
import { DocumentDirectory } from "./_sections/document-directory";
```

And add a section after the two-column block:

```tsx
      <section className="mb-12">
        <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-stamp">
          All policy documents
        </h2>
        <DocumentDirectory documents={vm.documents} />
      </section>
```

- [ ] **Step 4: Verify in browser**

```bash
npm run dev &
sleep 7
playwright screenshot --full-page --viewport-size 1280,2400 "http://localhost:3000/policy" /tmp/policy-task12.png
kill %1 2>/dev/null
```
Open the screenshot and confirm the directory table renders below the two-column block with filter dropdowns and all rows. Click-sort works at runtime.

- [ ] **Step 5: Commit**

```bash
git add app/policy/_sections/document-directory.tsx app/policy/page.tsx
git commit -m "feat(policy): document directory (TanStack table)"
```

---

### Task 13: Governing documents reference block

**Working dir:** `2025-aia-use-case-inventory/dashboard/`

**Files:**
- Create: `app/policy/_sections/governing-docs-block.tsx`
- Modify: `app/policy/page.tsx`

- [ ] **Step 1: Create the section**

Create `app/policy/_sections/governing-docs-block.tsx`:

```tsx
// app/policy/_sections/governing-docs-block.tsx
// Reference block for the 3 executive orders + 3 OMB memoranda that agencies
// write their policies in response to. Visually distinguished from the
// agency-issued content above.

import type { PolicyDocument } from "@/lib/types/policy";

interface Props {
  governing: PolicyDocument[];
}

export function GoverningDocsBlock({ governing }: Props) {
  const totalPages = governing.reduce((acc, d) => acc + (d.pages ?? 0), 0);

  return (
    <section className="mb-12 rounded-sm border border-stamp/40 bg-stamp/[0.04] p-5">
      <header className="mb-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-stamp">
          Governing documents · White House &amp; OMB
        </p>
        <p className="mt-1 text-sm text-foreground/70">
          The federal foundation agencies respond to.{" "}
          {governing.length} documents · {totalPages} pages · excluded from the
          agency totals above.
        </p>
      </header>
      <table className="min-w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="py-1.5 pr-3 font-mono text-[10px] uppercase tracking-wider text-foreground/60">
              Document
            </th>
            <th className="py-1.5 pr-3 font-mono text-[10px] uppercase tracking-wider text-foreground/60">
              Year
            </th>
            <th className="py-1.5 pr-3 font-mono text-[10px] uppercase tracking-wider text-foreground/60">
              Pages
            </th>
            <th className="py-1.5 pr-3 font-mono text-[10px] uppercase tracking-wider text-foreground/60">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {governing.map((d) => (
            <tr key={d.id} className="border-b border-border/50">
              <td className="py-1 pr-3">
                <a
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline-offset-2 hover:underline"
                >
                  {d.document_title}
                </a>
              </td>
              <td className="py-1 pr-3 font-mono">{d.publication_year}</td>
              <td className="py-1 pr-3 font-mono">{d.pages ?? "—"}</td>
              <td className="py-1 pr-3 text-foreground/70">
                {d.superseded ? "Superseded" : "In effect"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
```

- [ ] **Step 2: Wire into page**

Add import to `app/policy/page.tsx`:

```tsx
import { GoverningDocsBlock } from "./_sections/governing-docs-block";
```

And render after the document directory section:

```tsx
      <GoverningDocsBlock governing={vm.governing} />
```

- [ ] **Step 3: Verify**

```bash
npm run dev &
sleep 7
playwright screenshot --full-page --viewport-size 1280,2600 "http://localhost:3000/policy" /tmp/policy-task13.png
kill %1 2>/dev/null
```
Confirm the gold-bordered governing-documents block appears below the document directory.

- [ ] **Step 4: Commit**

```bash
git add app/policy/_sections/governing-docs-block.tsx app/policy/page.tsx
git commit -m "feat(policy): governing-documents reference block"
```

---

### Task 14: Methodology anchor

**Working dir:** `2025-aia-use-case-inventory/dashboard/`

**Files:**
- Modify: `app/policy/page.tsx`

- [ ] **Step 1: Append a methodology footer to `page.tsx`**

After `<GoverningDocsBlock ...>` and before the closing `</main>`:

```tsx
      <section id="methodology" className="mb-12 max-w-[68ch] text-sm text-foreground/70">
        <h2 className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-stamp">
          Methodology
        </h2>
        <p>
          Coverage is the {vm.stats.total_agencies} agencies that filed a 2025
          AI use case inventory, plus the Department of Defense (inventory-exempt
          but a major AI-strategy publisher). For each agency, parallel research
          sweeps located the AI landing page, identified every formal AI
          strategy or policy document published since 2023, and recorded the
          publication year, source URL, and mapping to the M-24-10 / M-25-21
          required-artifact set. PDF page counts are exact; web-page documents
          are estimated at ~500 words per page. The full source tracker (CSVs,
          per-agency research notes, and the downloaded originals) lives in the
          ETL workspace under <code>audit/research/ai_strategies/</code>.
        </p>
      </section>
```

- [ ] **Step 2: Verify**

```bash
npm run dev &
sleep 7
curl -s http://localhost:3000/policy | grep -c 'Methodology\|filed a 2025'
kill %1 2>/dev/null
```
Expected: count of at least 2.

- [ ] **Step 3: Commit**

```bash
git add app/policy/page.tsx
git commit -m "feat(policy): methodology anchor section"
```

---

## Phase 4 — Cross-link from /agencies/[slug]

### Task 15: Agency policy-documents subsection + integration

**Working dir:** `2025-aia-use-case-inventory/dashboard/`

**Files:**
- Create: `components/agency/agency-policy-documents.tsx`
- Modify: `app/agencies/[slug]/page.tsx`

- [ ] **Step 1: Create the subsection component (server component)**

Create `components/agency/agency-policy-documents.tsx`:

```tsx
// components/agency/agency-policy-documents.tsx
// Per-agency "Policy & strategy documents" subsection rendered inside the
// /agencies/[slug] detail page. Server component; takes the agency abbreviation
// and queries lib/db/policy for that agency's documents.

import { getDocumentsForAgency } from "@/lib/db/policy";

interface Props {
  /** Agency abbreviation, e.g. "DHS" — must match agency_ai_policy_documents.agency_abbr. */
  agencyAbbr: string;
}

export function AgencyPolicyDocuments({ agencyAbbr }: Props) {
  const docs = getDocumentsForAgency(agencyAbbr);

  return (
    <section className="mb-10">
      <header className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.14em] text-stamp">
          Policy &amp; strategy documents
        </h2>
        <a
          href={`/policy#agency-${agencyAbbr}`}
          className="text-[11px] text-foreground/55 underline-offset-2 hover:underline"
        >
          See in full /policy view →
        </a>
      </header>

      {docs.length === 0 ? (
        <p className="text-sm text-foreground/55">
          No formal AI strategy or policy document found publicly for this agency.
        </p>
      ) : (
        <ul className="divide-y divide-border/60">
          {docs.map((d) => (
            <li key={d.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2">
              <span className="font-mono text-[11px] text-foreground/60">
                {d.publication_year}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-foreground/55">
                {d.document_type}
              </span>
              <a
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm underline-offset-2 hover:underline"
              >
                {d.document_title}
              </a>
              {d.superseded && (
                <span className="font-mono text-[9px] uppercase tracking-wider text-stamp">
                  superseded
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Find the agency-detail page's render location**

```bash
sed -n '1,50p' app/agencies/[slug]/page.tsx
```
Identify where the existing sub-sections render (likely near `<AgencyUseCasesTable />`). Add the new subsection adjacent to those.

- [ ] **Step 3: Wire the component into the agency detail page**

Add the import near the existing `agency/*` imports in `app/agencies/[slug]/page.tsx`:

```tsx
import { AgencyPolicyDocuments } from "@/components/agency/agency-policy-documents";
```

The `agency` object in scope already exposes `agency.abbreviation` (used elsewhere in this file, e.g. `getAgencyReadinessByAbbr(agency.abbreviation)` and the FedRAMP coverage link). Render the new subsection **immediately above the first `<IndividualUseCasesTable …>` or `<ConsolidatedUseCasesTable …>` block** so policy context precedes use-case detail:

```tsx
<AgencyPolicyDocuments agencyAbbr={agency.abbreviation} />
```

- [ ] **Step 4: Verify with Playwright**

```bash
npm run dev &
sleep 7
playwright screenshot --full-page --viewport-size 1280,2000 "http://localhost:3000/agencies/dhs" /tmp/agency-dhs.png
playwright screenshot --full-page --viewport-size 1280,2000 "http://localhost:3000/agencies/nmb" /tmp/agency-nmb.png
kill %1 2>/dev/null
```
The route uses `getOrganizationBySlugOrAbbr(slug)`, which accepts either the slug or the abbreviation in any case — `dhs` and `nmb` both work. Confirm DHS shows a list of documents and NMB shows the empty-state copy.

- [ ] **Step 5: Run lint + type check**

```bash
npx tsc --noEmit -p tsconfig.json && npx eslint app/agencies components/agency
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/agency/agency-policy-documents.tsx app/agencies/[slug]/page.tsx
git commit -m "feat(agencies): policy-documents subsection on agency detail pages"
```

---

## Phase 5 — Final verification

### Task 16: Full test suite, lint, and final screenshots

**Working dir:** both repos, as noted

- [ ] **Step 1: Run the ETL test suite**

```bash
cd /Users/michaelboyce/Documents/Programming/ifp/ai-use-case-inventory/2025-aia-use-case-inventory
pytest tests/ -q
```
Expected: all tests pass (previous count plus the 9 new tests added in Tasks 1–2).

- [ ] **Step 2: Run the dashboard test suite**

```bash
cd /Users/michaelboyce/Documents/Programming/ifp/ai-use-case-inventory/2025-aia-use-case-inventory/dashboard
npm test
```
Expected: all tests pass (previous count plus the 16 new policy tests from Task 7).

- [ ] **Step 3: Run lint**

```bash
npm run lint
```
Expected: no new errors. Pre-existing warnings unrelated to /policy or /agencies are acceptable.

- [ ] **Step 4: Run the production build**

```bash
npm run build
```
Expected: build succeeds; `/policy` appears in the route list.

- [ ] **Step 5: Take final Playwright screenshots**

```bash
npm run dev &
sleep 8
playwright screenshot --full-page --viewport-size 1280,2800 "http://localhost:3000/policy" /tmp/final-policy.png
playwright screenshot --full-page --viewport-size 1280,2200 "http://localhost:3000/agencies/dhs" /tmp/final-agency-dhs.png
kill %1 2>/dev/null
ls -la /tmp/final-policy.png /tmp/final-agency-dhs.png
```
Visually confirm:
- /policy renders the header strip, two-column block (scorecard + chart), document directory, governing docs block, methodology.
- /agencies/dhs renders the new "Policy & strategy documents" subsection with DHS's documents listed.

- [ ] **Step 6: Final commit (only if anything uncommitted)**

```bash
git status
```
If `git status` reports modified files, commit them with a descriptive message. Otherwise this task is complete with no final commit needed.

---

## What ships when this plan is done

- **ETL repo:** migration `m012`, loader `scripts/load_ai_policy_tracker.py`, Makefile wired, 9 new tests. Two commits in this repo.
- **Dashboard repo:** new `/policy` top-level route with header, scorecard, chart, directory, governing block, methodology; updated nav with kicker `VI`; per-agency cross-link subsection on `/agencies/[slug]`; new `lib/db/policy.ts` query module with 16 tests; refreshed DB + test fixtures. ~10 commits in this repo.
- Visible on the live site at `https://use-case-inventory.vercel.app/policy` after `git push origin main` from the dashboard repo (Vercel auto-deploys).
