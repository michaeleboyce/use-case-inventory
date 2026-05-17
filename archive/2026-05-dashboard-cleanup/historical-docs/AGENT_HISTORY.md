# Agent handoff notes — build chronology

Historical record of the multi-agent build pass that produced this dashboard.
Sections are dated by agent number, not calendar date. Useful for archaeology
(e.g., "where did the heatmap come from?") but **not** authoritative as
current architecture documentation — see the main `README.md` for that.

This scaffold was produced by **Agent 1 (Scaffolder)**.

### Agent 1 — Scaffolder ✅
- Next.js 16 project structure confirmed and working.
- `lib/db.ts`, `lib/types.ts`, `lib/formatting.ts` complete.
- Top navigation, root layout, homepage smoke test in place.
- shadcn/ui components installed.
- `npm run build` passes; `npm run dev` serves homepage with live DB counts.

### Agent 2 — Homepage & Agencies ✅

**Pages**
- `app/page.tsx` — homepage dashboard. Hero headline + four hero metric tiles
  (total use cases, agencies reporting, distinct products deployed summed
  across maturity rows, coding-tool entry count). Maturity tier distribution
  card (four color-accented blocks linking to `/agencies?tier=<tier>`). Top-10
  products horizontal bar chart (clickable → `/products/[id]`). Agency type
  × maturity stacked bar chart. "Agencies without enterprise LLM" and
  "Agencies without coding assistants" gap lists. Five most-recently-modified
  agencies.
- `app/agencies/page.tsx` — full directory. Top stats strip (enterprise-LLM
  coverage, coding tools, leading tier, custom-AI-heavy). Filter bar with
  URL-param syncing (type, tier, LLM tri-state, coding tri-state, search).
  Sortable `@tanstack/react-table` with columns for name+abbr, type, use
  cases (combined counts), products, maturity, YoY growth, enterprise LLM,
  coding tools, status. Row click → `/agencies/[abbr]`.

**Components added**
- `components/metric-tile.tsx` — hero tile with accent color.
- `components/maturity-tier-card.tsx` — clickable per-tier block with
  abbreviation chips.
- `components/agencies-table.tsx` — client-side filterable/sortable table
  with URL-param sync.
- `components/charts/top-products-chart.tsx` — Recharts horizontal bar,
  click-through to product detail.
- `components/charts/agency-type-chart.tsx` — Recharts stacked bar.

**New `lib/db.ts` helpers**
- `getMaturityTierSummary()` — tier → `{ count, agencies[] }` groups for the
  homepage tier card. Ordered leading → progressing → early → minimal →
  none.
- `getAgencyTypeByTier()` — pivot of agency_type rows with per-tier columns
  for the stacked bar chart.
- `getRecentlyModifiedAgencies(n)` — top-N agencies by `last_modified`
  (excludes NULLs).

**Status**
- `npx tsc --noEmit` clean for every file I touched.
  (Three pre-existing Recharts Tooltip-formatter type errors in charts
  authored by another agent remain; they are unrelated.)

### Agent 3 — Agency detail page ✅

Built the `/agencies/[abbr]` route — the richest single-page view in the
app.

**Pages**
- `app/agencies/[abbr]/page.tsx` — Server Component. Uses Next.js 16 async
  `params`. Calls `notFound()` when the abbreviation does not resolve.
  Exports a matching `generateMetadata` for per-agency `<title>`. Layout:
  header band → 7-tile quick stats (including up/down-colored YoY) → three
  portfolio charts (entry type donut, AI sophistication donut, deployment
  scope horizontal bar) → capability flags → products deployed grid →
  bureau/component breakdown → tabs for individual vs. consolidated use
  cases → notes & methodology card (schema compliance, last modified,
  source files, agency + maturity notes).

**New components**
- `components/agency-header.tsx` — header band with large abbreviation
  tile, H1, maturity / type / status / year badges, and external links to
  the inventory page and source CSV (Server Component).
