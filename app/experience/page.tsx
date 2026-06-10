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
 *   - What is the rough total workforce-AI seat count we can extrapolate?
 *
 * Designed to support an IFP essay on federal LLM access.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { MonoChip, Section } from "@/components/editorial";
import { GenAiByStageChart } from "@/components/experience/genai-by-stage-chart";
import { EnterpriseTierChart } from "@/components/experience/enterprise-tier-chart";
import { GenAiTimelineChart } from "@/components/experience/genai-timeline-chart";
import { AgencyToolMatrix } from "@/components/experience/agency-tool-matrix";
import { SeatsByAgencyChart } from "@/components/experience/seats-by-agency-chart";
import { SeatsHeadcountChart } from "@/components/experience/seats-headcount-chart";
import { SeatsAgencyDetails } from "@/components/experience/seats-agency-details";
import { PageNav } from "@/components/experience/page-nav";
import {
  CapabilityLadder,
  CapabilityLadderFootnote,
} from "@/components/experience/capability-ladder";
import { buildExperienceViewModel } from "./_view-model";

export const metadata: Metadata = {
  title: "AI Experience · Federal AI Readiness",
  description:
    "What LLM access an average civil servant has — by definition, by year, by agency, and at workforce scale.",
};

function fmt(n: number): string {
  return n.toLocaleString();
}

