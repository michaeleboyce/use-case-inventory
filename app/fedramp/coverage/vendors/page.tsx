import Link from "next/link";
import {
  getAgencies,
  getCoverageVendorRows,
  getFedrampSnapshot,
  getUseCasesForCoverageProduct,
} from "@/lib/db";
import type {
  CoverageUseCaseRow,
  CoverageVendorRow,
  FedrampSnapshot,
} from "@/lib/types";
import { formatNumber, formatDate } from "@/lib/formatting";
import { Section } from "@/components/editorial";
import { EmptyState } from "@/components/empty-state";
import { HorizontalBarChart } from "@/components/charts/horizontal-bar-chart";
import { CoverageAgencyFilter } from "@/components/coverage/coverage-agency-filter";
import { VendorsTable } from "./_sections/vendors-table";

export const metadata = {
  title: "Vendor coverage · FedRAMP × AI Inventory",
  description:
    "Inventory products ranked by reach, with FedRAMP authorization status — expand any row to see the actual use cases that mention it.",
};

function safeSnapshot(): FedrampSnapshot | null {
  try {
    return getFedrampSnapshot();
  } catch {
    return null;
  }
}

export default async function FedrampCoverageVendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ agency?: string }>;
}) {
  const sp = await searchParams;
  const agencyFilter = (sp.agency ?? "").trim().toUpperCase() || null;

  const agencies = getAgencies();
  const agencyMatch = agencyFilter
    ? agencies.find(
        (a) => a.abbreviation.toUpperCase() === agencyFilter,
      ) ?? null
    : null;
  const effectiveAgencyId = agencyMatch?.id ?? null;

  let rows: CoverageVendorRow[] = [];
  let error: string | null = null;
  try {
    rows = getCoverageVendorRows(
      effectiveAgencyId != null ? { agencyId: effectiveAgencyId } : {},
    );
  } catch (err) {
    error = err instanceof Error ? err.message : "Unknown error.";
  }
  const snapshot = safeSnapshot();

  // Top 30 by reach for the table; full list flagged in the lede.
  const ranked = rows
    .slice()
    .sort((a, b) => b.use_case_count - a.use_case_count)
    .slice(0, 30);

  // Attach the top-10 use-case detail per row server-side. No client fetch.
  type RankedWithDetail = CoverageVendorRow & {
    _detail: CoverageUseCaseRow[];
    _totalUseCases: number;
  };
  const rankedWithDetail: RankedWithDetail[] = ranked.map((r) => {
    const detail = getUseCasesForCoverageProduct(r.inventory_product_id, {
      agencyId: effectiveAgencyId ?? undefined,
      limit: 10,
    });
    return {
      ...r,
      _detail: detail,
      _totalUseCases: r.use_case_count,
    };
  });

  const matchedMentions = rows.reduce(
    (acc, r) => acc + (r.has_fedramp_link ? r.use_case_count : 0),
    0,
  );
  const unmatchedMentions = rows.reduce(
    (acc, r) => acc + (r.has_fedramp_link ? 0 : r.use_case_count),
    0,
  );
  const matchedProducts = rows.filter((r) => r.has_fedramp_link === 1).length;
  const totalProducts = rows.length;

  const chartData = [
    { label: "FedRAMP-matched", count: matchedMentions },
    { label: "Not on FedRAMP", count: unmatchedMentions },
  ];

  const headline = agencyMatch
    ? `${agencyMatch.abbreviation} mentions ${formatNumber(totalProducts)} distinct AI products`
    : `${formatNumber(matchedProducts)} of ${formatNumber(totalProducts)} inventory products map to a FedRAMP product`;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-14 md:px-8 md:py-20">
      <header className="ink-in grid grid-cols-12 gap-x-6 border-b border-border pb-12 md:pb-16">
        <aside className="col-span-12 mb-8 md:col-span-3 md:mb-0">
          <div className="sticky top-32 space-y-2">
            <div className="eyebrow !text-[var(--stamp)]">AI → FedRAMP</div>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Vendor coverage
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
            Which AI products in the inventory carry a{" "}
            <em className="italic">FedRAMP authorization</em>?
          </h1>
          <p className="mt-6 max-w-prose text-[1.02rem] leading-[1.55] text-foreground/85">
            {agencyMatch ? (
              <>
                Scoped to {agencyMatch.name} ({agencyMatch.abbreviation}).{" "}
                {headline}; {formatNumber(matchedMentions)} mentions are on
                FedRAMP-matched products and {formatNumber(unmatchedMentions)}{" "}
                are not.
              </>
            ) : (
              <>
                <span className="font-medium text-foreground">
                  {formatNumber(matchedProducts)}
                </span>{" "}
                of <span className="font-medium">{formatNumber(totalProducts)}</span>{" "}
                inventory products map to a FedRAMP product. By raw mention
                volume, agencies report{" "}
                <span className="font-medium">{formatNumber(matchedMentions)}</span>{" "}
                use cases against FedRAMP-matched products and{" "}
                <span className="font-medium">{formatNumber(unmatchedMentions)}</span>{" "}
                against products without a FedRAMP listing.
              </>
            )}
          </p>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Click any row to see the use cases that name that product.
          </p>
        </div>
      </header>

      <div className="mt-6">
        <CoverageAgencyFilter
          options={agencies.map((a) => ({
            abbreviation: a.abbreviation,
            name: a.name,
          }))}
          value={agencyMatch?.abbreviation ?? null}
        />
      </div>

      <div data-coverage-content="1">
        {error ? (
        <Section number="I" title="No data" lede="The FedRAMP tables aren&rsquo;t loaded.">
          <p className="border-t-2 border-foreground pt-4 max-w-prose text-sm text-muted-foreground">
            Run <code className="font-mono text-foreground">make fedramp</code>{" "}
            to seed the FedRAMP marketplace tables. Detail:{" "}
            <span className="font-mono text-[11px]">{error}</span>
          </p>
        </Section>
      ) : rows.length === 0 ? (
        <Section number="I" title="No products" lede="Nothing to rank.">
          <EmptyState
            variant="boxed"
            message={
              agencyMatch
                ? `${agencyMatch.abbreviation} has no use cases with linked AI products.`
                : "The inventory has no products with reportable use-case counts."
            }
          />
        </Section>
      ) : (
        <>
          <Section
            number="I"
            title="Mention volume"
            lede="Use-case mentions split by whether the underlying product is on the FedRAMP marketplace."
          >
            <div className="border-t-2 border-foreground pt-4">
              <HorizontalBarChart
                data={chartData}
                colorMap={{
                  "FedRAMP-matched": "var(--verified)",
                  "Not on FedRAMP": "var(--stamp)",
                }}
                labelWidth={140}
                height={120}
              />
            </div>
          </Section>

          <Section
            number="II"
            title="Top 30 products by reach"
            lede="Inventory products ranked by total use-case mentions. Click any row to expand — top-10 use cases inline, plus a 'see all' link into the explorer for filtering."
          >
            <div className="border-t-2 border-foreground pt-4">
              <VendorsTable
                rows={rankedWithDetail}
                agencyAbbr={agencyMatch?.abbreviation ?? null}
                agencyId={agencyMatch?.id ?? null}
              />
            </div>
            <p className="mt-3 font-mono text-[11px] text-muted-foreground">
              Source: <span className="text-foreground">products</span> ⨝{" "}
              <span className="text-foreground">fedramp_product_links</span> ⨝{" "}
              <span className="text-foreground">fedramp_authorizations</span>.
            </p>
          </Section>
        </>
      )}
      </div>

      <SnapshotFooter snapshot={snapshot} />
    </div>
  );
}

function SnapshotFooter({ snapshot }: { snapshot: FedrampSnapshot | null }) {
  if (!snapshot) {
    return (
      <p className="mt-16 border-t border-border pt-4 text-center font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
        FedRAMP snapshot · unavailable
      </p>
    );
  }
  const parts = [
    snapshot.snapshot_date
      ? `data as of ${formatDate(snapshot.snapshot_date)}`
      : null,
    `${formatNumber(snapshot.product_count)} products`,
    `${formatNumber(snapshot.ato_event_count)} authorizations`,
  ].filter(Boolean);
  return (
    <p className="mt-16 border-t border-border pt-4 text-center font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
      FedRAMP snapshot · {parts.join(" · ")}
    </p>
  );
}
