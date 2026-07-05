# TODO — Mobile navigation (deferred 2026-07-05)

Deferred from the July 2026 site-wide refactor by explicit scope decision
(user chose "make a dated TODO file" over building it now).

## Problem

- The top nav has **no hamburger / mobile menu**. On narrow viewports the
  section rail (`components/navigation.tsx`) simply `flex-wrap`s to
  multiple rows, which can occupy a large share of a phone viewport.
- All dropdowns (Readiness, FedRAMP, Browse, the overflow menu) are
  **CSS-only hover/focus-within** menus. On touch devices there is no
  hover, so the ~15 indented FedRAMP drill-downs and the overflow items
  are effectively unreachable by touch (a tap on the trigger navigates
  to the trigger's href instead of opening the menu).
- `overflow-x-auto` is intentionally absent from the rail (it would clip
  the absolutely-positioned dropdowns) — see the comment in
  `components/navigation.tsx`.

## Future work

1. Add a disclosure-based mobile menu (sheet or accordion) behind a
   hamburger visible below `md:` — `components/ui/sheet.tsx` (shadcn)
   already exists in the repo.
2. Convert the hover menus to click-toggle menus using
   `@base-ui/react`'s menu primitive so desktop keyboard/touch behavior
   is consistent; keep the CSS-only fallback for no-JS rendering if
   practical.
3. Drive both desktop rail and mobile menu from the single IA registry
   (`lib/nav.ts`) so they can't drift.
4. Test matrix: iOS Safari + Android Chrome, phone + tablet widths;
   keyboard-only pass (tab through triggers, arrow within menus);
   VoiceOver spot-check on menu roles.

## Also deferred here: filter state-model unification

The three filter implementations intentionally kept their different
state models during the refactor (only the visual control was unified
via `components/ui/filter-select.tsx`):

- `components/use-case/filters/index.tsx` — URL-param-driven (the
  reference implementation; shareable URLs).
- `components/product/products-filters.tsx` — client `useState`.
- `components/template/templates-filters.tsx` — client `useState`.

Future work: migrate products/templates filters to the URL-param model
so every filtered view is shareable, matching /use-cases.
