"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * FedRAMP sub-area tabs (Marketplace / Coverage).
 *
 * Replaces the layout's header-sniffing active-state detection
 * (`x-invoke-path` / `x-pathname` are best-effort Next internals and
 * unreliable across versions) with a client `usePathname()` — same
 * visual, dependable highlight. The link list itself is static, so the
 * server still renders the tabs; only the active flag hydrates in.
 */
const SUB_AREAS: Array<{ href: string; label: string; prefix: string }> = [
  {
    href: "/fedramp/marketplace",
    label: "Marketplace",
    prefix: "/fedramp/marketplace",
  },
  {
    href: "/fedramp/coverage",
    label: "Coverage",
    prefix: "/fedramp/coverage",
  },
];

export function FedrampTabs() {
  const pathname = usePathname() ?? "/fedramp";

  return (
    <nav
      aria-label="FedRAMP sub-areas"
      className="mt-6 flex items-stretch gap-0 overflow-x-auto border-b border-border/70"
    >
      {SUB_AREAS.map((tab) => {
        const isActive = pathname.startsWith(tab.prefix);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            data-active={isActive ? "true" : undefined}
            className="group relative -mb-px flex items-baseline gap-2 whitespace-nowrap border-b-2 border-transparent px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground data-[active=true]:border-[var(--stamp)] data-[active=true]:text-foreground md:px-4"
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