- `components/capability-flags.tsx` — check / cross / unknown grid for the
  four binary maturity flags (enterprise LLM, coding assistants, agentic
  AI, custom AI).
- `components/product-grid.tsx` — reusable product-card grid (cards link
  to `/products/[id]`). Designed to be reused on template and analytics
  pages.
- `components/bureau-breakdown.tsx` — client component; renders bureau
  rows with inline percent bars and an expand toggle (top 15 → all).
- `components/agency-use-cases-table.tsx` — client component; exports
  both `IndividualUseCasesTable` and `ConsolidatedUseCasesTable`. Both are
  filterable (free-text search; individual table also has a stage
  dropdown). Shares entry-type and deployment-scope color maps for
  badges.
- `components/charts/donut-chart.tsx` — reusable Recharts `PieChart`
  wrapper with a center label, color-map support, palette fallback, and
  an empty state. Used for entry type + AI sophistication donuts.
- `components/charts/horizontal-bar-chart.tsx` — reusable horizontal
  Recharts `BarChart` with color-map support. Used for deployment scope.

**DB helpers**
No new helpers were needed — every query on this page uses helpers Agent
1 already shipped: `getAgencyByAbbr`, `getUseCasesForAgency`,
`getConsolidatedForAgency`, `getProductsForAgency`,
`getBureauBreakdown`, `getEntryTypeBreakdown`,
`getAISophisticationBreakdown`, `getDeploymentScopeBreakdown`.

**Status**
- `npx tsc --noEmit` is clean for every file I added. The three
  pre-existing Recharts `Tooltip.formatter` errors in Agent 2's charts
  (`capability-category-chart.tsx`, `vendor-share-chart.tsx`,
  `yoy-growth-chart.tsx`) remain — they are unrelated to this agent's
  work.

### Agent 4 — Use Cases Explorer & Detail ✅

Built the master list at `/use-cases` and the detail view at
`/use-cases/[slug]` — the heaviest filter surface in the dashboard.

**Pages**
- `app/use-cases/page.tsx` — Server Component. Reads filters out of the
  async `searchParams` prop and calls `getUseCasesFiltered()`. Renders
  either a sortable table or a responsive card grid. 100 rows per page;
  pagination via `?page=`. Sidebar filter panel is sticky on desktop.
- `app/use-cases/[slug]/page.tsx` — Server Component. Resolves a slug to
  either an individual (`use_cases`) or a consolidated
  (`consolidated_use_cases`) entry via
  `getUseCaseOrConsolidatedBySlug`. Individual view has 11 sections
  (header, summary, AI classification, problem & benefits,
  documentation, data & code, risk management 2-col DL, analytical
  tags, linked product, linked template, raw JSON). Sidebar shows five
  related use cases from the same agency, product, and template.

**Filter URL params (all sync to the sidebar)**

| Param              | Kind               | Notes                                    |
| ------------------ | ------------------ | ---------------------------------------- |
| `q`                | text               | name / problem / system outputs / vendor |
| `agency_ids`       | CSV of numeric ids |                                          |
| `agency_type`      | CSV                | CFO_ACT / INDEPENDENT / LEGISLATIVE      |
| `product_ids`      | CSV                |                                          |
| `entry_type`       | CSV                |                                          |
| `sophistication`   | CSV                |                                          |
| `scope`            | CSV                |                                          |
| `architecture`     | CSV                |                                          |
| `use_type`         | CSV                |                                          |
| `high_impact`      | CSV                |                                          |
| `coding_tool`      | `1` / absent       |                                          |
| `general_llm_access` | `1` / absent     |                                          |
| `genai`            | `1` / absent       |                                          |
| `public_facing`    | `1` / absent       |                                          |
| `has_ato`          | `1` / absent       |                                          |
| `risk_docs`        | `1` / absent       |                                          |
| `view`             | `table` / `grid`   |                                          |
| `page`             | integer ≥ 1        |                                          |

