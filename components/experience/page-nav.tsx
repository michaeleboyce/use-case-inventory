"use client";

import * as React from "react";

/**
 * Sticky in-page navigation for /experience. A horizontal strip pinned just
 * below the page-header dateline, with anchor links to each numbered section.
 * Lets readers jump between the five sections without scrolling — the page
 * is ~6 viewports tall on a 1440 monitor.
 */
type NavItem = { href: string; label: string; kicker: string };

const ITEMS: NavItem[] = [
  { href: "#section-01", label: "How much GenAI", kicker: "01" },
  { href: "#section-02", label: "When did it land", kicker: "02" },
  { href: "#section-03", label: "Who has what", kicker: "03" },
  { href: "#section-04", label: "Estimated seats", kicker: "04" },
  { href: "#section-05", label: "What's missing", kicker: "05" },
];

export function PageNav() {
  const [active, setActive] = React.useState<string>("section-01");

  // Update the active section as the reader scrolls. Uses IntersectionObserver
  // on the section anchors so the bottom-of-section gets a slight grace period.
  React.useEffect(() => {
    const elements = ITEMS.map((item) =>
      document.getElementById(item.href.slice(1)),
    ).filter((el): el is HTMLElement => !!el);
    if (elements.length === 0) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-30% 0px -50% 0px", threshold: 0 },
    );
    elements.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <nav
      aria-label="On-page sections"
      className="sticky top-[3.5rem] z-30 -mx-4 mb-4 mt-4 border-b border-border bg-background/95 px-4 backdrop-blur md:-mx-8 md:px-8"
    >
      <ol className="-mb-px flex flex-wrap items-stretch gap-0 text-sm">
        {ITEMS.map((item) => {
          const id = item.href.slice(1);
          const isActive = active === id;
          return (
            <li key={item.href}>
              <a
                href={item.href}
                aria-current={isActive ? "true" : undefined}
                className={
                  "group flex items-baseline gap-2 whitespace-nowrap border-b-2 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors md:px-4 " +
                  (isActive
                    ? "border-[var(--stamp)] text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground")
                }
              >
                <span
                  aria-hidden
                  className={
                    "text-[9px] " +
                    (isActive
                      ? "text-[var(--stamp)]"
                      : "text-muted-foreground/70")
                  }
                >
                  §{item.kicker}
                </span>
                <span>{item.label}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
