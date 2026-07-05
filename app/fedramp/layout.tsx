/**
 * §VII shell for the FedRAMP section. Houses the masthead (kicker, serif h1,
 * lede), the sub-area tabs ("Marketplace" / "Coverage"), and a snapshot-date
 * footer rendered beneath every child route.
 *
 * Server Component. The tabs are a small client component (FedrampTabs)
 * that derives the active sub-area from usePathname() — the previous
 * header-sniffing (x-invoke-path / x-pathname) was best-effort Next
 * internals and unreliable across versions.
 */

import type { ReactNode } from "react";
import { FedrampTabs } from "@/components/fedramp/fedramp-tabs";
import { getFedrampSnapshot } from "@/lib/db";
import { formatDate } from "@/lib/formatting";

export default async function FedrampLayout({
  children,
}: {
  children: ReactNode;
}) {
  const snapshot = getFedrampSnapshot();

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
      <FedrampTabs />

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