**New `lib/db.ts` helpers** (append-only; other agents unaffected):
- `getUseCaseFacets()` — distinct enum values per filter column.
- `getAgencyOptions()` — lightweight `{id, name, abbreviation}` list.
- `getProductOptions()` — lightweight `{id, canonical_name, vendor}`.
- `getConsolidatedBySlug(slug)` — detail view for consolidated entries.
- `getUseCaseOrConsolidatedBySlug(slug)` — unified slug resolver.
- `getRelatedByAgency(agencyId, excludeId, limit)`.
- `getRelatedByProduct(productId, excludeId, limit)`.
- `getRelatedByTemplate(templateId, excludeId, limit)`.

`getUseCasesFiltered()` gained multi-value filters: `agencyIds`,
`agencyTypes`, `entryTypes`, `deploymentScopes`, `aiSophistications`,
`architectureTypes`, `useTypes`, `highImpactDesignations`, `productIds`,
plus the booleans `isGeneralLLMAccess`, `isPublicFacing`,
`hasATOorFedRAMP`, `hasMeaningfulRiskDocs`. Single-value
properties and all previous callers still work unchanged. Search also
now matches `vendor_name`.

**New components**
- `components/use-case-filters.tsx` — client sidebar with collapsible
  groups and searchable agency + product pickers.
- `components/use-case-table.tsx` — client table with per-column sort.
- `components/use-case-grid.tsx` — server-rendered grid wrapper.
- `components/use-case-card.tsx` — server-rendered card used by the
  grid and related-use-case rails.
- `components/use-case-explorer-toolbar.tsx` — `ViewToggle`,
  `ExportCsvButton`, `Pagination` (all client).
- `components/raw-json-viewer.tsx` — client collapsible pretty printer
  with copy-to-clipboard. XSS-safe: HTML-escapes input before
  regex-based tokenization.
- `components/tag-definition-list.tsx` — server-rendered definition
  list for all 30+ analytical-tag fields with human explanations.
- `components/related-use-cases.tsx` — small RSC rail list.

**Status**
- `npx tsc --noEmit` — 0 errors across the project.

### Agent 5 — Products & Templates explorers ✅

Shipped four pages and their supporting components:

**Pages**
- `app/products/page.tsx` — server-rendered grid wrapped by a client-side
  filter component; vendor market-share chart at the top.
- `app/products/[id]/page.tsx` — full product detail (aliases, parent/child
  products, stats, per-agency table, linked use cases, "more from vendor").
  Uses `generateStaticParams` so every product page is prerendered.
- `app/templates/page.tsx` — OMB Appendix B template cards, capability
  category chart, explainer card.
- `app/templates/[id]/page.tsx` — full template text, agencies using, products
  paired, and a per-entry table covering both `use_cases` and
  `consolidated_use_cases` rows. Also uses `generateStaticParams`.

**Components**
- `components/product-card.tsx`, `components/template-card.tsx` (server).
- `components/products-filters.tsx`, `components/templates-filters.tsx`
  (client — search + vendor/type/category dropdowns, toggles for Frontier
  LLM / Generative AI, sort dropdown, result count, empty state).
- `components/charts/vendor-share-chart.tsx` — per task spec, Recharts bar
  chart of vendors × agency counts (rendered above the products grid).
- `components/charts/capability-category-chart.tsx` — Recharts bar chart of
  capability categories × use case counts (above the templates grid).

**DB helpers appended to `lib/db.ts`** (all use prepared statements):
- `getChildProducts(parentId)`
- `getUseCasesForProduct(productId)` — joined with agency / template / tags
- `getConsolidatedCountForProduct(productId)`
- `getProductsByVendor(vendor, excludeId)`
- `getProductNamesById()` — `{ id → canonical_name }` lookup for parent
  labels on cards
- `getEntriesForTemplate(templateId)` + `TemplateEntryRow` — deduped union
  of `use_cases` and `consolidated_use_cases` rows keyed to a template

