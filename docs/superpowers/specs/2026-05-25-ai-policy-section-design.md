# Federal AI Policy Section — Dashboard Design

**Status:** approved design (2026-05-25)
**Scope:** new top-level `/policy` section in the use-case-inventory dashboard, plus the ETL pipeline and `/agencies/[slug]` integration that feed it.

## Purpose

Surface the federal-AI-policy tracker (currently `audit/research/ai_strategies/` in the ETL repo) as a first-class part of the dashboard. The page tells two stories at once:

- **Compliance:** which of the 45 in-scope agencies have published their OMB M-25-21 AI Strategy and Compliance Plan, which haven't, and who's named a Chief AI Officer.
- **Corpus:** how much AI policy each agency has actually written — the pages-by-agency volume story, in keeping with the dashboard's IFP / state-capacity framing.

This complements `/readiness` (a maturity rubric) with a *publication* readout: what agencies have written down, not what their underlying capability is.

## Site placement

- **New primary nav item: "Policy"** (roman VI), added to `PRIMARY` in `components/navigation.tsx` alongside Agencies / Readiness / Use Cases / Products / Analytics.
- **Route:** `/policy` (top-level).
- **No dropdown for v1** — the section is a single page plus an anchor for methodology.

## Page layout (`/policy`)

Linear scroll, matching the existing dashboard editorial pattern (cf. `/analytics`):

1. **Header strip** — title ("Federal AI Policy"), subtitle ("M-25-21 compliance · 45 agencies · last refreshed YYYY-MM-DD"), four stat cards:
   *Pages of policy · Documents · M-25-21 Strategies X/45 · M-25-21 Plans Y/45*.
   All four stat-card numbers reflect **agency-issued documents only** — the 6 governing executive orders and OMB memoranda are counted separately, shown in section 4, and never rolled into "Pages of policy" or "Documents".
2. **Two-column compact block** — at desktop widths, side-by-side:
   - **Left:** compliance scorecard table. One row per agency. Columns: Agency · M-25-21 Strategy (✓ year / —) · M-25-21 Plan · M-24-10 Plan · Gen-AI Policy (year) · CAIO. Filter by type (Cabinet / Independent / All).
   - **Right:** pages-by-agency horizontal bar chart (Recharts), sorted descending. Cabinet vs. independent colored distinctly. Reuses the existing `horizontal-bar-chart.tsx` + `ChartFrame` pattern.
   - Collapses to stacked single column on narrow viewports.
3. **Full-width document directory** — TanStack table, one row per document. Columns: Agency · Title · Type · Year · OMB memo · External link. Filters: agency, document_type, year, OMB memo. Default sort: publication_year DESC. Inherits the `AgenciesTable` filter pattern.
4. **Governing documents block** — small reference table (the 6 EOs + OMB memos): Document · Year · Status · Implements. Clearly visually separated from the agency content (cream / stamp accent treatment).
5. **Methodology anchor** — short paragraph + link to the tracker's source (`audit/research/ai_strategies/` in the ETL repo). No separate route in v1.

## Cross-page integration

Each `/agencies/[slug]` page gets a new "**Policy & strategy documents**" subsection: a compact list of that agency's documents (title, year, type chip, external link). Empty state for agencies with none. Implemented as a new server component, fed by a dedicated query.

## Data layer

### Schema migration (ETL repo)

New migration: `migrations/m012_ai_policy_tracker.py`. Adds two tables:

**`agency_ai_policy_documents`** — one row per document.
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PRIMARY KEY AUTOINCREMENT | |
| agency_abbr | TEXT NOT NULL | FK-like reference to `agencies.abbreviation` |
| agency_name | TEXT NOT NULL | denormalized for query convenience |
| agency_type | TEXT NOT NULL | Cabinet / Independent / White House / OMB |
| issuing_office | TEXT | sub-agency / component when below department level |
| document_type | TEXT NOT NULL | controlled vocab; see tracker README |
| document_title | TEXT NOT NULL | |
| publication_year | INTEGER NOT NULL | |
| publication_date | TEXT | YYYY-MM-DD if known |
| pages | INTEGER | nullable for link-only docs |
| issuing_memo | TEXT | M-24-10 / M-25-21 / M-25-22 / EO / blank |
| superseded | INTEGER NOT NULL DEFAULT 0 | boolean |
| is_public | INTEGER NOT NULL DEFAULT 1 | boolean |
| url | TEXT NOT NULL | source URL |
| local_path | TEXT | nullable; for ETL bookkeeping only |
| access_status | TEXT NOT NULL | Downloaded / Link only / Not public / Not found |
| date_accessed | TEXT NOT NULL | |
| notes | TEXT | |

