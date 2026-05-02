# Federal AI Use Case Inventory — Dashboard

Next.js 16 (App Router) dashboard for the 2025 Federal AI Use Case Inventory.
Reads directly from a local SQLite database; there is no API layer.

## Stack

- Next.js 16 (App Router, React Server Components)
- React 19
- TypeScript (strict)
- Tailwind CSS v4
- shadcn/ui components
- `better-sqlite3` for read-only DB access
- `recharts` for charts
- `@tanstack/react-table` for tables

## Data source

The dashboard reads from:

```
../data/federal_ai_inventory_2025.db
```

…resolved as `path.join(process.cwd(), "..", "data", "federal_ai_inventory_2025.db")`
relative to the `dashboard/` directory. The DB is opened in **read-only** mode;
the dashboard never writes to it.

Table snapshot generated from the current DB:

| Table | Rows |
| --- | --- |
| `agencies` | 60 |
| `use_cases` | 3,617 |
| `consolidated_use_cases` | 192 |
| `products` | 217 |
| `product_aliases` | 367 |
| `entry_product_edges` | 726 |
| `use_case_templates` | 22 |
| `use_case_tags` | 3,809 |
| `agency_ai_maturity` | 44 |

The authoritative generated count block lives at `../audit/db_snapshot.md`.

## Running

```bash
npm install         # once
npm run dev         # http://localhost:3000
npm run build       # type-check + production build
npm run start       # serve production build
```

## Architecture

- All pages are Server Components by default. They import query helpers from
  `@/lib/db` and pass plain objects into Client Components that need
  interactivity.
- `next.config.ts` marks `better-sqlite3` as a `serverExternalPackages` entry
  so its native addon isn't bundled into the RSC graph.
- Formatting helpers live in `@/lib/formatting` (pure functions, usable in
  both environments).
- Shared UI primitives live in `@/components/ui/*` (shadcn/ui, neutral base
  color, `base-nova` style).

## Import paths for other agents

```ts
import {
  getGlobalStats,
  getAgencies,
  getAgencyByAbbr,
  getUseCasesFiltered,
  // ...
} from "@/lib/db";

import {
  formatNumber,
  formatPercent,
  maturityTierColor,
} from "@/lib/formatting";

import type {
  Agency,
  UseCaseWithTags,
  ProductDetail,
  // ...
} from "@/lib/types";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
```

## Installed shadcn components

`badge · button · card · command · dialog · dropdown-menu · input ·
input-group · label · popover · scroll-area · select · separator · sheet ·
table · tabs · textarea · tooltip`

## Query helpers exposed by `lib/db.ts`

### Agencies
- `getAgencies()` — agencies that actually have inventory data
- `getAllAgenciesIncludingEmpty()` — every row in `agencies`
- `getAgencyByAbbr(abbr)` — single agency + maturity
- `getAgencyById(id)` — single agency + maturity
- `getAgencyMaturity()` — every maturity row joined with its agency

### Global
- `getGlobalStats()` — header tiles / About page totals

### Use cases
- `getUseCasesForAgency(agencyId)`
- `getUseCaseBySlug(slug)`
- `getUseCaseById(id)`
- `getUseCasesFiltered(filters)` — explorer page; supports agency, stage,
  classification, high-impact, product/template/vendor, free-text search,
  and tag-level facets (entry type, deployment scope, sophistication,
  is_coding_tool, is_generative_ai). Returns `{ rows, total }`.

### Consolidated use cases
- `getConsolidatedForAgency(agencyId)`

### Products / templates
- `getAllProducts()` — with usage counts
- `getProductById(id)` — with aliases + deploying agencies
- `getTopProducts(n)` — by agency count
- `getAllTemplates()` — with usage counts
- `getTemplateById(id)` — with agencies + products using it

### Per-agency breakdowns (for charts)
- `getBureauBreakdown(agencyId)`
- `getEntryTypeBreakdown(agencyId)`
- `getAISophisticationBreakdown(agencyId)`
- `getDeploymentScopeBreakdown(agencyId)`
- `getProductsForAgency(agencyId)`

### Cross-cutting analytics
- `getYoYGrowthData()`
- `getVendorMarketShare()`
- `getProductAgencyHeatmap()`
- `getCodingToolAgencies()`
- `getEnterpriseLLMAgencies()`

All query functions use prepared statements and return typed rows.

---

## Build history

The dashboard was built across seven agent passes (scaffold → polish). The
detailed handoff notes for each pass live in
[`docs/AGENT_HISTORY.md`](docs/AGENT_HISTORY.md). They're useful for tracing
how a particular page or component came to exist; they are **not**
authoritative documentation of the current code — for that, read this README
and the source.
