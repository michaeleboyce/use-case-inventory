/**
 * §VII shell for the FedRAMP section. Houses the masthead (kicker, serif h1,
 * lede), the sub-area tabs ("Marketplace" / "Coverage"), and a snapshot-date
 * footer rendered beneath every child route.
 *
 * Server Component. Tabs are simple <Link>s that highlight the active
 * sub-area via path matching (no client JS required).
 */

import type { ReactNode } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { getFedrampSnapshot } from "@/lib/db";
import { formatDate } from "@/lib/formatting";

const SUB_AREAS: Array<{
  href: string;
  label: string;
  prefix: string;
  description: string;
}> = [
  {
    href: "/fedramp/marketplace",
    label: "Marketplace",
    prefix: "/fedramp/marketplace",
    description:
      "The FedRAMP marketplace ledger — products, providers, agencies, assessors.",
  },
  {
    href: "/fedramp/coverage",
    label: "Coverage",
    prefix: "/fedramp/coverage",
    description:
      "How the inventory's products and use cases line up against FedRAMP authorizations.",
  },
];

export default async function FedrampLayout({
  children,
}: {
  children: ReactNode;
}) {
  const snapshot = getFedrampSnapshot();
  const h = await headers();
  // Next 16 sets x-pathname / next-url for routing context; both are best-
  // effort. Fall back to "/fedramp/marketplace" so the Marketplace tab is
  // marked active on the section landing.
  const path =
    h.get("x-invoke-path") ??
    h.get("x-pathname") ??
    h.get("next-url") ??
    "/fedramp/marketplace";

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pt-10 pb-6 md:px-8 md:pt-14">
      {/* ----------------------------------------------------------------- */}
      {/* Section masthead (kicker, serif h1, lede)                          */}
      {/* ----------------------------------------------------------------- */}
      <header className="ink-in grid grid-cols-12 gap-x-6 border-b border-border pb-8">
        <aside className="col-span-12 mb-6 md:col-span-3 md:mb-0">
          <div className="space-y-2">
            <div className="eyebrow !text-[var(--stamp)]">§ VII · FedRAMP</div>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Cloud authorizations · 2026
            </div>
            {snapshot ? (
              <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
                Snapshot {formatDate(snapshot.snapshot_date)}
              </div>
            ) : null}
          </div>
        </aside>

        <div className="col-span-12 md:col-span-9">
          <h1 className="font-display italic text-[clamp(2.4rem,6vw,4.6rem)] leading-[0.95] tracking-[-0.02em] text-foreground">
            FedRAMP,{" "}
            <span className="relative inline-block">
              <span
                aria-hidden
                className="absolute inset-x-[-0.06em] bottom-[0.16em] h-[0.36em] bg-[var(--highlight)]/85"
              />
              <span className="relative">cross-referenced.</span>
            </span>
          </h1>
          <p className="mt-6 max-w-[64ch] text-[1.02rem] leading-[1.55] text-foreground/85">
            A read-only mirror of the FedRAMP marketplace, plus a coverage
            view that asks the questions journalists and agency staff actually
            ask: which AI products in the inventory are authorized? Are
            agencies sitting on capability they aren&rsquo;t reporting?
          </p>
        </div>
      </header>

      {/* ----------------------------------------------------------------- */}
      {/* Sub-area tabs                                                      */}
      {/* ----------------------------------------------------------------- */}
      <nav
        aria-label="FedRAMP sub-areas"
        className="mt-6 flex items-stretch gap-0 overflow-x-auto border-b border-border/70"
      >
        {SUB_AREAS.map((tab) => {
          const isActive = path.startsWith(tab.prefix);
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

      {/* ----------------------------------------------------------------- */}
      {/* Sub-area content                                                   */}
      {/* ----------------------------------------------------------------- */}
      <div className="mt-6">{children}</div>

      {/* ----------------------------------------------------------------- */}
      {/* Snapshot footer                                                    */}
      {/* ----------------------------------------------------------------- */}
      {snapshot ? (
        <footer className="mt-16 border-t border-border pt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <span className="text-foreground">Snapshot</span> ·{" "}
          {formatDate(snapshot.snapshot_date)} · {snapshot.product_count}{" "}
          products · {snapshot.ato_event_count} ATO events ·{" "}
          {snapshot.csp_count} providers · {snapshot.agency_count} agencies ·{" "}
          {snapshot.assessor_count} 3PAOs
        </footer>
      ) : null}
    </div>
  );
}
