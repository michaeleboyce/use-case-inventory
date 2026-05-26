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

**When you add a new static page under an existing nav parent** (e.g. a new
file under `app/fedramp/coverage/`, `app/fedramp/marketplace/`, `app/readiness/`,
or `app/compare-years/`), you MUST do two things — otherwise the page is
reachable only by deep link or a stat-card click on the parent hub, and
nobody using normal navigation will find it.

1. **Add an entry to the relevant array in `components/navigation.tsx`**
   (`FEDRAMP_SECTIONS`, `READINESS_SECTIONS`, `MORE`, etc.). Mark
   `indent: true` if the item sits under a parent hub; the dropdown render
   honors the flag with a left padding so the hierarchy is visually clear.
2. **Add it to the parent hub page's in-page sub-nav**. For
   `app/fedramp/coverage/page.tsx` that's the `COVERAGE_PANELS` array driving
   the `<nav aria-label="Coverage panels">` strip below the page header. For
   `app/fedramp/marketplace/page.tsx` that's the `NAV_CARDS` array of link
   tiles. Apply the same pattern when introducing a new hub.

Dynamic `[slug]` pages are exempt — they're parameterized and don't fit a
static nav. Per-page in-page sub-navs and breadcrumbs do not replace the top
nav; they complement it.
