import Link from "next/link";
import {
  getFedrampSnapshot,
  getSleepingAuthorizationDetail,
  getSleepingAuthorizationRows,
  getSleepingAuthorizationsCounts,
  getSleepingByImpactLevel,
  getTopSleepingAgencies,
} from "@/lib/db";
import type {
  FedrampSnapshot,
  SleepingAuthorizationDetail,
  SleepingAuthorizationRow,
  SleepingByAgencyRow,
  SleepingByImpactRow,
} from "@/lib/types";
import { formatNumber, formatDate } from "@/lib/formatting";
import { Section } from "@/components/editorial";
import { EmptyState } from "@/components/empty-state";
import { SleepingTable } from "./_sections/sleeping-table";
import { SleepingByImpactChart } from "./_sections/by-impact-chart";
import { TopSleepingAgenciesChart } from "./_sections/top-agencies-chart";

export const metadata = {
  title: "Sleeping authorizations · FedRAMP × AI Inventory",
  description:
    "FedRAMP products where one agency reports an AI use case using the product but other authorizing agencies report none — agencies sitting on capability their peers have already proven useful.",
};

const IMPACT_RANK: Record<string, number> = {
  High: 3,
  Moderate: 2,
  "Li-SaaS": 1,
  Low: 0,
};

type RowWithDetail = SleepingAuthorizationRow & { _detail: SleepingAuthorizationDetail };

export default async function FedrampCoverageSleepingPage({
  searchParams,
}: {
  searchParams: Promise<{ impact?: string }>;
}) {
  const sp = await searchParams;
  const impactFilter = (sp.impact ?? "").toLowerCase();

  let rows: SleepingAuthorizationRow[] = [];
  let counts = { sleeping_pairs: 0, products_with_gap: 0, ai_used_products: 0 };
  let byImpact: SleepingByImpactRow[] = [];
  let topAgencies: SleepingByAgencyRow[] = [];
  let error: string | null = null;
  try {
    rows = getSleepingAuthorizationRows();
    counts = getSleepingAuthorizationsCounts();
    byImpact = getSleepingByImpactLevel();
    topAgencies = getTopSleepingAgencies(15);
  } catch (err) {
    error = err instanceof Error ? err.message : "Unknown error.";
  }
  const snapshot = safeSnapshot();

  // Impact-level filter chips, computed pre-filter so they stay stable.
  const distinctImpacts = Array.from(
    new Set(rows.map((r) => r.impact_level).filter((v): v is string => Boolean(v))),
  ).sort((a, b) => (IMPACT_RANK[b] ?? -1) - (IMPACT_RANK[a] ?? -1));

  const filtered = impactFilter
    ? rows.filter((r) => (r.impact_level ?? "").toLowerCase() === impactFilter)
    : rows;

  // Pre-fetch the expansion detail (lead users + sleeping authorizers) for
  // each filtered row. Bounded — most products have a handful of agencies on
  // each side; even the wide outliers stay well under the SSR budget.
  const withDetail: RowWithDetail[] = filtered.map((r) => ({
    ...r,
    _detail: getSleepingAuthorizationDetail(r.fedramp_id),
  }));

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-14 md:px-8 md:py-20">
      <header className="ink-in grid grid-cols-12 gap-x-6 border-b border-border pb-12 md:pb-16">
        <aside className="col-span-12 mb-8 md:col-span-3 md:mb-0">
          <div className="sticky top-32 space-y-2">
            <div className="eyebrow !text-[var(--stamp)]">FedRAMP → AI</div>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Sleeping authorizations
            </div>
            <Link
              href="/fedramp/coverage"
              className="block font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground hover:text-[var(--stamp)]"
            >
              ← Coverage hub
            </Link>
          </div>
        </aside>

        <div className="col-span-12 md:col-span-9">
          <h1 className="font-display text-[clamp(2.2rem,5vw,3.8rem)] leading-[0.95] tracking-[-0.03em] text-foreground">
            The authorizations <em className="italic">that aren&rsquo;t being used.</em>
          </h1>
          <p className="mt-6 max-w-prose text-[1.02rem] leading-[1.55] text-foreground/85">
            For each FedRAMP product an agency uses in an AI use case, other
            agencies often hold an ATO for the same product without reporting
            any AI use of it themselves. The lead user has already proven the
            tool works in federal AI; the sleeping authorizers have done the
            hard procurement-and-security work and could be using it the same
            way, but aren&rsquo;t. That&rsquo;s slack capacity.
          </p>
          <p className="mt-3 max-w-prose text-[0.95rem] leading-[1.55] text-foreground/75">
            <span className="font-medium text-foreground">
              {formatNumber(counts.sleeping_pairs)}
            </span>{" "}
            sleeping (agency × product) authorizations across{" "}
            <span className="font-medium text-foreground">
              {formatNumber(counts.products_with_gap)}
            </span>{" "}
            of{" "}
            <span className="font-medium text-foreground">
              {formatNumber(counts.ai_used_products)}
            </span>{" "}
            FedRAMP products that have at least one AI use case in the
            inventory. Sort below is by gap size, descending.
          </p>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Click any row to see the lead users and the sleeping authorizers.
          </p>
        </div>
      </header>

      <div data-coverage-content="1">
        {error ? (
          <Section number="I" title="No data" lede="The FedRAMP tables aren&rsquo;t loaded.">
            <p className="border-t-2 border-foreground pt-4 max-w-prose text-sm text-muted-foreground">
              Run <code className="font-mono text-foreground">make fedramp</code>{" "}
              to seed the FedRAMP tables. Detail:{" "}
              <span className="font-mono text-[11px]">{error}</span>
            </p>
          </Section>
        ) : (
          <>
            {byImpact.length > 0 || topAgencies.length > 0 ? (
              <Section
                number="I"
                title="Where the slack sits"
                lede="The gap distribution by FedRAMP impact level (left) and the agencies sitting on the most sleeping ATOs (right)."
              >
                <div className="border-t-2 border-foreground pt-4 grid grid-cols-1 gap-8 md:grid-cols-2">
                  <div>
                    <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      Sleeping pairs by impact level
                    </p>
                    <SleepingByImpactChart rows={byImpact} />
                  </div>
                  <div>
                    <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      Top {topAgencies.length} agencies by sleeping ATO count
                    </p>
                    <TopSleepingAgenciesChart rows={topAgencies} />
                  </div>
                </div>
              </Section>
            ) : null}

          <Section
            number={byImpact.length > 0 || topAgencies.length > 0 ? "II" : "I"}
            title="By product"
            lede="One row per FedRAMP product with at least one lead user and at least one sleeping authorizer. Filter by impact level. Click column headers to sort, or any row to expand."
          >
            <div className="border-t-2 border-foreground pt-4 mb-5 flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground mr-1">
                Impact
              </span>
              <FilterChip
                href={qs({ impact: null })}
                active={!impactFilter}
                label="All"
              />
              {distinctImpacts.map((lvl) => (
                <FilterChip
                  key={lvl}
                  href={qs({ impact: lvl.toLowerCase() })}
                  active={impactFilter === lvl.toLowerCase()}
                  label={lvl}
                />
              ))}
            </div>

            {withDetail.length === 0 ? (
              <EmptyState
                variant="bare"
                message="No products match the current filter."
              />
            ) : (
              <SleepingTable rows={withDetail} />
            )}
          </Section>
          </>
        )}
      </div>

      <SnapshotFooter snapshot={snapshot} />
    </div>
  );
}

