import Link from "next/link";
import { PageSubnav } from "@/components/page-subnav";
import { Section } from "@/components/editorial";
import { PageMasthead } from "@/components/page-masthead";
import { MaturityVsReadinessNote } from "@/components/maturity-vs-readiness-note";
import { ReadinessHeadlineStat } from "@/components/readiness/readiness-headline-stat";
import { ReadinessTierBand } from "@/components/readiness/readiness-tier-band";
import { ReadinessRankTable } from "@/components/readiness/readiness-rank-table";
import { formatDate, formatNumber } from "@/lib/formatting";
import { buildReadinessViewModel } from "./_view-model";

export const metadata = {
  title: "Federal AI Readiness · IFP",
  description:
    "A published rubric scoring federal agencies on internal capacity, frontier capability, procurement hygiene, risk-relevant governance, and adoption breadth.",
};

export default async function ReadinessPage() {
  const {
    ranked,
    tiers,
    headline,
    vendors,
    vendorHerfindahl,
    frontier,
    reporting,
    totalScored,
    internalBuildPct,
    purchasedPct,
    unreportedPct,
    productionPct,
    fedrampLinkedPct,
    fedrampFloorPct,
    complianceGapPct,
    complianceGapHighImpactPct,
    rubricVersion,
    aiAccess,
  } = await buildReadinessViewModel();

  return (
    <>
    <PageSubnav
      tabs={[
        { id: "overview", label: "Overview" },
        { id: "headline", label: "Headline" },
        { id: "league-table", label: "League table" },
        { id: "ranked", label: "Ranked" },
        { id: "sub-stories", label: "Sub-stories" },
      ]}
    />
    <div className="mx-auto w-full max-w-[1400px] px-4 py-14 md:px-8 md:py-20">
      {/* ----------------------------------------------------------------- */}
      {/* Top banner — data-as-of + methodology link                         */}
      {/* ----------------------------------------------------------------- */}
      <aside className="border-l-4 border-border bg-muted/20 px-4 py-2 text-sm text-muted-foreground">
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
      {/* HERO — masthead                                                    */}
      {/* ----------------------------------------------------------------- */}
      <div className="mt-10 md:mt-14">
      <PageMasthead
        id="overview"
        kicker={`No. 002 · Filed · Readiness Index v${rubricVersion}`}
        title={
          <>
            Federal AI{" "}
            <span className="relative inline-block">
              <span
                aria-hidden
                className="absolute inset-x-[-0.06em] bottom-[0.16em] h-[0.36em] bg-[var(--highlight)]/90"
              />
              <span className="relative">Readiness</span>
            </span>
          </>
        }
        lede={
          <>
            Across{" "}
            <span className="font-medium text-foreground">
              {formatNumber(totalScored)} federal agencies
            </span>{" "}
            scored against a published rubric of state-capacity signals,{" "}
            <span className="font-medium text-foreground">
              {internalBuildPct}%
            </span>{" "}
            of federal AI is built in-house and{" "}
            <span className="font-medium text-foreground">{purchasedPct}%</span>{" "}
            is purchased commercial tooling — but{" "}
            <span className="font-medium text-foreground">{unreportedPct}%</span>{" "}
            of filings don&apos;t say either way, a disclosure gap that is
            itself a finding. Just{" "}
            <span className="font-medium text-foreground">{productionPct}%</span>{" "}
            of active use cases have reached deployed status; the rest sit in
            pilots, pre-deployment, or acquisition. FedRAMP-authorized
            infrastructure covers{" "}
            <span className="font-medium text-foreground">
              {fedrampLinkedPct}%
            </span>{" "}
            of the use cases that name an identifiable product. These are the
            gaps between AI policy ambition and operational capacity.
          </>
        }
      />
      </div>

      <MaturityVsReadinessNote className="mt-8" />

      {/* ----------------------------------------------------------------- */}
      {/* § 01 — THE HEADLINE                                                */}
      {/* ----------------------------------------------------------------- */}
      <Section
        id="headline"
        number="01"
        title="The headline"
        lede="One quotable number that frames the gap between AI policy ambition and operational capacity."
        source="derived"
      >
        <ReadinessHeadlineStat
          value={internalBuildPct}
          unit="%"
          label="of federal AI is built in-house"
          caption={`Across all ${formatNumber(totalScored)} agencies' reported use cases · capacity-first stat, not a compliance one · IFP-derived from OMB M-25-21 inventory`}
          variant="big"
          href="/readiness/methodology#internal-build"
        />
        <div
          id="build-split"
          className="mt-6 scroll-mt-36 border-t border-dotted border-border pt-5 space-y-2"
        >
          <ReadinessHeadlineStat
            value={purchasedPct}
            unit="%"
            label="is purchased commercial tooling"
            variant="inline"
            href="/readiness/methodology#build-split"
          />
          <ReadinessHeadlineStat
            value={unreportedPct}
            unit="%"
            label="doesn't report a build type at all — the disclosure gap is itself a finding"
            variant="inline"
            href="/readiness/methodology#missingness"
          />
        </div>
        <div className="mt-6 border-t border-dotted border-border pt-5 space-y-2">
          <ReadinessHeadlineStat
            value={productionPct}
            unit="%"
            label="of active use cases have reached deployed status (pilots, pre-deployment, and acquisition don't count; retired excluded from the denominator)"
            variant="inline"
            href="/readiness/methodology#production-rate"
          />
          <ReadinessHeadlineStat
            value={fedrampLinkedPct}
            unit="%"
            label="of use cases with an identified product run on FedRAMP-authorized infrastructure"
            variant="inline"
            href="/readiness/methodology#fedramp"
          />
          <ReadinessHeadlineStat
            value={fedrampFloorPct}
            unit="%"
            label="of all use cases, as a floor — most filings never name a product to check"
            variant="inline"
            href="/readiness/methodology#fedramp"
          />
        </div>
        <p className="mt-6 font-display italic text-[1.05rem] leading-snug text-muted-foreground">
          Every number here is computed deterministically from the OMB M-25-21
          inventory and the FedRAMP marketplace, and will move as agencies file
          corrections. A separate compliance baseline — that {complianceGapPct}%
          of use cases lack the M-25-21 risk-documentation fields, rising to{" "}
          {complianceGapHighImpactPct}% among the high-impact use cases for
          which Section 5 makes those fields conditionally required — is
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
        id="league-table"
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
      {/* AI Access & Scale — teaser linking to /readiness/access            */}
      {/* ----------------------------------------------------------------- */}
      {aiAccess ? (
        <Link
          href="/readiness/access"
          className="group mt-6 block border border-border bg-[var(--highlight)]/10 p-5 transition-colors hover:border-foreground md:p-6"
        >
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Companion view
          </div>
          <div className="mt-1 font-display text-[1.6rem] italic leading-tight text-foreground">
            AI Access &amp; Scale
          </div>
          <p className="mt-2 max-w-prose text-sm leading-snug text-foreground/85">
            Readiness scores how well agencies <em>build and govern</em> AI.
            The companion view asks a blunter question — how widely is a
            general-purpose AI tool actually <em>available</em> to staff?{" "}
            <span className="font-medium text-foreground">
              {aiAccess.by_coverage.all} of {aiAccess.total_agencies} CFO Act
              agencies have made one available to all employees
            </span>
            ; {aiAccess.by_coverage.partial + aiAccess.by_coverage.pilot} run
            partial or pilot deployments. Every finding is source-backed.
          </p>
          <div className="mt-3 font-mono text-xs font-medium text-foreground underline decoration-dotted underline-offset-4 group-hover:text-[var(--stamp)]">
            See AI Access &amp; Scale →
          </div>
        </Link>
      ) : null}

      {/* ----------------------------------------------------------------- */}
      {/* § 03 — RANKED                                                      */}
      {/* ----------------------------------------------------------------- */}
      <Section
        id="ranked"
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
        id="sub-stories"
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
                  share of vendor-attributed federal AI use cases — the largest
                  alone reaches{" "}
                  <span className="font-medium text-foreground tabular-nums">
                    {vendors[0].share_of_all_pct.toFixed(1)}%
                  </span>{" "}
                  of all reported use cases. A Herfindahl-style concentration
                  index over their attributed shares lands at{" "}
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
              <table className="mt-4 w-full border-collapse border border-border text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="border-b border-border px-2 py-2 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      Vendor
                    </th>
                    <th className="border-b border-border px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      Use cases
                    </th>
                    <th className="border-b border-border px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      Agencies
                    </th>
                    <th className="border-b border-border px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      Share % (attributed)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.slice(0, 5).map((v) => (
                    <tr key={v.vendor} className="border-b border-border">
                      <td className="px-2 py-2 font-display italic text-foreground">
                        {v.vendor}
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums">
                        {formatNumber(v.use_case_count)}
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums">
                        {formatNumber(v.agency_count)}
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums">
                        {v.share_of_attributed_pct.toFixed(1)}%
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
              <table className="mt-4 w-full border-collapse border border-border text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="border-b border-border px-2 py-2 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      Agency
                    </th>
                    <th className="border-b border-border px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      Frontier UC
                    </th>
                    <th className="border-b border-border px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      Total UC
                    </th>
                    <th className="border-b border-border px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      % Frontier
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {frontier.slice(0, 5).map((row) => (
                    <tr
                      key={row.agency_abbreviation}
                      className="border-b border-border"
                    >
                      <td className="px-2 py-2">
                        <Link
                          href={`/agencies/${row.agency_abbreviation.toLowerCase()}#scorecard`}
                          className="hover:text-[var(--stamp)]"
                        >
                          <span className="font-mono text-xs font-semibold uppercase tracking-[0.04em] text-foreground">
                            {row.agency_abbreviation}
                          </span>
                          <span className="ml-2 font-display italic text-foreground">
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
                      <td className="px-2 py-2 text-right font-mono tabular-nums font-semibold text-foreground">
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
              <table className="mt-4 w-full border-collapse border border-border text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="border-b border-border px-2 py-2 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      Agency
                    </th>
                    <th className="border-b border-border px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      Fields
                    </th>
                    <th className="border-b border-border px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      Avg completion
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reporting.slice(0, 5).map((row) => (
                    <tr
                      key={row.agency_abbreviation}
                      className="border-b border-border"
                    >
                      <td className="px-2 py-2">
                        <Link
                          href={`/agencies/${row.agency_abbreviation.toLowerCase()}#scorecard`}
                          className="hover:text-[var(--stamp)]"
                        >
                          <span className="font-mono text-xs font-semibold uppercase tracking-[0.04em] text-foreground">
                            {row.agency_abbreviation}
                          </span>
                          <span className="ml-2 font-display italic text-foreground">
                            {row.agency_name}
                          </span>
                        </Link>
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums">
                        {formatNumber(row.fields_evaluated)}
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums font-semibold text-foreground">
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
      <footer className="mt-20 border-t-2 border-foreground pt-6 text-sm text-foreground">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div className="space-y-1">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Federal AI Readiness Index v{rubricVersion} ·{" "}
              <Link
                href="/readiness/methodology"
                className="underline decoration-dotted underline-offset-4 hover:text-[var(--stamp)]"
              >
                methodology
              </Link>
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Data as of {formatDate(headline.computed_at)}
            </div>
          </div>
          <div className="max-w-md border-l-2 border-border pl-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Suggested citation: IFP, &ldquo;Federal AI Readiness Index,&rdquo;
            use-case-inventory.vercel.app/readiness, accessed{" "}
            {formatDate(new Date().toISOString())}.
          </div>
        </div>
      </footer>
    </div>
    </>
  );
}
