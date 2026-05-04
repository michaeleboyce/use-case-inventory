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
 *    /products. Active-state highlight via a single shared
 *    IntersectionObserver keyed off the tab `id`s. The tab whose target
 *    section is most visible (and whose center has crossed the upper third
 *    of the viewport) gets `data-active="true"` and renders with a
 *    [var(--stamp)] bottom-border + foreground text. Threshold 0.5 with
 *    rootMargin "-30% 0px -50% 0px" so the active flips when the section
 *    center crosses the upper third of viewport.
 */

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type PageSubnavTab = {
  /** The fragment id of the target section (without the `#`). */
  id: string;
  /** Display label. Should match the section's title or be a shorter form. */
  label: string;
};

export function PageSubnav({ tabs }: { tabs: PageSubnavTab[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  // Track per-id intersection ratios so we can pick the most-visible target.
  const ratiosRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (tabs.length === 0) return;

    const elements: HTMLElement[] = [];
    for (const tab of tabs) {
      const el = document.getElementById(tab.id);
      if (el) {
        elements.push(el);
        ratiosRef.current.set(tab.id, 0);
      }
    }
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).id;
          ratiosRef.current.set(id, entry.intersectionRatio);
        }
        // Pick the id with the highest intersection ratio. If nothing's
        // intersecting (all ratios 0), leave the previous active state alone
        // — avoids flicker when scrolling fast between sections.
        let best: { id: string; ratio: number } | null = null;
        for (const [id, ratio] of ratiosRef.current) {
          if (best == null || ratio > best.ratio) {
            best = { id, ratio };
          }
        }
        if (best && best.ratio > 0) {
          setActiveId(best.id);
        }
      },
      {
        threshold: 0.5,
        rootMargin: "-30% 0px -50% 0px",
      },
    );

    for (const el of elements) {
      observer.observe(el);
    }

    return () => {
      observer.disconnect();
      ratiosRef.current.clear();
    };
  }, [tabs]);

  if (tabs.length === 0) return null;
  return (
    <nav
      aria-label="On this page"
      className="sticky top-[5.5rem] z-30 -mx-4 mb-6 border-b border-border bg-background/92 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/75 md:-mx-8 md:px-8"
    >
      <ul className="flex items-stretch gap-0 overflow-x-auto">
        {tabs.map((tab) => {
          const active = activeId === tab.id;
          return (
            <li key={tab.id} className="flex items-stretch">
              <Link
                href={`#${tab.id}`}
                data-active={active ? "true" : undefined}
                aria-current={active ? "true" : undefined}
                className={
                  "flex items-center whitespace-nowrap border-b-2 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors md:px-4 " +
                  (active
                    ? "border-[var(--stamp)] text-foreground"
                    : "border-transparent text-muted-foreground hover:border-[var(--stamp)] hover:text-foreground")
                }
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
