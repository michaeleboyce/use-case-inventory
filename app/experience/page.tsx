/**
 * /experience — "What LLM access does an average civil servant have?"
 *
 * One page consolidating the answer to:
 *   - How much Generative AI sits in the 2025 federal inventory?
 *   - How does that depend on whether you trust OMB's classification or
 *     IFP's post-hoc tagging?
 *   - When did each deployed GenAI use case go live (and was the AI
 *     Action Plan a turning point or a ratification)?
 *   - Which agencies have which LLM tools, and at roughly what seat count?
 *   - How many federal employees actually have at least one AI tool, once
 *     the filed bands are corrected for repetition, non-people units, and
 *     workforce ceilings (the stratified-overlap model)?
 *
 * Designed to support an IFP essay on federal LLM access.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { MonoChip, Section } from "@/components/editorial";
import { PageMasthead } from "@/components/page-masthead";
import { GenAiByStageChart } from "@/components/experience/genai-by-stage-chart";
import { EnterpriseTierChart } from "@/components/experience/enterprise-tier-chart";
import { GenAiTimelineChart } from "@/components/experience/genai-timeline-chart";
import { AgencyToolMatrix } from "@/components/experience/agency-tool-matrix";
import { SeatsByAgencyChart } from "@/components/experience/seats-by-agency-chart";
import { SeatsHeadcountChart } from "@/components/experience/seats-headcount-chart";
import { SeatsAgencyDetails } from "@/components/experience/seats-agency-details";
import { SeatWaterfallChart } from "@/components/experience/seat-waterfall-chart";
import { buildSeatNarrative } from "@/lib/seat-narrative";
import { EstimatorScatter } from "@/components/experience/estimator-scatter";
import { SensitivityRange } from "@/components/experience/sensitivity-range";
import { PopulationTelescope } from "@/components/experience/population-telescope";
import { PeopleWaffle } from "@/components/charts/people-waffle";
import { buildFrontierAccessModel } from "@/app/_view-models/frontier-access";
import { buildAccessTrajectoriesModel } from "@/app/_view-models/access-trajectories";
import { AccessShareSlope } from "@/components/charts/access-share-slope";
import { DefinitionEuler } from "@/components/experience/definition-euler";
import { PageNav } from "@/components/experience/page-nav";
import {
  CapabilityLadder,
  CapabilityLadderFootnote,
} from "@/components/experience/capability-ladder";
import {
  EXCLUDED_AGENCY_ABBRS,
  type GenAiDefinition,
} from "@/lib/experience-shared";
import { buildExperienceViewModel } from "./_view-model";

export const metadata: Metadata = {
  title: "AI Experience · Federal AI Readiness",
  description:
    "What LLM access an average civil servant has — by definition, by year, by agency, and at workforce scale.",
};

function fmt(n: number): string {
  return n.toLocaleString();
}

/** Human phrase naming each headline definition inside prose. */
const DEFINITION_PHRASE: Record<GenAiDefinition, string> = {
  omb: "OMB's own filed classification",
  ifp_genai: "IFP's narrative re-tag",
  ifp_llm_access: "general LLM access",
  ifp_enterprise: "enterprise-wide LLM access",
};