**Notes**
- `params` and `searchParams` are awaited in the App Router promise form.
- I used inline `{ params: Promise<{ id: string }> }` prop types rather
  than the generated `PageProps<'/route'>` helper because `PageProps` is
  only populated after `next typegen` / `next dev` / `next build`; the
  task acceptance command is `npx tsc --noEmit`, which runs before those
  generate the literal-route map. This keeps the typecheck green on a
  cold checkout.
- Filter components keep all state client-side and filter the full
  (already-loaded) product/template lists in-memory. That works because
  the tables are small (~45 products, ~20 templates).

**Status**
- `npx tsc --noEmit` is clean for every file I added
  (`app/products/**`, `app/templates/**`, the four new `components/*.tsx`,
  and the two new charts). The remaining errors flagged by `tsc` are in
  Agent 2's charts (`entry-type-mix-chart`, `maturity-scatter`,
  `yoy-growth-chart`) — pre-existing and unrelated.

### Agent 6 — Analytics deep dive ✅

Built `app/analytics/page.tsx` as a long-form, data-journalism-style report
with a sticky table of contents and ten chart sections, each in its own
shadcn `Card`. Everything fetches server-side from SQLite and is passed as
plain serializable props to Client chart components (Recharts needs the
browser).

**Page sections (anchored for the TOC)**
1. Headline insights — six `InsightCard`s (CFO Act enterprise LLM
   coverage, GitHub Copilot reach, top-product reach, zero-coding agencies,
   distinct products total, NASA YoY outlier).
2. Year-over-year growth bar chart (Top 20 / Bottom 20 / All toggle).
3. Vendor market share (dual-panel: reach × footprint).
4. Product × agency heatmap (15 × 20, click a cell to filter use cases).
5. Maturity × growth scatter (colored by tier, growth clamped at +500%).
6. Architecture distribution donut + LLM vendor share donut side-by-side.
7. Coding tool adoption leaderboard + Enterprise LLM distribution
   leaderboard side-by-side.
8. Entry-type-mix 100%-stacked bars (percent / absolute toggle).

**New Client Chart components** under `components/charts/`
- `yoy-growth-chart.tsx` — horizontal bar chart, green/red/violet by sign
  and magnitude, with view-mode buttons.
- `vendor-share-chart.tsx` — rewritten into a two-panel "Agencies using"
  vs "Total entries" view with distinct per-vendor colors (Microsoft blue,
  OpenAI emerald, Anthropic amber, Google red, Amazon orange).
- `product-heatmap.tsx` — HTML grid (not SVG) for product × agency
  adoption, with click-through to `/use-cases?agency=…&product=…`.
- `maturity-scatter.tsx` — Recharts ScatterChart; custom tooltip shows
  agency + growth + total; growth clamped at +500% so NASA doesn't flatten
  everyone else.
- `architecture-donut.tsx` — exports `ArchitectureDonut` and
  `LLMVendorDonut` — thin wrappers around `donut-chart.tsx`.
- `coding-leaderboard.tsx` — a reusable ranked-bar list component; used
  for both the coding leaderboard and the enterprise-LLM distribution.
- `entry-type-mix-chart.tsx` — 100%-stacked horizontal bar with
  percent/absolute toggle and 15/25/All size toggle.

**New shared UI component**
- `components/insight-card.tsx` — big-stat callout card with accent border.

**New DB helpers in `lib/db.ts`**
- `getProductAgencyMatrix(topProducts, topAgencies)` — dense heatmap input.
- `getArchitectureDistribution()` — `tag.architecture_type` counts.
- `getLLMVendorShare()` — vendor tally restricted to general-LLM tags.
- `getEntryTypeMixByAgency()` — per-agency raw counts across five known
  entry types + `unknown`.
- `getAnalyticsInsights()` — pre-computed headline stats.
- `getMaturityScatterData()` — agency × maturity joined rows.