function qs({ impact }: { impact: string | null }) {
  const params = new URLSearchParams();
  if (impact) params.set("impact", impact);
  const s = params.toString();
  return s ? `/fedramp/coverage/sleeping?${s}` : "/fedramp/coverage/sleeping";
}

function FilterChip({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  const base =
    "inline-flex items-center border bg-background font-mono font-semibold uppercase tracking-[0.06em] transition-colors px-2 py-0.5 text-[11px]";
  const activeRing = "border-foreground text-foreground";
  const idle = "border-border text-muted-foreground hover:text-foreground";
  // scroll={false} keeps the user where they were on the page when the
  // filter changes — without it Next.js scrolls to top on every chip click,
  // forcing the reader to scroll back down to the table.
  return (
    <Link href={href} scroll={false} className={`${base} ${active ? activeRing : idle}`}>
      {label}
    </Link>
  );
}

function safeSnapshot(): FedrampSnapshot | null {
  try {
    return getFedrampSnapshot();
  } catch {
    return null;
  }
}

function SnapshotFooter({ snapshot }: { snapshot: FedrampSnapshot | null }) {
  if (!snapshot) {
    return (
      <p className="mt-16 border-t border-border pt-4 text-center font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
        FedRAMP snapshot · unavailable
      </p>
    );
  }
  return (
    <p className="mt-16 border-t border-border pt-4 text-center font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
      FedRAMP snapshot ·{" "}
      {snapshot.snapshot_date
        ? `data as of ${formatDate(snapshot.snapshot_date)}`
        : "date unknown"}{" "}
      · {formatNumber(snapshot.product_count)} products
    </p>
  );
}
