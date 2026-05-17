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
