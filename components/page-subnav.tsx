/**
 * PageSubnav — sticky in-page section navigation.
 *
 * Sits below the global Navigation header on long pages (/products,
 * /agencies, /use-cases) so readers can jump between Overview / Vendors /
 * Categories / Catalogue without scrolling. Anchor-link based: each tab's
 * `href="#section-id"` matches an `id` on a target <Section> or <header>.
 *
 * Design choices:
 *  - Sticky at `top-[var(--nav-h,4rem)]` so it tucks under the masthead.
 *    The global nav doesn't currently expose --nav-h; we approximate with
 *    `top-[5.5rem]` (matches the masthead height when it's not in
 *    sticky/condensed state) and rely on the page's natural scroll padding
 *    via scroll-margin-top on each target.
 *  - Mono uppercase pills matching the existing filter-row aesthetic on
 *    /products. No active-state highlight — that would require either
 *    IntersectionObserver (client-side, JS) or :target pseudo-class which
 *    only flips on hash navigation. Keep it simple; click-to-jump is the
 *    behavior. Active section can be added later via IntersectionObserver
 *    if reading-flow benefits from it.
 *  - No <Suspense> / no useSearchParams — pure server component, statically
 *    prerenderable.
 */

import Link from "next/link";

export type PageSubnavTab = {
  /** The fragment id of the target section (without the `#`). */
  id: string;
  /** Display label. Should match the section's title or be a shorter form. */
  label: string;
};

export function PageSubnav({ tabs }: { tabs: PageSubnavTab[] }) {
  if (tabs.length === 0) return null;
  return (
    <nav
      aria-label="On this page"
      className="sticky top-[5.5rem] z-30 -mx-4 mb-6 border-b border-border bg-background/92 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/75 md:-mx-8 md:px-8"
    >
      <ul className="flex items-stretch gap-0 overflow-x-auto">
        {tabs.map((tab) => (
          <li key={tab.id} className="flex items-stretch">
            <Link
              href={`#${tab.id}`}
              className="flex items-center whitespace-nowrap border-b-2 border-transparent px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-[var(--stamp)] hover:text-foreground md:px-4"
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