**Status**
- `npx tsc --noEmit` passes cleanly (0 errors across the whole project).

### Agent 7 — Polish, Compare & About ✅

Final pass: two new pages, a command palette, a site footer, mobile
collapsing for the explorer filters, a hero gradient, and empty-state
polish.

**Pages**
- `app/compare/page.tsx` — side-by-side agency comparison. Pick 2–4
  agencies via a searchable picker; selection is URL-synced as repeated
  `?a=` params so the view is shareable. Renders: a 13-row metric grid
  (totals, capability counts, percentages, YoY growth, binary flags) with
  sticky row labels; 100%-stacked entry-type strips per agency; a row of
  AI-sophistication donuts; a row of top-5 product lists. Empty state
  offers three quick-start comparisons (HHS vs DHS, VA · USDA · DOJ, and
  a four-way science-agency view).
- `app/about/page.tsx` — methodology / data sources. Seven schema-reference
  cards with plain-English explanations for every `use_case_tags` column,
  a "how we collected" card, a "how we tagged" card describing the
  three-pass auto-tagger → sub-agent → cross-reference pipeline, a known
  data-quality issues section (EAC 16,364 phantom columns, DOJ
  non-breaking spaces, HHS CDC ChatGPT gap, etc.), a data-sources list
  linking to OMB M-25-21 + AI.gov + every agency inventory page, and a
  credit card. Last-updated timestamp at the top.

**New components**
- `components/command-palette.tsx` — `CommandPalette` (⌘K / Ctrl+K
  dialog) and `CommandPaletteHint` (small nav-bar trigger button that
  dispatches a synthetic keydown). Fuzzy search over agencies, products,
  templates, and up to 300 use cases, plus quick links to every major
  route. Data is pulled server-side in the root layout and passed in as
  a serializable prop.
- `components/compare-picker.tsx` — multi-select agency picker with chips,
  typeahead, dropdown, and URL sync. Caps selection at four.
- `components/footer.tsx` — site footer with last-updated timestamp, an
  AI.gov external link, and cross-links to About + Compare.
- `components/mobile-filters-sheet.tsx` — wraps children with a shadcn
  `Sheet` (bottom-anchored) on mobile, renders inline on `lg:+`. Applied
  to the `/use-cases` explorer sidebar.

**Layout / polish**
- `app/layout.tsx` now mounts the palette (⌘K works from any page) and
  the footer; pulls `getCommandPaletteIndex()` and
  `getLastUpdatedDate()` once on the server.
- `components/navigation.tsx` — adds the palette hint (right-aligned
  search chip); nav bar was already sticky via `sticky top-0 z-40`.
- Homepage hero now sits inside a soft blue → violet gradient card with
  two decorative blurred blobs.
- `/use-cases` empty states ("no results") now include a **Clear filters**
  action that links back to the unfiltered route.
- `/agencies` wraps its URL-driven table in a `<Suspense>` so the static
  prerender pass doesn't bail out on `useSearchParams()`.

**New `lib/db.ts` helpers**
- `getLastUpdatedDate()` — `MAX(agencies.date_accessed)` for the footer
  / About timestamp.
- `getAgencyInventoryLinks()` — agencies with an `inventory_page_url`
  (for the About data-sources list).
- `getAgencyCompareData(abbr)` + `AgencyCompareData` type — the full
  comparison payload (metrics, entry-type mix, AI sophistication mix,
  top 5 products) in one call.
- `getCommandPaletteIndex(useCaseLimit)` + `CommandPaletteIndex` type —
  minimal lists of agencies, products, templates, and up to 500 use
  cases (slug-only) for client-side fuzzy matching.

**Status**
- `npx tsc --noEmit` — 0 errors.
- `npm run build` succeeds; all 76 routes are generated (`/about` and
  the homepage are static; `/compare` is dynamic because it reads
  `searchParams`). Recharts' SSR-dimension warnings are pre-existing and
  expected.
