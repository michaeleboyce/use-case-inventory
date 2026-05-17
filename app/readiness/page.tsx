import Link from "next/link";
import { Section } from "@/components/editorial";
import { ReadinessHeadlineStat } from "@/components/readiness/readiness-headline-stat";
import { ReadinessTierBand } from "@/components/readiness/readiness-tier-band";
import { ReadinessRankTable } from "@/components/readiness/readiness-rank-table";
import * as readinessLib from "@/lib/readiness";
import {
  getAgencyReadinessRanked,
  getHeadlineStats,
  getReadinessTierSummary,
} from "@/lib/readiness";
import { formatDate, formatNumber } from "@/lib/formatting";

export const metadata = {
  title: "Federal AI Readiness · IFP",
  description:
    "A published rubric scoring federal agencies on adoption, frontier capability, procurement hygiene, reporting quality, and governance documentation.",
};

/**
 * Sub-story data sources are owned by Agent C and may not yet exist at the
 * time this page is wired up. We import them defensively and fall back to
 * empty arrays / nulls so the page renders cleanly either way. Once C lands
 * its `getVendorConcentration` / `getFrontierPenetration` /
 * `getReportingCompleteness` exports in `lib/readiness.ts`, the page picks
 * them up automatically with no edit here.
 */
interface VendorConcentrationRow {
  vendor: string;
  use_case_count: number;
  agency_count: number;
  share_of_uc_pct: number;
}
interface FrontierPenetrationRow {
  agency_abbreviation: string;
  agency_name: string;
  frontier_use_case_count: number;
  total_use_case_count: number;
  pct_frontier: number;
}
interface ReportingCompletenessRow {
  agency_abbreviation: string;
  agency_name: string;
  completion_rate_pct: number;
  fields_evaluated: number;
}

// Shape adapters — lib/readiness.ts exports getVendorConcentration /
// getFrontierPenetration / getReportingCompleteness with their own shapes;
// we adapt them into the row shapes this page expects.
interface ReadinessLibExtras {
  getVendorConcentration?: () => {
    top_vendors: Array<{
      vendor: string;
      use_case_count: number;
      agency_count: number;
      share_of_total: number;
    }>;
    herfindahl_index: number;
    top5_share: number;
  };
  getFrontierPenetration?: () => {
    federal_frontier_pct: number;
    top_agencies: Array<{
      agency_abbreviation: string;
      frontier_pct: number;
      frontier_count: number;
      total_count: number;
    }>;
  };
  getReportingCompleteness?: () => Array<{
    agency_abbreviation: string;
    overall_completeness: number;
    per_field: Record<string, number>;
  }>;
}

function loadSubStories(): {
  vendors: VendorConcentrationRow[];
  vendorHerfindahl: number | null;
  frontier: FrontierPenetrationRow[];
  reporting: ReportingCompletenessRow[];
} {
  let vendors: VendorConcentrationRow[] = [];
  let vendorHerfindahl: number | null = null;
  let frontier: FrontierPenetrationRow[] = [];
  let reporting: ReportingCompletenessRow[] = [];

  const extras = readinessLib as unknown as ReadinessLibExtras;
  try {
    if (typeof extras.getVendorConcentration === "function") {
      const vc = extras.getVendorConcentration();
      vendors = vc.top_vendors.map((v) => ({
        vendor: v.vendor,
        use_case_count: v.use_case_count,
        agency_count: v.agency_count,
        share_of_uc_pct: v.share_of_total * 100,
      }));
      // HHI on the 0-10000 antitrust scale for inline display.
      vendorHerfindahl = Math.round(vc.herfindahl_index * 10000);
    }
    if (typeof extras.getFrontierPenetration === "function") {
      const fp = extras.getFrontierPenetration();
      frontier = fp.top_agencies.map((r) => ({
        agency_abbreviation: r.agency_abbreviation,
        agency_name: r.agency_abbreviation,
        frontier_use_case_count: r.frontier_count,
        total_use_case_count: r.total_count,
        pct_frontier: r.frontier_pct * 100,
      }));
    }
    if (typeof extras.getReportingCompleteness === "function") {
      const rc = extras.getReportingCompleteness();
      reporting = rc.map((r) => ({
        agency_abbreviation: r.agency_abbreviation,
        agency_name: r.agency_abbreviation,
        completion_rate_pct: r.overall_completeness * 100,
        fields_evaluated: Object.keys(r.per_field).length,
      }));
    }
  } catch {
    // Defensive — extras may throw at runtime if they query a not-yet-built
    // table; degrade to empty sections rather than crash the page.
  }
  return { vendors, vendorHerfindahl, frontier, reporting };
}

