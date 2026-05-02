/**
 * §VII landing — a 50/50 split sending visitors to the two sub-areas.
 * Marketplace = the read-only ledger of FedRAMP itself; Coverage =
 * the cross-reference view against the inventory.
 */

import Link from "next/link";
import { Eyebrow } from "@/components/editorial";
import { getFedrampSnapshot } from "@/lib/db";
import { formatNumber } from "@/lib/formatting";

export const metadata = {
  title: "FedRAMP · Federal AI Use Case Inventory",
};

export default function FedrampLandingPage() {
  const snapshot = getFedrampSnapshot();

  return (
    <section className="ink-in">
      <div className="mb-3 flex items-baseline justify-between gap-4 border-b border-border pb-2">
        <Eyebrow color="stamp">Choose a view</Eyebrow>
        <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
          Two sub-areas
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Link
          href="/fedramp/marketplace"
          className="group block border border-border p-6 transition-colors hover:border-foreground"
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground group-hover:text-foreground">
              Marketplace
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Open →
            </span>
          </div>
          <h2 className="mt-3 font-display italic text-[1.8rem] leading-[1] tracking-[-0.02em] text-foreground group-hover:text-[var(--stamp)] md:text-[2.2rem]">
            The FedRAMP ledger.
          </h2>
          <p className="mt-3 max-w-[40ch] text-sm leading-relaxed text-foreground/80">
            Every cloud-service offering, every provider, every authorizing
            agency, every 3PAO — sourced live from the marketplace snapshot,
            laid out as an editorial dossier.
          </p>
          {snapshot ? (
            <dl className="mt-5 grid grid-cols-3 gap-3 font-mono text-[11px]">
              <div className="border-t-2 border-foreground pt-1.5">
                <dt className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                  Products
                </dt>
                <dd className="font-display italic text-[1.4rem] leading-[1] tabular-nums text-foreground">
                  {formatNumber(snapshot.product_count)}
                </dd>
              </div>
              <div className="border-t-2 border-foreground pt-1.5">
                <dt className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                  ATOs
                </dt>
                <dd className="font-display italic text-[1.4rem] leading-[1] tabular-nums text-foreground">
                  {formatNumber(snapshot.ato_event_count)}
                </dd>
              </div>
              <div className="border-t-2 border-foreground pt-1.5">
                <dt className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                  Agencies
                </dt>
                <dd className="font-display italic text-[1.4rem] leading-[1] tabular-nums text-foreground">
                  {formatNumber(snapshot.agency_count)}
                </dd>
              </div>
            </dl>
          ) : null}
          <div aria-hidden className="mt-5 h-1.5 bg-[var(--ink)]" />
        </Link>

        <Link
          href="/fedramp/coverage"
          className="group block border border-border p-6 transition-colors hover:border-foreground"
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground group-hover:text-foreground">
              Coverage
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Open →
            </span>
          </div>
          <h2 className="mt-3 font-display italic text-[1.8rem] leading-[1] tracking-[-0.02em] text-foreground group-hover:text-[var(--stamp)] md:text-[2.2rem]">
            Inventory × FedRAMP.
          </h2>
          <p className="mt-3 max-w-[40ch] text-sm leading-relaxed text-foreground/80">
            Which inventory products are FedRAMP-authorized, which agencies
            are using AI tools without an authorization at the right impact
            level, and which authorized products aren&rsquo;t showing up in
            agency inventories.
          </p>
          <p className="mt-5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
            Vendor coverage · Authorization fit · Agency gaps · Unused tools
          </p>
          <div aria-hidden className="mt-5 h-1.5 bg-[var(--stamp)]" />
        </Link>
      </div>
    </section>
  );
}
