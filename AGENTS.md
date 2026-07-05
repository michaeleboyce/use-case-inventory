<!-- BEGIN:nextjs-agent-rules -->
# Dashboard Agent Instructions

This `AGENTS.md` file is the authoritative project guidance for the dashboard.

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Route-local conventions

Two underscore-prefixed folder names carry meaning inside an `app/<route>/`
segment. Next.js treats both as **private** (never matched as URL segments), so
they're safe places to colocate route-specific helpers without leaking files
into the URL space.

- `_sections/` — route-specific **composed JSX** subcomponents. Use this when
  a page accumulates inline helper components (`<StatCell>`, section wrappers,
  per-page badges, etc.) that aren't reused elsewhere. Each section file is a
  React component or a tightly-scoped helper module (e.g.
  `section-numbering.ts`) consumed only by the parent `page.tsx`. Examples:
  `app/products/[id]/_sections/stat-cell.tsx`,
  `app/use-cases/[slug]/_sections/related-and-source-sections.tsx`.
- `_view-model.ts` (or, when shared across routes, `app/_view-models/<route>.ts`) —
  server-side **data shaping**. Turns parsed search params + DB calls into the
  single typed payload the page renders. Keeps `page.tsx` to: parse params →
  call view-model → render.

A route-specific component that's *only* JSX composition goes in `_sections/`.
A route-specific async function that hits the DB and returns a payload goes in
`_view-model.ts`. If a piece becomes generic enough to be reused by a sibling
route, promote it to `components/<feature>/` or `lib/`.

## Navigation discoverability

**The single IA registry is `lib/nav.ts`** — sections, roman-numeral
kickers, labels, hrefs, and dropdown children all live there.
`components/navigation.tsx` renders whatever the registry declares;
`components/breadcrumbs.tsx` derives parent trails from it via
`breadcrumbTrail()`. Never hard-code a nav link or a section numeral in a
component or page — read it from the registry (page masthead kickers should
match the registry's numerals).

**When you add a new static page under an existing nav parent** (e.g. a new
file under `app/fedramp/coverage/`, `app/fedramp/marketplace/`, `app/readiness/`,
or `app/compare-years/`), you MUST do two things — otherwise the page is
reachable only by deep link or a stat-card click on the parent hub, and
nobody using normal navigation will find it.

1. **Add an entry to the owning section's `children` array in `lib/nav.ts`**
   (or `REFERENCE_LINKS` for reference surfaces). Mark
   `indent: true` if the item sits under a parent hub; the dropdown render
   honors the flag with a left padding so the hierarchy is visually clear.
2. **Add it to the parent hub page's in-page sub-nav**. For
   `app/fedramp/coverage/page.tsx` that's the `COVERAGE_PANELS` array driving
   the `<nav aria-label="Coverage panels">` strip below the page header. For
   `app/fedramp/marketplace/page.tsx` that's the `NAV_CARDS` array of link
   tiles. Apply the same pattern when introducing a new hub. (Hub arrays
   keep local copy for their card prose, but their hrefs must match the
   registry.)

Dynamic `[slug]` pages are exempt — they're parameterized and don't fit a
static nav. Per-page in-page sub-navs and breadcrumbs do not replace the top
nav; they complement it.

## Multi-agent safety: DB and deploy

Multiple agents often work this branch in parallel. The dashboard reads
`data/federal_ai_inventory_2025.db`, which is a synced copy of the ETL
repo's DB. Two failure modes to guard against:

1. **Stale DB references in code.** Hard-coded numeric ids in URLs,
   route params, or test fixtures (`/products/17547`, `productId =
   18253`, etc.) WILL break across DB rebuilds — see the ETL repo's
   `CLAUDE.md` "Multi-agent safety" section for why. Prefer linking
   by `slug` or `canonical_name`; treat any numeric id in source code
   as a one-shot debugging convenience, not a durable contract.

2. **Before every `git commit` and `git push`:**
   - Re-run `npx tsc --noEmit` (must be clean for the area you
     touched).
   - Verify `data/federal_ai_inventory_2025.db` matches the ETL
     repo's current DB (`shasum data/federal_ai_inventory_2025.db
     ../data/federal_ai_inventory_2025.db`). If they diverge, sync
     before pushing — a stale DB shipped to Vercel breaks pages until
     the next deploy.
   - If you wrote a new query helper, smoke-test the affected route
     against the dev server (curl or Playwright). The Next build
     succeeds with broken SQL; only runtime catches it.
   - If a sibling agent committed to `main` while you were working,
     `git pull --rebase` and re-verify your changes still apply
     cleanly. Never `git push --force` to `main`.