export default async function ExperiencePage() {
  const vm = await buildExperienceViewModel();
  const {
    headlines,
    crosstab,
    timeline,
    seats,
    matrix,
    yearCompare,
    ladder,
    enterpriseTiers,
    totalSeatsMidpoint,
    totalSeatsLower,
    totalSeatsUpper,
  } = vm;

  const ombHeadline = headlines.find((h) => h.definition === "omb");
  const ifpHeadline = headlines.find((h) => h.definition === "ifp_genai");
  const llmHeadline = headlines.find((h) => h.definition === "ifp_llm_access");
  const enterpriseHeadline = headlines.find(
    (h) => h.definition === "ifp_enterprise",
  );

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
      <header className="mt-10 max-w-3xl">
        <h1 className="font-display italic text-[2.6rem] leading-[0.95] tracking-[-0.02em] text-foreground md:text-[3.6rem]">
          The AI experience of an average civil servant
        </h1>
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Before and after the AI Action Plan · 2024–2025
        </p>
        <p className="mt-6 text-lg leading-relaxed text-foreground">
          The 2024 federal AI use case inventory listed{" "}
          <strong>{fmt(yearCompare.count_2024_tagged)}</strong> IFP-tagged
          generative-AI use cases across {fmt(yearCompare.total_2024)} total.
          The 2025 inventory lists between{" "}
          <strong>{fmt(ombHeadline?.total ?? 0)}</strong>{" "}
          and <strong>{fmt(llmHeadline?.total ?? 0)}</strong> — depending on
          whose definition of &ldquo;Generative AI&rdquo; you trust. Of those,
          roughly <strong>{fmt(enterpriseHeadline?.total ?? 0)}</strong> are
          tagged as enterprise-wide LLM access — a working-day chat surface
          available to a whole agency&apos;s staff. Beneath those use-case
          counts sit somewhere between{" "}
          <strong>{fmt(totalSeatsLower)}</strong> and{" "}
          <strong>{fmt(totalSeatsUpper)}</strong> employee seats with some
          form of AI tool, extrapolated from the license bands agencies filed
          in their consolidated inventory.
        </p>
      </header>

      {/* Methodology aside */}
      <aside className="mt-8 max-w-3xl border-l-4 border-[var(--stamp)] bg-stone-50 px-5 py-4">
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
          <strong>&ldquo;Estimated seats&rdquo;</strong> comes in two
          flavors, displayed side-by-side. <strong>Filed bands</strong> sums
          the license-band midpoints agencies self-reported in the
          consolidated inventory. <strong>Headcount-derived</strong>{" "}
          multiplies each agency&apos;s workforce by an IFP-researched
          AI-eligible share (excluding e.g. VHA clinical staff, USPS letter
          carriers, TSA screeners) and the share-of-eligible per tool from
          the{" "}
          <Link
            href="/readiness/access"
            className="underline-offset-2 hover:underline"
          >
            AI Access &amp; Scale
          </Link>{" "}
          evidence. Neither replaces the other.
        </p>
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
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-1.5"></th>
                  <th className="py-1.5 text-right font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    IFP says GenAI
                  </th>
                  <th className="py-1.5 text-right font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    IFP says not
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/50">
                  <td className="py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    OMB says GenAI
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {fmt(crosstab.omb_genai_ifp_genai)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {fmt(crosstab.omb_genai_ifp_not)}
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    OMB says not
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {fmt(crosstab.omb_not_ifp_genai)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {fmt(crosstab.omb_not_ifp_not)}
                  </td>
                </tr>
              </tbody>
            </table>
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
        lede="Operational-date year of deployed GenAI use cases, with the AI Action Plan release marked. The curve was bending before July 2025."
      >
        <GenAiTimelineChart data={timeline} />
      </Section>

      {/* § 03 — Tool matrix */}
      <div id="section-03" className="scroll-mt-24" />
      <Section
        number="03"
        title="Who has what?"
        source="omb-derived"
        lede="For each agency, the largest license-band reported on the consolidated inventory for each major LLM tool family. Coarse on purpose — bands are agency-filed."
      >
        <AgencyToolMatrix rows={matrix} />
      </Section>

      {/* § 04 — Seat extrapolation: two parallel estimates */}
      <div id="section-04" className="scroll-mt-24" />
      <Section
        number="04"
        title="Estimated seats, top agencies"
        source="omb-derived"
        lede="Two estimates, neither replacing the other. Filed bands come from the consolidated inventory's self-reported license bands. Headcount-derived multiplies each agency's workforce by an IFP-researched eligible share and the share-of-eligible per tool."
      >
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Filed bands · OMB-self-reported
            </p>
            <SeatsByAgencyChart rows={seats} />
          </div>
          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--stamp)]">
              Headcount-derived · IFP-researched
            </p>
            <SeatsHeadcountChart rows={matrix} />
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Across all {seats.length} agencies with at least one license band on
          file, the midpoint sum is{" "}
          <strong>{fmt(totalSeatsMidpoint)}</strong> seats, with defensible
          bounds of {fmt(totalSeatsLower)} (lower-bound) to{" "}
          {fmt(totalSeatsUpper)} (upper-bound). The federal civilian workforce
          is roughly 2.1 million people, so the midpoint implies the average
          covered employee has 1–2 tool entitlements; the upper bound implies
          considerable overlap (Copilot + ChatGPT + Gemini, etc.).
        </p>

        <SeatsAgencyDetails rows={matrix} />
      </Section>

      {/* § 05 — The capability ladder */}
      <div id="section-05" className="scroll-mt-24" />
      <Section
        number="05"
        title="The capability ladder"
        source="derived"
        lede="Adoption climbed one rung. A chat assistant is now the normal federal experience; a coding assistant is still the exception; AI on real agency data barely registers in the inventory at all."
      >
        <CapabilityLadder data={ladder} />
        <CapabilityLadderFootnote />
      </Section>

      {/* § 06 — What the inventory can't tell you */}
      <div id="section-06" className="scroll-mt-24" />
      <Section
        number="06"
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

      {/* Footer */}
      <footer className="mt-12 border-t border-border pt-5 font-mono text-[11px] leading-relaxed text-muted-foreground">
        <p>
          {fmt(yearCompare.total_2025)} use cases in the 2025 inventory ·{" "}
          {fmt(yearCompare.total_2024)} in 2024 · OMB classifies{" "}
          {fmt(ombHeadline?.total ?? 0)} as GenAI · IFP tags{" "}
          {fmt(ifpHeadline?.total ?? 0)} as GenAI ·{" "}
          {fmt(enterpriseHeadline?.total ?? 0)} flagged enterprise-wide LLM.
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
