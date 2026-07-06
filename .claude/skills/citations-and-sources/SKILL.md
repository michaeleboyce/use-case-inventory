---
name: citations-and-sources
description: Use when adding, editing, or verifying SOURCED content on the dashboard — research citations, copyable MLA references, footnotes, or wiring a new evidence-backed statistic. Covers the citation API (lib/citation.ts formatMla/mlaDate/CitationFields), the Citation and CopyCitationButton components (the "⧉ MLA" chip and its hydration caveat), the footnotes _sections pattern, which DB tables carry source rows (use_case_external_evidence, agency_ai_access_evidence, agency_workforce_profile, agency_occupation_counts), and the source-typing chips (Section source="omb"|"derived"|"mixed"). Triggered by: adding a stat that cites an external source, editing anything under a _sections/footnotes.tsx, touching components/citation.tsx or components/external-evidence.tsx, or a user asking how to copy/verify references.
---

# Citations & Sources — how sourced claims are wired

Every externally-sourced claim on the dashboard should end in a clickable
link AND a copyable MLA citation. The plumbing already exists — never
hand-format a citation string.

## The API — `lib/citation.ts`

- `CitationFields` = `{ url, title?, date?, accessed? }` — the shape every
  source row reduces to.
- `formatMla(c)` → MLA-9 no-author web-source string:
  `"Title." site, Date, URL. Accessed Date.` (these sources almost never
  have a named author; italics are dropped because citations copy as plain
  text).
- `mlaDate(iso)` → MLA month abbreviations; `hostnameOf(url)` → fallback
  display text when a title is missing.

## The components — `components/citation.tsx`

- `<Citation url title date accessed label? display? />` — inline source
  link: optional mono micro-label ("Headcount source"), dotted-underline
  external link, date, and the copy chip.
- `<CopyCitationButton text={formatMla(...)} />` — the small bordered
  **`⧉ MLA`** chip; flips to `✓ Copied` on click. It is a CLIENT component:
  it renders only after hydration, so curl/SSR-HTML checks and static
  screenshots won't show it — verify in a real browser.
- `components/external-evidence.tsx` — `ExternalEvidenceList` /
  `ExternalEvidenceBadge`: the standard rendering for
  `use_case_external_evidence` rows on use-case detail pages (status chips:
  corroborated / inventory_only / searched_no_source), MLA chips included.

## Where sources live in the DB

| Table | What it sources | Rendered by |
|---|---|---|
| `use_case_external_evidence` | Per-use-case corroboration (URL + quote + status + `captured_by` round) | detail pages §External corroboration via `lib/db/use-cases/evidence.ts` |
| `agency_ai_access_evidence` | Researched enterprise-tool access per agency | readiness/experience, `components/readiness/ai-access-table.tsx` |
| `agency_workforce_profile` / `agency_occupation_counts` | Headcount + occupation denominators (source_url/title per row) | `/experience/seats/[slug]` drill-downs, methodology source map |

New evidence rows are written on the ETL side (see the ETL repo's
`adjudication-rounds` skill — `persist_capability_evidence.py` conventions);
the dashboard only reads.

## Footnotes pattern

Narrative pages keep numbered footnotes in a route-local
`_sections/footnotes.tsx` (see `app/stories/_sections/footnotes.tsx`,
`app/fedramp/coverage/spread/_sections/footnotes.tsx`): an array of
footnote entries rendered at page bottom, each with `<Citation>` /
`CopyCitationButton`, referenced from prose by superscript anchors. New
narrative pages with sourced claims should follow this shape rather than
inlining ad-hoc links.

## Wiring a NEW sourced stat — decision guide

1. **Is the source about one use case?** → it belongs in
   `use_case_external_evidence` (ETL side), rendered automatically by the
   detail page. Don't hand-place it in the UI.
2. **Is it an agency-level research finding** (headcount, tool access)? →
   the `agency_*` evidence tables + the existing readiness/experience
   renderers.
3. **Is it a narrative/article claim on a page?** → footnote in the route's
   `_sections/footnotes.tsx` with a `<Citation>`.
4. **Is it a number derived from the DB itself?** → no external citation;
   mark provenance with the editorial `Section source="omb" | "derived" |
   "mixed"` chip and, for article-grade numbers, make sure it exists in the
   ETL fact sheet (see the `publish-and-repin` skill — pinned copy and
   population-attribution rules).

Every `date`/`accessed` you pass should come from the source row — never
invent dates; leave the field off and `formatMla` degrades gracefully.