export default async function ExperiencePage() {
  const vm = await buildExperienceViewModel();
  const {
    headlines,
    crosstab,
    timeline,
    earlyTail,
    seats,
    matrix,
    yearCompare,
    ladder,
    enterpriseTiers,
    totalSeatsMidpoint,
    totalSeatsLower,
    totalSeatsUpper,
    seatModel,
    waterfall,
    sensitivity,
    scatter,
    evidencedFloorTotal,
    filedDedupedTotal,
  } = vm;

  const ombHeadline = headlines.find((h) => h.definition === "omb");
  const ifpHeadline = headlines.find((h) => h.definition === "ifp_genai");

  // FedRAMP reach-vs-access sidecar — this page has no other FedRAMP
  // dependency, so the waffle renders only when those tables are present.
  let frontierAccess: ReturnType<typeof buildFrontierAccessModel> = null;
  try {
    frontierAccess = buildFrontierAccessModel();
  } catch {
    frontierAccess = null;
  }
  const accessTrajectories = buildAccessTrajectoriesModel();
  const enterpriseHeadline = headlines.find(
    (h) => h.definition === "ifp_enterprise",
  );

  // Min / max over ALL four headline definitions, with the definition that
  // produced each end named — the honest "it depends on your definition"
  // range for the lede.
  // Range spans the three FULL definitions; enterprise is a subset of
  // LLM access and gets its own sentence, so including it here would make
  // the lede's "Of those, roughly N are enterprise-wide" redundant.
  const fullDefinitions = headlines.filter(
    (h) => h.definition !== "ifp_enterprise",
  );
  const headlineMin = fullDefinitions.reduce((a, h) =>
    h.total < a.total ? h : a,
  );
  const headlineMax = fullDefinitions.reduce((a, h) =>
    h.total > a.total ? h : a,
  );

  const totals = seatModel.totals;

  // Top modeled agencies for the drill-in grid (already sorted by central).
  const topModeled = seatModel.agencies
    .filter((a) => a.modeled && a.central != null)
    .slice(0, 12);

  return (
    <main className="mx-auto max-w-[1400px] px-4 pb-24 md:px-8">
      {/* Dateline */}
      <div className="mt-6 flex flex-wrap items-baseline gap-3 border-b border-border pb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        <MonoChip tone="stamp" size="xs">
          IFP
        </MonoChip>
        <span>AI Experience</span>
        <span aria-hidden className="text-muted-foreground/50">
          ·
        </span>
        <Link
          href="/readiness"
          className="underline-offset-2 hover:text-foreground hover:underline"
        >
          ← Back to scorecard
        </Link>
      </div>

      {/* Header */}
      <div className="mt-10">
        <PageMasthead
          kicker="§ VI · Features"
          metaLines={["Before and after the AI Action Plan · 2024–2025"]}
          title="The AI experience of an average civil servant"
          lede={
            <>
              The 2024 federal AI use case inventory listed{" "}
              <strong>{fmt(yearCompare.count_2024_tagged)}</strong> IFP-tagged
              generative-AI use cases across {fmt(yearCompare.total_2024)} total.
              The 2025 inventory lists between{" "}
              <strong>{fmt(headlineMin.total)}</strong> (
              {DEFINITION_PHRASE[headlineMin.definition]}) and{" "}
              <strong>{fmt(headlineMax.total)}</strong> (
              {DEFINITION_PHRASE[headlineMax.definition]}) generative-AI use
              cases — depending on whose definition of &ldquo;Generative
              AI&rdquo; you trust. Of those, roughly{" "}
              <strong>{fmt(enterpriseHeadline?.total ?? 0)}</strong> are tagged
              as enterprise-wide LLM access — a working-day chat surface
              available to a whole agency&apos;s staff. Beneath the use-case
              counts, our best estimate is that{" "}
              <strong>{fmt(totals.central)}</strong> federal employees — of the{" "}
              <strong>{fmt(totals.eligible_total)}</strong> whose jobs could
              use one, across {fmt(totals.agencies_modeled)} agencies — have at
              least one AI tool (no fewer than {fmt(totals.floor)}, no more
              than {fmt(totals.ceiling)}). That replaces the older uncorrected
              sum of {fmt(totalSeatsMidpoint)} seats, which double-counted
              people across tools and task rows;{" "}
              <a
                href="#section-04"
                className="underline underline-offset-2 hover:text-foreground"
              >
                see the seat methodology
              </a>
              .
            </>
          }
        />
      </div>

      {/* Methodology aside */}
      <aside className="mt-8 max-w-3xl border-l-4 border-[var(--stamp)] bg-muted/20 px-5 py-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          How to read this page
        </p>
        <p className="mt-2 text-sm leading-relaxed text-foreground">
          <strong>&ldquo;Generative AI&rdquo;</strong> is contested. OMB&apos;s
          M-25-21 inventory asks agencies to self-classify each use case&apos;s
          AI type, but agencies disagree wildly — a chatbot routing call-center
          traffic shows up tagged as &ldquo;NLP,&rdquo; a classical-ML
          risk-scoring model gets filed as &ldquo;GenAI.&rdquo; IFP
          independently re-tagged every 2025 use case from its narrative
          columns. Every chart accepts a <strong>definition toggle</strong>{" "}
          letting you flip between OMB&apos;s filed classification and IFP&apos;s
          three derived definitions.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-foreground">
          <strong>&ldquo;How many people have AI&rdquo;</strong> is not the same
          as summing the filed license bands. Agencies file one band per task
          row, count devices and members of the public alongside employees, and
          license several overlapping tools to the same staff. §04 walks the{" "}
          <Link
            href="/experience/methodology"
            className="underline-offset-2 hover:underline"
          >
            stratified-overlap model
          </Link>{" "}
          that corrects for all three; the older uncorrected band sum is kept
          on the page, explicitly labeled, for comparison.
        </p>
      </aside>

      {/* Scope aside — the two agencies absent from the inventory by policy. */}
      <aside className="mt-4 max-w-3xl border-l-2 border-border bg-background px-5 py-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
        <span className="uppercase tracking-[0.14em] text-foreground">
          Scope ·{" "}
        </span>
        {EXCLUDED_AGENCY_ABBRS.join(" and ")} are absent from the M-25-21
        inventory by policy — the Department of Defense (~770,000 civilians) and
        the U.S. Postal Service file separately. Every count and seat estimate
        on this page excludes them.
      </aside>

      {/* In-page section navigation. Sticky just below the masthead. */}
      <PageNav />

      {/* § 01 — Headline counts and disagreement */}
      <div id="section-01" className="scroll-mt-24" />
      <Section
        number="01"
        title="How much Generative AI?"
        source="omb-derived"
        lede="The same inventory yields four different GenAI counts depending on whose definition you trust. Pick one and the chart shows what share is actually deployed."
      >
        <GenAiByStageChart data={headlines} />

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="border border-border p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              OMB &times; IFP disagreement
            </p>
            <div className="mt-3">
              <DefinitionEuler crosstab={crosstab} headlines={headlines} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              The two off-diagonal cells {" "}
              <strong>
                {fmt(
                  crosstab.omb_genai_ifp_not + crosstab.omb_not_ifp_genai,
                )}
              </strong>{" "}
              use cases are where the labels disagree.
            </p>
          </div>

          <div className="border border-border p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              2024 → 2025 baseline
            </p>
            <p className="mt-3 text-sm leading-relaxed">
              IFP re-tagged the 2024 inventory with the same narrative
              definitions used for 2025, so the two cycles are now directly
              comparable. The IFP-tagged GenAI count was{" "}
              <strong>{fmt(yearCompare.count_2024_tagged)}</strong> in 2024 —
              roughly{" "}
              <strong>
                {Math.round(
                  (yearCompare.count_2024_tagged / yearCompare.total_2024) *
                    100,
                )}
                %
              </strong>{" "}
              of {fmt(yearCompare.total_2024)} use cases — rising to{" "}
              <strong>{fmt(ifpHeadline?.total ?? 0)}</strong> by 2025,{" "}
              <strong>
                {Math.round(
                  ((ifpHeadline?.total ?? 0) / yearCompare.total_2025) * 100,
                )}
                %
              </strong>{" "}
              of {fmt(yearCompare.total_2025)} filings.
            </p>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Both counts use IFP&apos;s <code>is_generative_ai</code> tag
              (2024 from <code>use_case_tags_2024_canonical</code>, 2025 from{" "}
              <code>use_case_tags</code>) — a like-for-like re-tag rather than
              agency self-classification.
            </p>
          </div>
        </div>

        {enterpriseTiers.length > 0 ? (
          <div className="mt-10">
            <h3 className="font-display text-xl italic">
              What &ldquo;enterprise-wide&rdquo; meant changed in kind
            </h3>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-foreground/85">
              The enterprise-wide GenAI count didn&apos;t just grow — its
              composition flipped. In 2024 the modal enterprise row was a{" "}
              <strong>permission memo</strong> (&ldquo;employees are permitted
              to use commercial generative AI&rdquo;), an AI feature{" "}
              <strong>embedded in software the agency already licensed</strong>
              , or a small agency switching on Copilot — and the permission
              rows explicitly prohibited internal data. By 2025 the dominant
              tier is the <strong>operated internal service</strong>: a named,
              governed chat tool — tenanted (OPM&apos;s ChatGPT Enterprise,
              HHS&apos;s Claude for Government) or purpose-built (StateChat,
              DHSChat, GSAi, SSA&apos;s ASC) — approved to touch internal
              data. The unlock wasn&apos;t the model; it was a perimeter that
              let AI touch the actual work.
            </p>
            <div className="mt-5">
              <EnterpriseTierChart data={enterpriseTiers} />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Tier classification is rule-based with hand-reviewed overrides
              (tool names, use-case titles, and M-24-10 task phrases);
              per-row assignments and the rule that fired are persisted in the
              ETL repo under{" "}
              <code>audit/retag/enterprise-scope-2026-06/</code>. Counts use
              the scope-corrected enterprise tags and include pre-deployment
              and retired rows.
            </p>
          </div>
        ) : null}
      </Section>

      {/* § 02 — Timeline */}
      <div id="section-02" className="scroll-mt-24" />
      <Section
        number="02"
        title="When did the wave land?"
        source="omb-derived"
        lede="Operational-date year of deployed GenAI use cases, with the AI Action Plan release marked. The curve was bending before July 2025 — and the pre-2023 tail is mostly definitional, not early adoption."
      >
        <GenAiTimelineChart data={timeline} />
        {earlyTail.length > 0 ? (
          <details className="mt-4 border border-border bg-background px-4 py-3">
            <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground hover:text-[var(--stamp)]">
              The pre-2023 tail, itemized — {earlyTail.length} deployed
              entries with a pre-2023 go-live
            </summary>
            <p className="mt-3 max-w-prose text-xs leading-relaxed text-muted-foreground">
              Why these exist: <code>operational_date</code> is the{" "}
              <em>system&apos;s</em> go-live, so several are older systems
              that added GenAI later; some are pre-LLM generative tech
              (report generation, speech synthesis, translation); the rest
              carry an IFP tag beyond the agency&apos;s own classification —
              the right column shows what the agency filed.
            </p>
            <ul className="mt-3 divide-y divide-border/60">
              {earlyTail.map((r) => (
                <li
                  key={`${r.agency_abbreviation}-${r.use_case_name}-${r.year}`}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-1.5 text-xs"
                >
                  <span className="w-10 font-mono tabular-nums text-muted-foreground">
                    {r.year}
                  </span>
                  <span className="w-14 font-mono text-muted-foreground">
                    {r.agency_abbreviation}
                  </span>
                  {r.slug ? (
                    <Link
                      href={`/use-cases/${r.slug}`}
                      className="flex-1 basis-52 text-foreground underline decoration-dotted underline-offset-2 hover:text-[var(--stamp)]"
                    >
                      {r.use_case_name}
                    </Link>
                  ) : (
                    <span className="flex-1 basis-52 text-foreground">
                      {r.use_case_name}
                    </span>
                  )}
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                    filed: {r.declared_classification}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </Section>

      {/* § 03 — Tool matrix */}
      <div id="section-03" className="scroll-mt-24" />
      <Section
        number="03"
        title="Who has what?"
        source="omb-derived"
        lede="For each agency, the largest license-band reported on the consolidated inventory for each major LLM tool family. Coarse on purpose — bands are agency-filed."
      >
        <AgencyToolMatrix
          rows={matrix}
          bestEstimateByAgencyId={Object.fromEntries(
            seatModel.agencies
              .filter((a) => a.modeled && a.central != null)
              .map((a) => [a.agency_id, a.central as number]),
          )}
        />
      </Section>

      {/* § 04 — The corrected seat model */}
      <div id="section-04" className="scroll-mt-24" />
      <Section
        number="04"
        title="How many people actually have AI?"
        source="derived"
        lede="Filed license bands can't be summed — the same employees repeat across task rows and tools, and some bands count devices or the public. The stratified-overlap model corrects for all three and caps every agency at its own eligible workforce."
      >
        {/* The best estimate, stated as such. */}
        <div className="border-2 border-foreground p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--stamp)]">
            IFP best estimate · people with at least one AI tool
          </p>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-8 gap-y-3">
            <div>
              <span className="font-display text-5xl font-semibold tabular-nums tracking-tight text-foreground">
                {fmt(totals.central)}
              </span>
              <span className="ml-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                best estimate
              </span>
            </div>
            <div className="font-mono text-sm tabular-nums text-muted-foreground">
              at least{" "}
              <strong className="text-foreground">{fmt(totals.floor)}</strong>
              <span className="mx-2 text-muted-foreground/50">·</span>
              at most{" "}
              <strong className="text-foreground">{fmt(totals.ceiling)}</strong>
            </div>
          </div>
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-foreground/85">
            That is{" "}
            <strong>
              {Math.round((totals.central / totals.eligible_total) * 100)}%
            </strong>{" "}
            of the {fmt(totals.eligible_total)} AI-eligible employees across
            the {totals.agencies_modeled} agencies that filed license bands —
            DoD and USPS excluded by inventory policy.
          </p>
          {/* Where the estimate sits among the competing answers. */}
          <div className="mt-4 border-t border-border pt-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Where it sits
            </p>
            <div className="mt-2 grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  n: evidencedFloorTotal,
                  label: "Externally evidenced",
                  note: "press & official sources only; no public evidence = counts zero",
                  tone: "text-muted-foreground",
                },
                {
                  n: totals.central,
                  label: "IFP model (this page)",
                  note: "audited filings, deduped, workforce-capped",
                  tone: "text-[var(--stamp)] font-semibold",
                },
                {
                  n: filedDedupedTotal,
                  label: "Filings at face value",
                  note: "largest band per tool family, no overlap correction",
                  tone: "text-muted-foreground",
                },
                {
                  n: totalSeatsMidpoint,
                  label: "Naive sum (retired)",
                  note: "every task row summed — double-counts people",
                  tone: "text-muted-foreground line-through decoration-border",
                },
              ].map((e) => (
                <div key={e.label} className="border border-border px-2.5 py-2">
                  <div className={`font-mono text-sm tabular-nums ${e.tone}`}>
                    {fmt(e.n)}
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/80">
                    {e.label}
                  </div>
                  <div className="mt-0.5 leading-snug text-muted-foreground">
                    {e.note}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 max-w-prose text-xs leading-relaxed text-muted-foreground">
              The model sits between what can be proven from public sources
              alone and what the filings claim at face value — consistent with
              both, beholden to neither.
            </p>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            The three populations, to scale
          </p>
          <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted-foreground">
            Everyone employed at these agencies, the subset whose jobs could
            use an AI tool, and the subset we estimate actually has one — all
            on one scale, so the containment is the arithmetic. Pick an agency
            to see its proportions.
          </p>
          <div className="mt-5">
            <PopulationTelescope agencies={seatModel.agencies} />
          </div>
        </div>

        {frontierAccess ? (
          <div className="mt-8 border-t border-border pt-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Where the eligible workforce stands
            </p>
            <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted-foreground">
              The same eligible population, cross-referenced with FedRAMP:
              red squares are workers with no general-purpose tool at an
              agency that already holds an ATO on a package with a core-AI
              service in scope — capability in reach, nobody at the keyboard.
            </p>
            <div className="mt-5">
              <PeopleWaffle
                waffle={frontierAccess.waffle}
                compact
                crossLinkHref="/fedramp/coverage/agencies#reach-access"
              />
            </div>
          </div>
        ) : null}

        {accessTrajectories ? (
          <div className="mt-8 border-t border-border pt-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              How access grew, agency by agency
            </p>
            <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted-foreground">
              Each line is one agency&apos;s best web-corroborated share of
              eligible staff with a general-purpose AI tool, plotted at the
              dates the evidence carries. Only agencies with two or more
              dated findings are drawn (Treasury, flat at ~5%, is left off) —{" "}
              {accessTrajectories.climberCount} of them climbed 25+ points
              within their evidence window, while others started high.
              Evidence dates lag rollouts: every trajectory is a floor.
            </p>
            <div className="mt-5">
              <AccessShareSlope model={accessTrajectories} />
            </div>
          </div>
        ) : null}

        <p className="mt-10 max-w-prose border-t border-border pt-6 text-sm leading-relaxed text-foreground/85">
          The waterfall starts from the naive sum of every filed band — the
          number this page used to publish — and applies each correction as an
          explicit, labeled step: remove non-people units, count each
          population once (the largest band per role stratum stands in), then
          combine strata by independence and cap at the AI-eligible workforce.
          Nothing is silently dropped.
        </p>
        <div className="mt-6">
          <SeatWaterfallChart steps={waterfall} />
        </div>

        <div className="mt-10 border-t border-border pt-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Naive filed sum vs. corrected model, per agency
          </p>
          <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted-foreground">
            Each point is one modeled agency: the uncorrected band-midpoint sum
            on one axis, the model&apos;s central estimate on the other. Points
            far below the diagonal are where the naive sum most overcounts.
          </p>
          <div className="mt-5">
            <EstimatorScatter rows={scatter} />
          </div>
        </div>

        <div className="mt-10 border-t border-border pt-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            How much the answer moves
          </p>
          <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted-foreground">
            The central estimate under alternative scenarios — band ends,
            dropping low-confidence labels, excluding the clinical stratum.
          </p>
          <div className="mt-5">
            <SensitivityRange scenarios={sensitivity} />
          </div>
        </div>

        {topModeled.length > 0 ? (
          <div className="mt-10 border-t border-border pt-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              The logic, agency by agency
            </p>
            <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted-foreground">
              The {topModeled.length} largest modeled agencies. Expand any row
              for the step-by-step reasoning behind its estimate — generated
              from the model&apos;s own inputs — or click through for the full
              evidence page.
            </p>
            <div className="mt-4 space-y-1.5">
              {topModeled.map((a) => {
                const narrative = buildSeatNarrative(a);
                return (
                  <details
                    key={a.agency_id}
                    className="group/agency border border-border open:border-[var(--stamp)]"
                  >
                    <summary className="flex cursor-pointer list-none items-baseline justify-between gap-3 px-3 py-2 hover:bg-muted/30 [&::-webkit-details-marker]:hidden">
                      <span className="flex min-w-0 items-baseline gap-2">
                        <span
                          aria-hidden
                          className="font-mono text-[10px] text-muted-foreground transition-transform group-open/agency:rotate-90"
                        >
                          ▸
                        </span>
                        <span className="font-mono text-xs font-semibold text-foreground">
                          {a.abbreviation}
                        </span>
                        <span className="truncate text-[11px] text-muted-foreground">
                          {a.name}
                        </span>
                      </span>
                      <span className="whitespace-nowrap font-mono text-[11px] tabular-nums text-muted-foreground">
                        at least {fmt(a.floor ?? 0)}
                        <span className="text-muted-foreground/50"> · </span>
                        <span className="font-semibold text-foreground">
                          best est. {fmt(a.central ?? 0)}
                        </span>
                        <span className="text-muted-foreground/50"> · </span>
                        at most {fmt(a.ceiling ?? 0)}
                      </span>
                    </summary>
                    <div className="border-t border-border px-4 py-3">
                      <ol className="max-w-prose space-y-3">
                        {narrative.steps.map((step, i) => (
                          <li key={step.title} className="flex gap-3">
                            <span className="mt-0.5 font-mono text-[10px] font-semibold text-[var(--stamp)]">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <div>
                              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground">
                                {step.title}
                              </p>
                              <p className="mt-0.5 text-[13px] leading-relaxed text-foreground/85">
                                {step.body}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ol>
                      {narrative.conclusion ? (
                        <p className="mt-3 max-w-prose text-[13px] font-medium leading-relaxed text-foreground">
                          {narrative.conclusion}
                        </p>
                      ) : null}
                      <Link
                        href={`/experience/seats/${a.abbreviation.toLowerCase()}`}
                        className="mt-3 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-foreground hover:text-[var(--stamp)]"
                      >
                        Full evidence page: every filed row, label, and audit →
                      </Link>
                    </div>
                  </details>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="mt-6">
          <Link
            href="/experience/methodology"
            className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-foreground hover:text-[var(--stamp)]"
          >
            Full seat methodology →
          </Link>
        </div>
      </Section>

      {/* § 05 — Uncorrected filings view (the two launch estimates, relabeled) */}
      <div id="section-05" className="scroll-mt-24" />
      <Section
        number="05"
        title="What the raw filings imply (uncorrected)"
        source="omb-derived"
        lede="The two seat estimates this page shipped at launch, kept visible and relabeled. Both are what the raw filings imply before the overlap and ceiling corrections — neither is the headline anymore."
      >
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Filed bands · OMB self-reported (uncorrected)
            </p>
            <SeatsByAgencyChart rows={seats} />
          </div>
          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--stamp)]">
              Externally-evidenced floor · press &amp; official sources only
            </p>
            <SeatsHeadcountChart rows={matrix} />
            <p className="mt-2 max-w-prose text-xs leading-relaxed text-muted-foreground">
              Formerly labeled &ldquo;headcount-derived.&rdquo; It counts a
              tool only where a public source documents its rollout share —
              agencies with no press coverage contribute zero — so it is a
              floor on provable access, not an estimate of actual access.
            </p>
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Across all {seats.length} agencies with at least one license band on
          file, the uncorrected midpoint sum is{" "}
          <strong>{fmt(totalSeatsMidpoint)}</strong> seats (bounds{" "}
          {fmt(totalSeatsLower)}–{fmt(totalSeatsUpper)}), and the
          externally-evidenced floor is{" "}
          <strong>{fmt(evidencedFloorTotal)}</strong>. The corrected model in
          §04 sits between them at a central{" "}
          <strong>{fmt(totals.central)}</strong> people once repetition,
          non-people units, and workforce ceilings are removed.
        </p>

        <SeatsAgencyDetails rows={matrix} />
      </Section>

      {/* § 06 — The capability ladder */}
      <div id="section-06" className="scroll-mt-24" />
      <Section
        number="06"
        title="The capability ladder"
        source="derived"
        lede="Adoption climbed one rung. A chat assistant is now the normal federal experience; a coding assistant is still the exception; AI on real agency data barely registers in the inventory at all."
      >
        <CapabilityLadder data={ladder} />
        <CapabilityLadderFootnote />
      </Section>

      {/* § 07 — What the inventory can't tell you */}
      <div id="section-07" className="scroll-mt-24" />
      <Section
        number="07"
        title="What the inventory still won't tell you"
        source="derived"
        lede="The use-case inventory is a tool ledger, not a workforce-access ledger. These are the gaps an essay should name explicitly."
      >
        <ul className="space-y-3 text-sm leading-relaxed text-foreground">
          <li>
            <strong>How many employees actually have a license.</strong> A
            &ldquo;Deployed&rdquo; Microsoft 365 Copilot row could mean 50
            pilot users at one bureau or 80,000 enterprise seats. The
            consolidated inventory&apos;s license-band column is the only
            workforce-scale signal, and only ~436 of 900 rows have one.
          </li>
          <li>
            <strong>Whether usage is opt-in, default-on, or restricted.</strong>{" "}
            Education&apos;s 14 Microsoft Copilot use cases are filed by
            program area, not by who can log in. The inventory does not
            distinguish &ldquo;available to all staff&rdquo; from
            &ldquo;piloted by one OCFO team.&rdquo;
          </li>
          <li>
            <strong>What model sits behind a tool.</strong>{" "}
            &ldquo;Microsoft Copilot&rdquo; could be GPT-4-class one quarter
            and Phi-class the next; the inventory doesn&apos;t track model
            versioning or vendor changes.
          </li>
          <li>
            <strong>Rate limits, data-handling tiers, sensitive-data
            allowances.</strong> Two agencies both listing &ldquo;ChatGPT
            Enterprise&rdquo; may have wildly different effective access.
          </li>
          <li>
            <strong>Shadow IT.</strong> Employees pasting work into a personal
            ChatGPT account are invisible to the inventory by design.
          </li>
          <li>
            <strong>Cross-agency tools.</strong> GSA&apos;s USAi.gov is one row
            in GSA&apos;s inventory; the consuming agencies don&apos;t
            necessarily re-list it.
          </li>
        </ul>
      </Section>

      {/* Continue — cross-links onward from the essay */}
      <aside
        aria-label="Continue"
        className="mt-16 border-t-2 border-foreground pt-5 md:mt-24"
      >
        <div className="eyebrow mb-4 !text-[var(--stamp)]">Continue</div>
        <ul className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              href: "/experience/methodology",
              label: "Seat methodology",
              note: "how the corrected seat model is built",
            },
            {
              href: "/readiness/access",
              label: "AI Access & Scale",
              note: "the source-backed evidence base",
            },
            {
              href: "/compare-years",
              label: "2024 ↔ 2025",
              note: "how the two cycles compare",
            },
            {
              href: "/stories",
              label: "Opening the laptop",
              note: "the narrative arcs, agency by agency",
            },
          ].map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="group block">
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-foreground transition-colors group-hover:text-[var(--stamp)]">
                  {item.label} →
                </span>
                <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">
                  {item.note}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </aside>

      {/* Footer */}
      <footer className="mt-12 border-t border-border pt-5 font-mono text-[11px] leading-relaxed text-muted-foreground">
        <p>
          {fmt(yearCompare.total_2025)} use cases in the 2025 inventory ·{" "}
          {fmt(yearCompare.total_2024)} in 2024 · OMB classifies{" "}
          {fmt(ombHeadline?.total ?? 0)} as GenAI · IFP tags{" "}
          {fmt(ifpHeadline?.total ?? 0)} as GenAI ·{" "}
          {fmt(enterpriseHeadline?.total ?? 0)} flagged enterprise-wide LLM ·
          corrected seat model central {fmt(totals.central)} (
          {fmt(totals.floor)}–{fmt(totals.ceiling)}) across{" "}
          {fmt(totals.agencies_modeled)} agencies.
        </p>
        <p className="mt-2">
          Built for the Institute for Progress. ·{" "}
          <Link
            href="/readiness"
            className="underline-offset-2 hover:text-foreground hover:underline"
          >
            Federal AI Readiness
          </Link>
          .
        </p>
      </footer>
    </main>
  );
}
