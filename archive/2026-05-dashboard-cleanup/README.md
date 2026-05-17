# 2026-05 Dashboard Cleanup Archive

This archive holds files removed from the dashboard runtime during the May 2026
organization pass. They are preserved for traceability, but they are excluded
from TypeScript compilation and should not be imported by active app code.

## Public Starter Assets

Moved from `public/` because static import scans found no runtime references:

- `file.svg`
- `globe.svg`
- `next.svg`
- `vercel.svg`
- `window.svg`

## Historical Docs

- `AGENT_HISTORY.md` records early multi-agent build chronology. It is useful
  archaeology, but `README.md`, `AGENTS.md`, and the source are authoritative
  for current architecture and conventions.

## Unused Code

Static import scans found no active imports for these modules before archiving:

- `components/ui/card.tsx`
- `components/ui/dropdown-menu.tsx`
- `components/ui/label.tsx`
- `components/ui/popover.tsx`
- `components/ui/scroll-area.tsx`
- `components/ui/separator.tsx`
- `components/ui/tooltip.tsx`
- `lib/db/shared/query.ts`

If any archived file becomes useful again, restore it deliberately and verify
with `npm run typecheck`.
