import Link from "next/link";
import {
  getCoverageVendorRows,
  getFedrampSnapshot,
} from "@/lib/db";
import type { CoverageVendorRow, FedrampSnapshot } from "@/lib/types";
import { formatNumber, formatDate } from "@/lib/formatting";
import { Section, MonoChip } from "@/components/editorial";
import { HorizontalBarChart } from "@/components/charts/horizontal-bar-chart";

export const metadata = {
  title: "Vendor coverage · FedRAMP × AI Inventory",
  description:
    "Inventory products ranked by reach, with FedRAMP authorization status. Mention volume by matched / unmatched.",
};

function safeRows(): { rows: CoverageVendorRow[]; error: string | null } {
  try {
    return { rows: getCoverageVendorRows(), error: null };
  } catch (err) {
    return {
      rows: [],
      error: err instanceof Error ? err.message : "Unknown error.",
    };
  }
}

function safeSnapshot(): FedrampSnapshot | null {
  try {
    return getFedrampSnapshot();
  } catch {
    return null;
  }
}

function impactTone(level: string | null): "stamp" | "verified" | "ink" | "muted" {
  const v = (level ?? "").toLowerCase();
  if (v === "high") return "verified";
  if (v === "moderate") return "stamp";
  if (v === "low" || v === "li-saas") return "muted";
  return "ink";
}

export default function FedrampCoverageVendorsPage() {
  const { rows, error } = safeRows();
  const snapshot = safeSnapshot();

  // Top 30 by reach for the table; full count flagged below.
  const ranked = rows
    .slice()
    .sort((a, b) => b.use_case_count - a.use_case_count)
    .slice(0, 30);

  // Aggregate matched / unmatched mention volume for the bar chart.
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

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-14 md:px-8 md:py-20">
      <header className="ink-in grid grid-cols-12 gap-x-6 border-b border-border pb-12 md:pb-16">
        <aside className="col-span-12 mb-8 md:col-span-3 md:mb-0">
          <div className="sticky top-32 space-y-2">
            <div className="eyebrow !text-[var(--stamp)]">Panel 1</div>
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
            <span className="font-medium text-foreground">
              {formatNumber(matchedProducts)}
            </span>{" "}
            of <span className="font-medium">{formatNumber(totalProducts)}</span>{" "}
            inventory products map to a FedRAMP product. By raw mention volume,{" "}
            agencies report{" "}
            <span className="font-medium">{formatNumber(matchedMentions)}</span>{" "}
            use cases against FedRAMP-matched products and{" "}
            <span className="font-medium">{formatNumber(unmatchedMentions)}</span>{" "}
            against products without a FedRAMP listing.
          </p>
        </div>
      </header>

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
          <p className="border-t-2 border-foreground pt-4 text-sm text-muted-foreground">
            The inventory has no products with reportable use-case counts.
          </p>
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
            lede="Inventory products ranked by total use-case mentions; FedRAMP linkage shown alongside."
          >
            <div className="overflow-x-auto border-t-2 border-foreground">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-2 py-2 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      #
                    </th>
                    <th className="px-2 py-2 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      Product
                    </th>
                    <th className="px-2 py-2 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      Vendor
                    </th>
                    <th className="px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      Use cases
                    </th>
                    <th className="px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      Agencies
                    </th>
                    <th className="px-2 py-2 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      FedRAMP
                    </th>
                    <th className="px-2 py-2 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      Impact
                    </th>
                    <th className="px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      ATOs
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((row, i) => (
                    <tr
                      key={row.inventory_product_id}
                      className="border-b border-border/60 hover:bg-muted/30"
                    >
                      <td className="px-2 py-2 font-mono text-[11px] tabular-nums text-muted-foreground">
                        {String(i + 1).padStart(2, "0")}
                      </td>
                      <td className="px-2 py-2">
                        <Link
                          href={`/products/${row.inventory_product_id}`}
                          className="text-foreground hover:text-[var(--stamp)]"
                        >
                          {row.canonical_name}
                        </Link>
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {row.vendor ?? "—"}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {formatNumber(row.use_case_count)}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                        {formatNumber(row.agency_count)}
                      </td>
                      <td className="px-2 py-2">
                        {row.has_fedramp_link === 1 && row.fedramp_id ? (
                          <MonoChip
                            href={`/fedramp/marketplace/products/${row.fedramp_id}`}
                            tone="verified"
                            size="xs"
                            title={`${row.fedramp_csp ?? ""} ${row.fedramp_cso ?? ""}`.trim()}
                          >
                            {row.fedramp_id}
                          </MonoChip>
                        ) : (
                          <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        {row.fedramp_impact_level ? (
                          <MonoChip tone={impactTone(row.fedramp_impact_level)} size="xs">
                            {row.fedramp_impact_level}
                          </MonoChip>
                        ) : (
                          <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                        {row.fedramp_ato_count > 0
                          ? formatNumber(row.fedramp_ato_count)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 font-mono text-[11px] text-muted-foreground">
              Source: <span className="text-foreground">products</span> ⨝{" "}
              <span className="text-foreground">fedramp_product_links</span> ⨝{" "}
              <span className="text-foreground">fedramp_authorizations</span>.
            </p>
          </Section>
        </>
      )}

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