Indexes: `(agency_abbr)`, `(agency_type)`, `(document_type)`, `(publication_year)`.

**`agency_ai_policy_compliance`** — one row per agency.
| Column | Type | Notes |
|---|---|---|
| agency_abbr | TEXT PRIMARY KEY | |
| agency_name | TEXT NOT NULL | |
| agency_type | TEXT NOT NULL | Cabinet / Independent |
| searched | INTEGER NOT NULL DEFAULT 1 | boolean |
| date_searched | TEXT NOT NULL | |
| ai_landing_page_url | TEXT | |
| ai_strategy_year | INTEGER | nullable |
| compliance_plan_year | INTEGER | nullable |
| genai_policy_year | INTEGER | nullable |
| caio_status | TEXT | |
| other_policy_count | INTEGER NOT NULL DEFAULT 0 | |
| total_documents | INTEGER NOT NULL DEFAULT 0 | |
| gaps | TEXT | |
| notes | TEXT | |

The Governing-documents block reads from `agency_ai_policy_documents` filtered to `agency_type = 'White House / OMB'`; no separate table.

### Loader

`scripts/load_ai_policy_tracker.py` (ETL repo). Reads `audit/research/ai_strategies/documents.csv` and `coverage.csv`; truncates and re-inserts both tables (idempotent). Wired into the `make fix` chain. Standalone runnable.

### Dashboard query module

New file: `lib/db/policy.ts`. Typed query functions:
- `getPolicyStats()` — counts for the stat-card strip
- `getAgencyCompliance(): AgencyCompliance[]` — scorecard rows (joined with `agencies` for type/maturity context)
- `getAgencyPagesByPolicy(): { agency_abbr; agency_name; agency_type; pages; docs }[]` — chart rows
- `getPolicyDocuments(filters): PolicyDocument[]` — directory rows
- `getGoverningDocuments(): PolicyDocument[]` — the 6 EOs/OMB memos
- `getDocumentsForAgency(slug): PolicyDocument[]` — used by `/agencies/[slug]`

Types live in `lib/types/policy.ts`.

### View-model

`app/policy/_view-model.ts` composes the above into a single typed `PolicyViewModel` rendered by `app/policy/page.tsx`.

## New components

- `app/policy/page.tsx` — server component; parses params, calls view-model, renders sections.
- `app/policy/_view-model.ts` — server-side data shaping.
- `app/policy/_sections/compliance-scorecard.tsx` — server / client split as needed for the type filter.
- `app/policy/_sections/pages-by-agency-chart.tsx` — client component wrapping `horizontal-bar-chart` in `ChartFrame`.
- `app/policy/_sections/document-directory.tsx` — client component; TanStack table + filter primitives from `components/ui/filter-primitives`.
- `app/policy/_sections/governing-docs-block.tsx` — server component; small reference table.
- `components/agency/agency-policy-documents.tsx` — server component used by `/agencies/[slug]`.

Files NOT to touch (unrelated uncommitted work in the dashboard repo at the time of writing): `app/use-cases/page.tsx`, `components/use-case/filters/index.tsx`.

## Out of scope (v1)

- Hosting original PDFs in the dashboard repo — external links only (`whitehouse.gov` / agency URLs). Keeps the dashboard repo small and the URL-as-source-of-truth.
- Dedicated per-agency policy route (`/policy/<agency>`) — the global directory's agency filter covers it.
- Extra charts (publications-over-time, doc-type distribution) — deferred to follow-up.
- Methodology as a separate route — anchor section for v1.
- LLM-assisted document summarization or compliance-status auto-classification — out of scope.

## Refresh workflow

The tracker is a periodic research deliverable; updates flow:

1. Re-run the agency research sweeps in the ETL repo (`audit/research/ai_strategies/`); regenerate `documents.csv` and `coverage.csv`.
2. `make fix` in the ETL repo runs the loader, refreshing the two tables.
3. Copy the rebuilt `data/federal_ai_inventory_2025.db` into `dashboard/data/`.
4. The dashboard rebuilds (Vercel autodeploy on push to `main`).
5. The `/policy` page displays the new `last refreshed` date from `MAX(date_searched)` in `agency_ai_policy_compliance`.

## Open questions deferred to the implementation plan

- Exact responsive breakpoint for collapsing the two-column compact block to a single column.
- Whether the scorecard's "CAIO" cell links anywhere (probably plain text in v1; deep-link in a follow-up).
- Whether the document directory needs server-side pagination or full client-side rendering of all 97-ish rows (likely client-side is fine at this scale).
