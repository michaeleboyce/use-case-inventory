/**
 * /fedramp/marketplace/analytics — issuance, reuse, and the pipeline.
 *
 * The original FedRAMP dashboard runs four bespoke db helpers
 * (`getAnnualAtoCounts`, `getReuseHeatmap`, `getAssessorLeaderboard`,
 * `getPipelineFunnel`). To respect file ownership of `lib/db.ts` (Foundation
 * agent), this page derives the same series locally from the existing
 * helpers — `getFedrampProducts`, `getFedrampAuthorizationsForProduct`,
 * etc. The numbers are still computed on the server, in one render pass.
 */

import { Section, Figure, Eyebrow } from "@/components/editorial";
import {
  getFedrampProducts,
  getFedrampAuthorizationsForProduct,
  getFedrampAssessors,
  getFedrampProductsByAssessor,
  getFedrampSnapshot,
} from "@/lib/db";
import { HorizontalBarChart } from "@/components/charts/horizontal-bar-chart";
import { formatNumber } from "@/lib/formatting";

export const metadata = {
  title: "Analytics · FedRAMP Marketplace · Federal AI Inventory",
  description:
    "Issuance, reuse, and the pipeline — cross-cutting figures over every FedRAMP authorization on the marketplace.",
};

export default function MarketplaceAnalyticsPage() {
  const snapshot = getFedrampSnapshot();
  const products = getFedrampProducts();

  // Pull every authorization across every product (one prepared-statement
  // call per product; 642 products in 2026, all reads against the in-memory
  // SQLite handle).
  const allAuths = products.flatMap((p) =>
    getFedrampAuthorizationsForProduct(p.fedramp_id),
  );

  // 1. Annual issuance — Initial vs Reuse, by ATO issuance year.
  const yearly = new Map<number, { year: number; initial: number; reuse: number; total: number }>();
  for (const a of allAuths) {
    if (!a.ato_issuance_date) continue;
    const year = Number(a.ato_issuance_date.slice(0, 4));
    if (!Number.isFinite(year)) continue;
    const cur =
      yearly.get(year) ?? { year, initial: 0, reuse: 0, total: 0 };
    if (a.ato_type === "Initial") cur.initial++;
    else if (a.ato_type === "Reuse") cur.reuse++;
    cur.total++;
    yearly.set(year, cur);
  }
  const annual = Array.from(yearly.values()).sort((a, b) => a.year - b.year);

  // 2. Pipeline funnel — count of products in each marketplace status.
  const funnel = new Map<string, number>();
  for (const p of products) {
    funnel.set(p.status, (funnel.get(p.status) ?? 0) + 1);
  }
  const STAGE_ORDER = [
    "FedRAMP Ready",
    "FedRAMP In Process",
    "FedRAMP Authorized",
  ];
  const funnelStages = STAGE_ORDER.filter((s) => funnel.has(s)).map((s) => ({
    label: s,
    count: funnel.get(s) ?? 0,
  }));
  // Roll any stages we don't recognize into "Other" for completeness.
  const otherCount = Array.from(funnel.entries())
    .filter(([k]) => !STAGE_ORDER.includes(k))
    .reduce((s, [, n]) => s + n, 0);
  if (otherCount > 0) {
    funnelStages.push({ label: "Other", count: otherCount });
  }

  // 3. Assessor leaderboard — top 20 by # products covered.
  const assessors = getFedrampAssessors();
  const assessorRows = assessors
    .map((a) => {
      const ps = getFedrampProductsByAssessor(a.id);
      return {
        slug: a.slug,
        name: a.name,
        product_count: ps.length,
        authorized_count: ps.filter((p) => p.status === "FedRAMP Authorized").length,
      };
    })
    .filter((r) => r.product_count > 0)
    .sort((a, b) => b.product_count - a.product_count)
    .slice(0, 20);

  // 4. CSP leaderboard — top 10 cloud-service providers by total
  // authorizations across their portfolio. Use the upstream
  // `authorization_count` rather than re-counting (it's the marketplace's
  // own reckoning).
  const cspMap = new Map<
    string,
    { csp: string; csp_slug: string; offerings: number; auths: number }
  >();
  for (const p of products) {
    const cur =
      cspMap.get(p.csp_slug) ??
      { csp: p.csp, csp_slug: p.csp_slug, offerings: 0, auths: 0 };
    cur.offerings++;
    cur.auths += p.authorization_count ?? 0;
    cspMap.set(p.csp_slug, cur);
  }
  const topCsps = Array.from(cspMap.values())
    .sort((a, b) => b.auths - a.auths)
    .slice(0, 10);

  const totalAtos = allAuths.length;
  const totalReuse = allAuths.filter((a) => a.ato_type === "Reuse").length;
  const totalInitial = allAuths.filter((a) => a.ato_type === "Initial").length;
  const reusePct = totalAtos === 0 ? 0 : (totalReuse / totalAtos) * 100;
  const yearSpan =
    annual.length > 0
      ? `${annual[0].year}–${annual[annual.length - 1].year}`
      : "—";

  return (
    <div>
      <header className="ink-in grid grid-cols-12 gap-x-6 border-b border-border pb-12">
        <aside className="col-span-12 mb-8 md:col-span-3 md:mb-0">
          <div className="space-y-2">
            <Eyebrow color="stamp">§ V · Analytics</Eyebrow>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Data Supplement
            </div>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Cycle 2026 · Four Figures
            </div>
            <div className="hidden space-y-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground md:block">
              <div className="border-t border-border pt-3">
                <div className="mb-0.5 text-[9px] text-muted-foreground/70">
                  Corpus
                </div>
                <div className="text-foreground">
                  {formatNumber(totalAtos)} ATOs ({yearSpan})
                </div>
              </div>
              <div>
                <div className="mb-0.5 text-[9px] text-muted-foreground/70">
                  Method
                </div>
                <div className="text-foreground">live from sqlite</div>
              </div>
            </div>
          </div>
        </aside>

        <div className="col-span-12 md:col-span-9">
          <h1 className="font-display italic text-[clamp(2.4rem,6vw,4.6rem)] leading-[0.95] tracking-[-0.03em] text-foreground">
            Issuance, reuse,
            <br />
            and the{" "}
            <span className="relative inline-block">
              <span
                aria-hidden
                className="absolute inset-x-[-0.08em] bottom-[0.16em] h-[0.38em] bg-[var(--highlight)]/85"
              />
              <span className="relative">pipeline.</span>
            </span>
          </h1>
          <p className="mt-8 max-w-prose text-[1.02rem] leading-[1.55] text-foreground/85">
            <span className="font-medium text-foreground">
              {formatNumber(totalAtos)} authorization events
            </span>{" "}
            recorded between {yearSpan} —{" "}
            {formatNumber(totalInitial)} initial and {formatNumber(totalReuse)}{" "}
            reuse, with reuse now accounting for{" "}
            <span className="font-medium text-foreground">
              {reusePct.toFixed(0)}%
            </span>{" "}
            of all ATOs in the long table.
          </p>
        </div>
      </header>

      <Section
        number="I"
        title="Annual issuance"
        lede="The shape of FedRAMP authorization volume across the marketplace's history."
      >
        <Figure
          eyebrow="Fig. 01 · Authorizations by year"
          caption={`Initial vs Reuse ATOs by issuance year, ${yearSpan}.`}
        >
          {annual.length === 0 ? (
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              No issuance data on file.
            </p>
          ) : (
            <div className="space-y-1">
              {annual.map((row) => {
                const max = Math.max(
                  ...annual.map((r) => r.total),
                );
                const pct = max === 0 ? 0 : (row.total / max) * 100;
                const initialPct = row.total === 0 ? 0 : (row.initial / row.total) * 100;
                return (
                  <div
                    key={row.year}
                    className="grid grid-cols-[3.5rem_minmax(0,1fr)_4.5rem_4.5rem] items-center gap-3 border-b border-dotted border-border py-1.5 font-mono text-[11px]"
                  >
                    <span className="tabular-nums text-foreground">
                      {row.year}
                    </span>
                    <div
                      className="flex h-3 overflow-hidden border border-border"
                      style={{ width: `${pct}%` }}
                    >
                      <div
                        className="bg-[var(--ink)]"
                        style={{ width: `${initialPct}%` }}
                      />
                      <div
                        className="bg-[var(--verified)]"
                        style={{ width: `${100 - initialPct}%` }}
                      />
                    </div>
                    <span className="text-right tabular-nums text-foreground/80">
                      {formatNumber(row.initial)}I
                    </span>
                    <span className="text-right tabular-nums text-[var(--verified)]">
                      {formatNumber(row.reuse)}R
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Figure>
      </Section>

      <Section
        number="II"
        title="Top cloud providers"
        lede="Ten CSPs ranked by total agency authorization events across all their offerings."
      >
        <Figure
          eyebrow="Fig. 02 · CSPs by authorization volume"
          caption={`Source: marketplace.fedramp.gov · Snapshot ${snapshot?.snapshot_date ?? "—"}`}
        >
          <HorizontalBarChart
            data={topCsps.map((c) => ({ label: c.csp, count: c.auths }))}
            height={280}
            labelWidth={140}
          />
        </Figure>
      </Section>

      <Section
        number="III"
        title="Assessor leaderboard"
        lede="The third-party assessment market is heavily concentrated."
      >
        <Figure
          eyebrow="Fig. 03 · 3PAO portfolios"
          caption="Top 20 assessors by number of products under audit. The verified-green slice is the share already FedRAMP Authorized."
        >
          <div className="space-y-1">
            {assessorRows.map((r) => {
              const max = assessorRows[0]?.product_count ?? 1;
              const pct = (r.product_count / max) * 100;
              const authPct =
                r.product_count === 0
                  ? 0
                  : (r.authorized_count / r.product_count) * 100;
              return (
                <div
                  key={r.slug}
                  className="grid grid-cols-[minmax(0,12rem)_minmax(0,1fr)_3rem] items-center gap-3 border-b border-dotted border-border py-1.5 font-mono text-[11px]"
                >
                  <span className="truncate text-foreground" title={r.name}>
                    {r.name}
                  </span>
                  <div
                    className="flex h-3 overflow-hidden border border-border"
                    style={{ width: `${pct}%` }}
                  >
                    <div
                      className="bg-[var(--verified)]"
                      style={{ width: `${authPct}%` }}
                    />
                    <div
                      className="bg-[var(--ink)]/35"
                      style={{ width: `${100 - authPct}%` }}
                    />
                  </div>
                  <span className="text-right tabular-nums text-foreground">
                    {formatNumber(r.product_count)}
                  </span>
                </div>
              );
            })}
          </div>
        </Figure>
      </Section>

      <Section
        number="IV"
        title="Pipeline funnel"
        lede="From Ready, through In Process, to Authorized — where the program is."
      >
        <Figure
          eyebrow="Fig. 04 · Stages"
          caption="Counts of products by current marketplace status."
        >
          <HorizontalBarChart
            data={funnelStages}
            height={Math.max(160, funnelStages.length * 36)}
            labelWidth={160}
          />
        </Figure>
      </Section>

      <footer className="mt-16 grid grid-cols-12 gap-x-6 border-t-2 border-foreground pt-6">
        <div className="col-span-12 md:col-span-3">
          <div className="eyebrow !text-[var(--stamp)]">Colophon</div>
        </div>
        <p className="col-span-12 font-mono text-[11px] uppercase tracking-[0.1em] leading-relaxed text-muted-foreground md:col-span-9">
          All figures computed live from the local SQLite snapshot. Source:
          marketplace.fedramp.gov.
        </p>
      </footer>
    </div>
  );
}