export default function ReadinessPage() {
  const ranked = getAgencyReadinessRanked();
  const tiers = getReadinessTierSummary();
  const headline = getHeadlineStats();
  const { vendors, vendorHerfindahl, frontier, reporting } = loadSubStories();

  const totalScored = headline.total_agencies_scored;
  const fedrampPct = Math.round(headline.fedramp_coverage_pct);
  const internalBuildPct = Math.round(headline.internal_build_pct);
  const productionPct = Math.round(headline.production_rate_pct);
  const complianceGapPct = Math.round(headline.hi_no_risk_docs_pct);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-14 md:px-8 md:py-20">
      {/* ----------------------------------------------------------------- */}
      {/* Top banner — data-as-of + methodology link                         */}
      {/* ----------------------------------------------------------------- */}
      <aside className="border-l-4 border-stone-400 bg-stone-50 px-4 py-2 text-sm text-stone-700">
        Data as of{" "}
        <span className="font-mono tabular-nums">
          {formatDate(headline.computed_at)}
        </span>
        {" · "}
        <Link
          href="/readiness/methodology"
          className="underline decoration-dotted underline-offset-4 hover:text-[var(--stamp)]"
        >
          methodology
        </Link>
      </aside>

      {/* ----------------------------------------------------------------- */}
      {/* HERO — H1 + lede                                                   */}
      {/* ----------------------------------------------------------------- */}
      <header className="mt-10 grid grid-cols-12 gap-x-6 border-b border-border pb-12 md:mt-14 md:pb-16">
        <div className="col-span-12 md:col-span-9">
          <div className="eyebrow mb-2 !text-[var(--stamp)]">
            No. 002 · Filed · Readiness Index v1.1
          </div>
          <h1 className="font-display text-[clamp(2.6rem,7vw,5.6rem)] italic leading-[0.95] tracking-[-0.03em] text-foreground">
            Federal AI{" "}
            <span className="relative inline-block">
              <span
                aria-hidden
                className="absolute inset-x-[-0.06em] bottom-[0.16em] h-[0.36em] bg-[var(--highlight)]/90"
              />
              <span className="relative">Readiness</span>
            </span>
          </h1>
          <p className="mt-8 max-w-prose text-[1.05rem] leading-[1.55] text-foreground/85">
            Across{" "}
            <span className="font-medium text-foreground">
              {formatNumber(totalScored)} federal agencies
            </span>{" "}
            scored against a published rubric of state-capacity signals, only{" "}
            <span className="font-medium text-foreground">
              {internalBuildPct}%
            </span>{" "}
            of federal AI is built in-house — the rest is purchased commercial
            tooling. Just{" "}
            <span className="font-medium text-foreground">{productionPct}%</span>{" "}
            of reported use cases have reached deployed status; the remainder
            sit in pilots, acquisition, or pre-deployment.
            FedRAMP-authorized infrastructure covers{" "}
            <span className="font-medium text-foreground">{fedrampPct}%</span>{" "}
            of those deployments. These are the gaps between AI policy ambition
            and operational capacity.
          </p>
        </div>
      </header>

      {/* ----------------------------------------------------------------- */}
      {/* § 01 — THE HEADLINE                                                */}
      {/* ----------------------------------------------------------------- */}
      <Section
        number="01"
        title="The headline"
        lede="One quotable number that frames the gap between AI policy ambition and operational capacity."
        source="derived"
      >
        <ReadinessHeadlineStat
          value={internalBuildPct}
          unit="%"
          label="of federal AI is built in-house — the rest is purchased commercial tooling"
          caption={`Across all ${formatNumber(totalScored)} agencies' reported use cases · capacity-first stat, not a compliance one · IFP-derived from OMB M-25-21 inventory`}
          variant="big"
          href="/readiness/methodology#internal-build"
        />
        <div className="mt-6 border-t border-dotted border-border pt-5 space-y-2">
          <ReadinessHeadlineStat
            value={productionPct}
            unit="%"
            label="of reported use cases have reached deployed status (rest are pilots / pre-deployment / acquisition)"
            variant="inline"
            href="/readiness/methodology#production-rate"
          />
          <ReadinessHeadlineStat
            value={fedrampPct}
            unit="%"
            label="of federal AI deployments run on FedRAMP-authorized infrastructure"
            variant="inline"
            href="/readiness/methodology#fedramp"
          />
        </div>
        <p className="mt-6 font-display italic text-[1.05rem] leading-snug text-stone-600">
          All three numbers are computed deterministically from the OMB M-25-21
          inventory and the FedRAMP marketplace, and will move as agencies file
          corrections. A separate compliance baseline — that {complianceGapPct}%
          of use cases lack the M-25-21 risk-documentation fields — is
          discussed on the{" "}
          <Link
            href="/readiness/methodology#compliance-vs-capacity"
            className="underline decoration-dotted underline-offset-4"
          >
            methodology page
          </Link>
          {" "}as a contrast, not as the headline.
        </p>
      </Section>

      {/* ----------------------------------------------------------------- */}
      {/* § 02 — THE LEAGUE TABLE                                            */}
      {/* ----------------------------------------------------------------- */}
      <Section
        number="02"
        title="The league table"
        lede="All scored agencies sorted into five tiers by composite score. Empty top tiers tell as much as full bottom ones."
        source="derived"
      >
        <ReadinessTierBand tiers={tiers} />
        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Click any agency code to open its detailed scorecard.
        </p>
      </Section>

      {/* ----------------------------------------------------------------- */}
      {/* § 03 — RANKED                                                      */}
      {/* ----------------------------------------------------------------- */}
      <Section
        number="03"
        title="Ranked"
        lede={`All ${formatNumber(ranked.length)} agencies with composite, subscores, and tier. Click any column header to re-sort.`}
        source="derived"
      >
        <ReadinessRankTable rows={ranked} />
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Subscore cells tinted by threshold: ≥ 70 strong · 40–69 mid · &lt; 40
          weak. All scores 0–100.
        </p>
      </Section>

      {/* ----------------------------------------------------------------- */}
      {/* § 04 — SUB-STORIES                                                 */}
      {/* ----------------------------------------------------------------- */}
      <Section
        number="04"
        title="Sub-stories"
        lede="Three angles into the readiness data — vendor concentration, frontier penetration, reporting completeness."
        source="derived"
      >
        <div className="space-y-12">
          {/* Vendor concentration */}
          <div>
            <h3 className="font-display text-[1.5rem] italic leading-tight text-foreground">
              Vendor concentration
            </h3>
            <p className="mt-2 max-w-prose text-sm leading-[1.55] text-foreground/80">
              {vendors.length > 0 ? (
                <>
                  The top {vendors.length} vendors account for a substantial
                  share of all reported federal AI use cases. A Herfindahl-style
                  concentration index over their shares lands at{" "}
                  <span className="font-medium text-foreground tabular-nums">
                    {vendorHerfindahl ?? "—"}
                  </span>{" "}
                  — higher means a smaller club of vendors carries more of the
                  load.
                </>
              ) : (
                <span className="italic text-muted-foreground">
                  Vendor concentration data forthcoming.
                </span>
              )}
            </p>
            {vendors.length > 0 ? (
              <table className="mt-4 w-full border-collapse border border-stone-300 text-sm">
                <thead className="bg-stone-100">
                  <tr>
                    <th className="border-b border-stone-300 px-2 py-2 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-stone-500">
                      Vendor
                    </th>
                    <th className="border-b border-stone-300 px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-stone-500">
                      Use cases
                    </th>
                    <th className="border-b border-stone-300 px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-stone-500">
                      Agencies
                    </th>
                    <th className="border-b border-stone-300 px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-stone-500">
                      Share %
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.slice(0, 5).map((v) => (
                    <tr key={v.vendor} className="border-b border-stone-200">
                      <td className="px-2 py-2 font-display italic text-stone-800">
                        {v.vendor}
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums">
                        {formatNumber(v.use_case_count)}
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums">
                        {formatNumber(v.agency_count)}
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums">
                        {v.share_of_uc_pct.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>

          {/* Frontier penetration */}
          <div>
            <h3 className="font-display text-[1.5rem] italic leading-tight text-foreground">
              Frontier penetration
            </h3>
            <p className="mt-2 max-w-prose text-sm leading-[1.55] text-foreground/80">
              {frontier.length > 0 ? (
                <>
                  Share of each agency&apos;s reported use cases that are tagged
                  as using a frontier model. Top {Math.min(5, frontier.length)}{" "}
                  agencies shown.
                </>
              ) : (
                <span className="italic text-muted-foreground">
                  Frontier penetration data forthcoming.
                </span>
              )}
            </p>
            {frontier.length > 0 ? (
              <table className="mt-4 w-full border-collapse border border-stone-300 text-sm">
                <thead className="bg-stone-100">
                  <tr>
                    <th className="border-b border-stone-300 px-2 py-2 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-stone-500">
                      Agency
                    </th>
                    <th className="border-b border-stone-300 px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-stone-500">
                      Frontier UC
                    </th>
                    <th className="border-b border-stone-300 px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-stone-500">
                      Total UC
                    </th>
                    <th className="border-b border-stone-300 px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-stone-500">
                      % Frontier
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {frontier.slice(0, 5).map((row) => (
                    <tr
                      key={row.agency_abbreviation}
                      className="border-b border-stone-200"
                    >
                      <td className="px-2 py-2">
                        <Link
                          href={`/agencies/${row.agency_abbreviation.toLowerCase()}#scorecard`}
                          className="hover:text-[var(--stamp)]"
                        >
                          <span className="font-mono text-xs font-semibold uppercase tracking-[0.04em] text-stone-900">
                            {row.agency_abbreviation}
                          </span>
                          <span className="ml-2 font-display italic text-stone-700">
                            {row.agency_name}
                          </span>
                        </Link>
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums">
                        {formatNumber(row.frontier_use_case_count)}
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums">
                        {formatNumber(row.total_use_case_count)}
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums font-semibold text-stone-900">
                        {row.pct_frontier.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>

          {/* Reporting completeness */}
          <div>
            <h3 className="font-display text-[1.5rem] italic leading-tight text-foreground">
              Reporting completeness
            </h3>
            <p className="mt-2 max-w-prose text-sm leading-[1.55] text-foreground/80">
              {reporting.length > 0 ? (
                <>
                  Average non-null rate across the ten M-25-21 fields used by
                  the reporting-quality subscore. Top{" "}
                  {Math.min(5, reporting.length)} agencies shown.
                </>
              ) : (
                <span className="italic text-muted-foreground">
                  Reporting completeness data forthcoming.
                </span>
              )}
            </p>
            {reporting.length > 0 ? (
              <table className="mt-4 w-full border-collapse border border-stone-300 text-sm">
                <thead className="bg-stone-100">
                  <tr>
                    <th className="border-b border-stone-300 px-2 py-2 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-stone-500">
                      Agency
                    </th>
                    <th className="border-b border-stone-300 px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-stone-500">
                      Fields
                    </th>
                    <th className="border-b border-stone-300 px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-stone-500">
                      Avg completion
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reporting.slice(0, 5).map((row) => (
                    <tr
                      key={row.agency_abbreviation}
                      className="border-b border-stone-200"
                    >
                      <td className="px-2 py-2">
                        <Link
                          href={`/agencies/${row.agency_abbreviation.toLowerCase()}#scorecard`}
                          className="hover:text-[var(--stamp)]"
                        >
                          <span className="font-mono text-xs font-semibold uppercase tracking-[0.04em] text-stone-900">
                            {row.agency_abbreviation}
                          </span>
                          <span className="ml-2 font-display italic text-stone-700">
                            {row.agency_name}
                          </span>
                        </Link>
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums">
                        {formatNumber(row.fields_evaluated)}
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums font-semibold text-stone-900">
                        {row.completion_rate_pct.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>
        </div>
      </Section>

      {/* ----------------------------------------------------------------- */}
      {/* FOOTER                                                             */}
      {/* ----------------------------------------------------------------- */}
      <footer className="mt-20 border-t-2 border-foreground pt-6 text-sm text-stone-700">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div className="space-y-1">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-stone-500">
              Federal AI Readiness Index v1.1 ·{" "}
              <Link
                href="/readiness/methodology"
                className="underline decoration-dotted underline-offset-4 hover:text-[var(--stamp)]"
              >
                methodology
              </Link>
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-stone-500">
              Data as of {formatDate(headline.computed_at)}
            </div>
          </div>
          <div className="max-w-md border-l-2 border-stone-300 pl-3 font-mono text-[10px] uppercase tracking-[0.12em] text-stone-500">
            Suggested citation: IFP, &ldquo;Federal AI Readiness Index,&rdquo;
            use-case-inventory.vercel.app/readiness, accessed{" "}
            {formatDate(new Date().toISOString())}.
          </div>
        </div>
      </footer>
    </div>
  );
}
