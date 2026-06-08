import Link from "next/link";
import type { ReactNode } from "react";
import {
  Eyebrow,
  Figure,
  Section,
  SourceLegend,
} from "@/components/editorial";
import { InsightCard } from "@/components/insight-card";
import { formatNumber, formatPercent } from "@/lib/formatting";
import { buildSilentlyDroppedViewModel } from "./_view-model";
import { SilentlyDroppedAgencyTable } from "./_sections/agency-table";
import { SilentlyDroppedFullList } from "./_sections/full-list-table";
import { SilentlyDroppedLiveGenAiTable } from "./_sections/live-genai-table";

export const metadata = {
  title:
    "Silently dropped from the 2025 inventory · Federal AI Use Case Inventory",
  description:
    "Hundreds of use cases that were active in the 2024 federal AI inventory simply vanished from the 2025 filing — never marked Retired, contrary to OMB M-25-21's carry-forward guidance. The compliance gap, by agency and by deployment stage, with case studies.",
};

const STAGE_LABEL: Record<string, string> = {
  deployed: "Deployed",
  pilot: "Pilot · Implementation & Assessment",
  pre_deployment: "Pre-deployment",
  other: "Other / unclassified",
};

/** Round to the nearest `step` — used to present rounded headlines rather
 *  than precise figures, since the exact counts drift slightly with re-runs
 *  of the lineage adjudication pass. */
function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}

function paragraph(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Editorial commentary, keyed by `${agency}::${use_case_name}`. Each entry
 * is the one-line "what's notable" framing rendered beneath the example.
 * If a curated example has no commentary entry, the slot stays editorial-
 * neutral — we still show it, just without an editor's note.
 */
const EXAMPLE_NOTES: Record<string, ReactNode> = {
  "DOJ::Clearview AI": (
    <>
      A controversial commercial facial-recognition platform used in active
      investigations by the U.S. Marshals — described in the 2024 filing as
      operational and benefit-producing. Its absence from the 2025 inventory
      is not announced as a retirement; the use case simply isn&apos;t there.
    </>
  ),
  "DOI::Predictive AI Applications for Wildlife Monitoring: SeeOtter, a custom built software solution for a":
    (
      <>
        A custom-built YOLOv5 sea-otter detection model that USFWS, USGS, and
        NPS were jointly using for Marine Mammal Protection Act stock
        assessments. A working, in-production conservation system: gone from
        the 2025 filing with no carry-forward Retired marker.
      </>
    ),
  "HHS::ChatCDC - CDC Enterprise Generative AI Chatbot (Software Development)":
    (
      <>
        One of three ChatCDC variants HHS filed in 2024 — an enterprise
        Azure-OpenAI assistant CDC staff used for code generation and
        documentation. All three variants disappeared in 2025; none were
        filed as Retired.
      </>
    ),
  "Treasury::Automated Collection System (ACS) Voicebot": (
    <>
      A four-phase IRS taxpayer-facing voicebot, in production since 2022 by
      the 2024 filing&apos;s own account — handling balance-due payment plans,
      transcripts, and live-agent routing. Treasury filed in 2025 but
      didn&apos;t carry this forward in any form.
    </>
  ),
  "DOL::Adobe Creative Cloud and Adobe Product Suite": (
    <>
      Adobe Sensei&apos;s AI features inside Creative Cloud, filed as an
      operational use case in 2024. Indicative of a broader pattern: in
      2024 some agencies inventoried commercial-AI feature-sets as use
      cases. In 2025 the consolidated-product appendix absorbed many such
      entries, but this one left no Retired trace at DOL.
    </>
  ),
  "TVA::Extended Threat Detection": (
    <>
      An unsupervised-ML threat-detection capability filed by TVA as in
      production. Cyber-defense systems disappearing from a public AI
      inventory is the kind of gap that would matter to oversight more than
      it would to anyone else.
    </>
  ),
};

/** Render a stage bar with proportional fill, scaled to the largest bucket. */
function StageBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 w-full bg-[var(--rule)]/40">
      <div
        className="h-full bg-[var(--stamp)]"
        style={{ width: `${pct}%` }}
        aria-hidden
      />
    </div>
  );
}

export default async function SilentlyDroppedPage() {
  const vm = await buildSilentlyDroppedViewModel();
  const {
    summary,
    byStage,
    byAgency,
    byAgencyExpanded,
    allRows,
    examples,
    liveGenAi,
    liveGenAiGroups,
  } = vm;

  // Display-rounded headline counts.
  const headlineDrop = roundTo(summary.nonUsaidActiveDropped, 10);
  const headlineActive = roundTo(summary.activeDropped, 10);

  // Live-GenAI: total filings vs. distinct named capabilities. Several
  // agencies (Education most of all) filed many task-level entries under one
  // repeated name, so the raw row count overstates the number of systems.
  const liveGenAiFilings = liveGenAi.length;
  const liveGenAiDistinct = liveGenAiGroups.length;
  const liveGenAiLargestCluster = liveGenAiGroups.reduce<
    (typeof liveGenAiGroups)[number] | null
  >((best, g) => (best === null || g.count > best.count ? g : best), null);

  // Stage breakdown rendering helpers.
  const maxStageCount = Math.max(...byStage.map((b) => b.count), 1);
  const stageTotal = byStage.reduce((acc, b) => acc + b.count, 0);

  // Non-USAID agency rows, sorted by absolute drop count desc; USAID row
  // peeled out for a separate dissolved-agency callout.
  const usaidRow = byAgency.find((r) => r.is_dissolved) ?? null;
  // Use the expanded variant for the §III table so rows can drill into their
  // per-use-case lists inline. USAID is included (and renders the `dissolved`
  // marker) so its 137 dropped use cases can be inspected the same way as
  // every other agency's; the out-of-band callout above still flags the
  // categorical difference.
  const otherAgencyRows = byAgencyExpanded;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-14 md:px-8 md:py-20">
      {/* ------------------------------------------------------------ */}
      {/* HERO                                                          */}
      {/* ------------------------------------------------------------ */}
      <header className="ink-in grid grid-cols-12 gap-x-6 border-b border-border pb-12 md:pb-16">
        <aside className="col-span-12 mb-8 md:col-span-3 md:mb-0">
          <div className="sticky top-32 space-y-4">
            <div>
              <Link
                href="/compare-years"
                className="block font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-[var(--stamp)]"
              >
                ← 2024 ↔ 2025 overview
              </Link>
              <div className="eyebrow mt-3 !text-[var(--stamp)]">
                § Deep Dive
              </div>
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Silently-dropped finding
              </div>
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                M-25-21 · Carry-forward rule
              </div>
            </div>

            <div className="hidden space-y-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground md:block">
              <div className="border-t border-border pt-3">
                <div className="mb-0.5 text-[9px] text-muted-foreground/70">
                  Population
                </div>
                <div className="text-foreground">
                  {formatNumber(summary.total)} retired_2024 links
                </div>
              </div>
              <div>
                <div className="mb-0.5 text-[9px] text-muted-foreground/70">
                  Compliance gap
                </div>
                <div className="text-[var(--stamp)]">
                  ~{formatNumber(headlineDrop)} silently dropped
                </div>
              </div>
            </div>
          </div>
        </aside>

        <div className="col-span-12 md:col-span-9">
          <h1 className="font-display text-[clamp(2.4rem,6vw,5rem)] leading-[0.95] tracking-[-0.03em] text-foreground">
            <em className="inline font-normal italic">
              The use cases that vanished
            </em>
          </h1>
          <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Silently dropped from the 2025 inventory
          </p>

          <div className="mt-10 max-w-prose space-y-5 text-[1.05rem] leading-[1.6] text-foreground/85">
            <p>
              <span className="float-left mr-2 font-display italic text-[3.6rem] leading-[0.82] text-foreground">
                O
              </span>
              MB Memorandum M-25-21 sets a deliberately conservative rule for
              keeping the federal AI use case inventory honest: if a use case
              an agency reported last year is no longer in use, it should
              appear once more in the new filing, marked{" "}
              <span className="italic">d) Retired</span>. The point isn&apos;t
              paperwork. It&apos;s so that, reading the inventory across years,
              the public can see what was tried and stopped — not just what is
              currently running.
            </p>
            <p>
              The 2024 → 2025 cycle did not work that way. Of{" "}
              <span className="font-medium text-foreground">
                {formatNumber(summary.total)}
              </span>{" "}
              use cases present in the 2024 inventory and absent from 2025,
              only{" "}
              <span className="font-medium text-foreground">
                {formatNumber(summary.alreadyRetired)}
              </span>{" "}
              had already been filed as Retired the prior year — the carry-
              forward window had legitimately closed. The other{" "}
              <span className="font-medium text-[var(--stamp)]">
                {formatNumber(summary.activeDropped)}
              </span>{" "}
              were active — Deployed, Pilot, or Pre-deployment — and then
              simply weren&apos;t there. About a sixth of those (
              {formatNumber(summary.usaidActiveDropped)}) belonged to USAID,
              which was dismantled in 2025 and filed nothing. The remaining{" "}
              <span className="font-medium text-[var(--stamp)]">
                {formatNumber(summary.nonUsaidActiveDropped)}
              </span>{" "}
              were dropped by agencies that <em className="italic">did</em>{" "}
              file in 2025 — a quieter but more pointed gap.
            </p>
            <p>
              This page is a ledger of that gap: the headline numbers, the
              stages those use cases were in when they disappeared, the
              agencies they belong to, and a small set of concrete examples
              drawn directly from the 2024 filings.
            </p>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------ */}
      {/* § I — THE BREAKDOWN                                           */}
      {/* ------------------------------------------------------------ */}
      <Section
        number="I"
        title="The breakdown"
        source="derived"
        lede="From the entire 2024 → 2025 retired population down to the compliance gap, in four steps."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <InsightCard
            kicker="A · Population"
            value={formatNumber(summary.total)}
            accent="ink"
            headline={
              <>Use cases present in 2024 and absent from 2025.</>
            }
            subtext={
              <>
                The full <code>retired_2024</code> lineage population — IFP&apos;s
                deterministic-name + LLM-adjudicated link between the two
                cycles. The four cards below decompose it.
              </>
            }
          />
          <InsightCard
            kicker="B · Aged-off legitimately"
            value={formatNumber(summary.alreadyRetired)}
            accent="verified"
            headline={
              <>Already filed as Retired in 2024.</>
            }
            subtext={
              <>
                The M-25-21 carry-forward window had already happened: the
                agency marked these Retired last year and the prior-year row
                was the final trace by design.
              </>
            }
          />
          <InsightCard
            kicker="C · Active in 2024"
            value={`~${formatNumber(headlineActive)}`}
            accent="stamp"
            headline={
              <>
                Active in 2024 and absent from 2025 with no Retired marker.
              </>
            }
            subtext={
              <>
                In Deployed, Pilot, or Pre-deployment status when last filed —
                and then gone. {formatNumber(summary.usaidActiveDropped)} of
                these belong to dissolved USAID, a different category.
              </>
            }
          />
          <InsightCard
            kicker="D · The compliance gap"
            value={`~${formatNumber(headlineDrop)}`}
            accent="stamp"
            headline={
              <>
                Active 2024 use cases dropped by agencies that{" "}
                <em className="italic">did</em> file in 2025.
              </>
            }
            subtext={
              <>
                The non-USAID subset of (C). Each one is an agency that filed
                a 2025 inventory and left out something it had previously
                reported as live — without the Retired marker M-25-21 would
                expect to see once more.
              </>
            }
          />
        </div>
        <SourceLegend />
      </Section>

      {/* ------------------------------------------------------------ */}
      {/* § II — BY 2024 STAGE                                          */}
      {/* ------------------------------------------------------------ */}
      <Section
        number="II"
        title="By 2024 stage"
        source="omb-derived"
        lede="A dropped use case is a stronger finding when it was already in production. Here is the stage mix at the time it was last filed."
      >
        <p className="max-w-prose text-[0.95rem] leading-[1.6] text-foreground/85">
          The ~{formatNumber(headlineDrop)} non-USAID silently-dropped use
          cases, bucketed by the deployment stage their agency reported in
          2024. <em className="italic">Deployed</em> rows are the most
          striking — these were systems the agency itself described as
          operational and benefit-producing.{" "}
          <em className="italic">Pilot</em> here covers the OMB 2024
          &quot;Implementation and Assessment&quot; bucket;{" "}
          <em className="italic">Pre-deployment</em> rolls up Acquisition,
          Planned, Initiated, and Ideation.
        </p>

        <Figure
          className="mt-8"
          eyebrow="Fig. 1 · Silently-dropped by 2024 stage"
          caption={
            <>
              Non-USAID only. Bars are proportional to the largest bucket;
              percentages are share of the {formatNumber(stageTotal)} non-
              USAID silently-dropped rows. 2024 stage values mapped via
              IFP&apos;s 2024 stage recode (the original OMB labels are
              shown in §V).
            </>
          }
        >
          <div className="space-y-5">
            {byStage.map((b) => {
              const pct =
                stageTotal > 0
                  ? Math.round((b.count / stageTotal) * 100)
                  : 0;
              return (
                <div key={b.bucket}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="font-display text-[1.1rem] italic leading-tight text-foreground">
                      {STAGE_LABEL[b.bucket]}
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                      <span className="text-[var(--stamp)] font-semibold">
                        {formatNumber(b.count)}
                      </span>
                      {" · "}
                      {pct}%
                    </span>
                  </div>
                  <StageBar value={b.count} max={maxStageCount} />
                </div>
              );
            })}
          </div>
        </Figure>
      </Section>

      {/* ------------------------------------------------------------ */}
      {/* § IIa — LIVE GENERATIVE AI THAT VANISHED                      */}
      {/* ------------------------------------------------------------ */}
      <div id="live-genai" className="scroll-mt-24" />
      <Section
        number="IIa"
        title="Live generative AI that vanished"
        source="derived"
        lede="The sharpest subset: use cases IFP tagged as generative AI that were in production or implementation in 2024 — and then simply weren't in the 2025 filing."
      >
        <p className="max-w-prose text-[0.95rem] leading-[1.6] text-foreground/85">
          Of the silently-dropped population,{" "}
          <span className="font-medium text-[var(--stamp)]">
            {formatNumber(liveGenAiDistinct)}
          </span>{" "}
          distinct <em className="italic">live generative-AI capabilities</em>{" "}
          — IFP tagged them as GenAI from their 2024 narrative, and their
          reported 2024 stage was production or implementation, not planning or
          research. These are not abandoned experiments; they are the working
          chatbots, assistants, and document tools an agency described as
          operational one year and omitted the next, with no Retired marker.
        </p>
        {liveGenAiFilings > liveGenAiDistinct && liveGenAiLargestCluster ? (
          <p className="mt-3 max-w-prose text-[0.85rem] leading-[1.55] text-muted-foreground">
            That is {formatNumber(liveGenAiDistinct)} distinct capabilities
            across {formatNumber(liveGenAiFilings)} individual filings: a few
            agencies filed many task-level entries under one repeated name. The{" "}
            {liveGenAiLargestCluster.agency_name ??
              liveGenAiLargestCluster.agency_abbreviation}{" "}
            alone filed{" "}
            <span className="font-medium text-foreground">
              {formatNumber(liveGenAiLargestCluster.count)}
            </span>{" "}
            of them under a single label,{" "}
            <em className="italic">
              &ldquo;{liveGenAiLargestCluster.use_case_name}&rdquo;
            </em>
            {liveGenAiLargestCluster.bureaus.length > 1
              ? ` — one per bureau, across ${formatNumber(
                  liveGenAiLargestCluster.bureaus.length,
                )} offices`
              : ""}
            . The table collapses each repeated name into one row with a filing
            count, so distinct systems aren&apos;t drowned out.
          </p>
        ) : null}

        {liveGenAiGroups.length > 0 ? (
          <Figure
            className="mt-8"
            eyebrow="Fig. 1a · Dropped live GenAI use cases"
            caption={
              <>
                Non-USAID only. Each row was IFP-tagged{" "}
                <code>is_generative_ai = 1</code> in{" "}
                <code>use_case_tags_2024_canonical</code> and filed in a live
                2024 deployment stage. One row per named capability; a{" "}
                <span className="text-[var(--stamp)]">×N</span> badge marks
                names an agency filed more than once (one per bureau or task).
                Tool and sophistication come from the same IFP tag.
              </>
            }
          >
            <SilentlyDroppedLiveGenAiTable groups={liveGenAiGroups} />
          </Figure>
        ) : null}
      </Section>

      {/* ------------------------------------------------------------ */}
      {/* § III — BY AGENCY                                             */}
      {/* ------------------------------------------------------------ */}
      <Section
        number="III"
        title="By agency"
        source="omb-derived"
        lede="Which agencies dropped how many — sorted by absolute count, with USAID called out separately."
      >
        <p className="max-w-prose text-[0.95rem] leading-[1.6] text-foreground/85">
          One row per agency with at least one silently-dropped 2024 use case.
          <em className="italic"> Filed 2024</em> is the agency&apos;s full
          prior-year inventory size; <em className="italic">% of 2024</em> is
          the share that vanished. The percentage matters as much as the raw
          count — an agency that dropped half of its 2024 filings is making a
          different statement than one that dropped a handful from a large
          inventory.
        </p>

        {usaidRow ? (
          <div className="mt-8 border border-dashed border-[var(--stamp)] bg-[var(--stamp)]/[0.04] px-4 py-3">
            <Eyebrow color="stamp">
              Out of band · agency dissolution
            </Eyebrow>
            <p className="mt-1.5 text-[0.92rem] leading-[1.55] text-foreground/85">
              <span className="font-display italic text-[1.1rem] text-foreground">
                USAID
              </span>{" "}
              filed{" "}
              <span className="font-mono tabular-nums">
                {formatNumber(usaidRow.filed_2024)}
              </span>{" "}
              use cases in 2024 and was dismantled in early 2025, filing
              nothing.{" "}
              <span className="font-mono tabular-nums text-[var(--stamp)]">
                {formatNumber(usaidRow.dropped)}
              </span>{" "}
              of those were active when last filed. The row appears in the
              ledger below tagged <em className="italic">dissolved</em> so
              its individual use cases stay browsable, but read it as
              agency-wide structural disappearance rather than a per-use-case
              compliance gap.
            </p>
          </div>
        ) : null}

        <div className="mt-8">
          <Eyebrow color="stamp">Fig. 2 · Agency ledger</Eyebrow>
          <p className="mb-4 mt-1.5 max-w-prose text-xs text-muted-foreground">
            Sortable. Click a row to expand and inspect that agency&apos;s
            silently-dropped use cases inline; click the agency name itself
            to open the agency detail page. Rows with blank{" "}
            <em>Filed 2024</em> are agencies whose 2024 records joined via
            abbreviation mapping but whose source files used a legacy agency
            code we don&apos;t map back; see §VI.
          </p>
          <SilentlyDroppedAgencyTable rows={otherAgencyRows} />
        </div>
      </Section>

      {/* ------------------------------------------------------------ */}
      {/* § IV — EXAMPLES                                               */}
      {/* ------------------------------------------------------------ */}
      <Section
        number="IV"
        title="Examples"
        source="omb-derived"
        lede="Six dropped use cases, chosen for variety and pulled directly from the 2024 filings."
      >
        <p className="max-w-prose text-[0.95rem] leading-[1.6] text-foreground/85">
          Curation criteria: non-USAID, substantive narrative (not a
          one-line stub), and a preference for Deployed and Pilot stages over
          Pre-deployment. Round-robin across agencies so no single department
          dominates the set. The italicized paragraphs that follow each entry
          are IFP&apos;s framing; everything before them is the agency&apos;s
          own 2024 text, lightly trimmed.
        </p>

        <ol className="mt-10 space-y-12 border-t-2 border-foreground pt-8">
          {examples.map((ex, i) => {
            const key = `${ex.agency_abbreviation}::${ex.use_case_name ?? ""}`;
            const note = EXAMPLE_NOTES[key];
            return (
              <li
                key={key}
                className="grid grid-cols-1 gap-x-6 gap-y-2 border-b border-dotted border-border pb-12 md:grid-cols-[3rem_1fr]"
              >
                <div className="font-mono text-[2rem] italic leading-none tabular-nums text-[var(--stamp)]">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div>
                  <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    <span className="text-[var(--stamp)]">
                      {ex.agency_abbreviation}
                    </span>
                    <span aria-hidden>·</span>
                    <span>{ex.agency_name}</span>
                    <span aria-hidden>·</span>
                    <span>2024 stage · {ex.dev_stage ?? "—"}</span>
                  </div>

                  <h3 className="font-display text-[1.45rem] italic leading-tight text-foreground">
                    {ex.use_case_name ?? "Untitled"}
                  </h3>

                  {ex.purpose_benefits ? (
                    <p className="mt-3 max-w-prose text-[0.94rem] leading-[1.65] text-foreground/85">
                      {paragraph(ex.purpose_benefits)}
                    </p>
                  ) : null}

                  {ex.outputs ? (
                    <p className="mt-2 max-w-prose text-[0.9rem] leading-[1.6] text-foreground/75">
                      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                        Outputs ·
                      </span>{" "}
                      {paragraph(ex.outputs)}
                    </p>
                  ) : null}

                  {note ? (
                    <p className="mt-4 max-w-prose border-l-2 border-[var(--stamp)] pl-3 text-[0.92rem] italic leading-[1.6] text-foreground/85">
                      {note}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </Section>

      {/* ------------------------------------------------------------ */}
      {/* § V — FULL LIST                                               */}
      {/* ------------------------------------------------------------ */}
      <Section
        number="V"
        title="Full list"
        source="omb-derived"
        lede="The audit trail. Every non-USAID silently-dropped use case, searchable and sortable."
      >
        <p className="max-w-prose text-[0.95rem] leading-[1.6] text-foreground/85">
          All {formatNumber(allRows.length)} use cases that meet the
          definition: present in the 2024 inventory, absent from 2025, in a
          non-Retired 2024 stage, and not attributable to dissolved USAID.
          The narrative excerpt is the agency&apos;s own 2024 purpose-and-
          benefits text, trimmed. Sortable by any header; the filter box
          searches agency, name, stage, and narrative text.
        </p>

        <div className="mt-8">
          <SilentlyDroppedFullList rows={allRows} />
        </div>
      </Section>

      {/* ------------------------------------------------------------ */}
      {/* § VI — CAVEATS                                                */}
      {/* ------------------------------------------------------------ */}
      <Section
        number="VI"
        title="Caveats"
        source="mixed"
        lede="Reasons the count could be high or low — and a framing the caveats don't undo."
      >
        <ol className="space-y-6 border-t-2 border-foreground pt-6">
          {[
            {
              title: "The matcher can miss real continuations",
              body: (
                <>
                  Every silently-dropped row depends on IFP&apos;s 2024 → 2025
                  matcher concluding the 2024 use case has no 2025
                  counterpart. The matcher combines exact-name, normalized-
                  name, and LLM-adjudicated fuzzy matching; the project&apos;s
                  QA round measured a residual miss rate in the 0–2.5% range
                  after the most recent fixes. That&apos;s small but nonzero,
                  and would shrink (not grow) the count below.
                </>
              ),
            },
            {
              title: "Splits and merges aren't always detected",
              body: (
                <>
                  An agency could reasonably fold a 2024 use case into a
                  broader 2025 row without renaming it (a{" "}
                  <em>split</em> or <em>merge</em>). The lineage layer flags
                  some of these explicitly, but the same name-similarity
                  heuristics that miss continuations can miss these too. A
                  conservative reader should discount the headline by some
                  unknown fraction on this account.
                </>
              ),
            },
            {
              title: "M-25-21's Retired guidance is a should, not a must",
              body: (
                <>
                  The OMB language asks agencies to file a discontinued use
                  case one more time as Retired. It is normative guidance,
                  not a statutory mandate; an agency that drops a use case
                  silently is failing the spirit of the rule rather than
                  breaking a statute. This page&apos;s framing is that{" "}
                  <em>
                    the inventory is less complete than the carry-forward
                    rule implies
                  </em>{" "}
                  — not that agencies are out of compliance with the law.
                </>
              ),
            },
            {
              title: "Some agencies' 2024 abbreviations don't map cleanly",
              body: (
                <>
                  A few agencies used legacy codes in their 2024 filings
                  (TREAS for Treasury is the clearest case). The agency
                  ledger in §III joins on the lineage row&apos;s normalized
                  abbreviation; when the 2024 source file used a different
                  code, the <em>Filed 2024</em> column shows blank rather
                  than the true filed count. The dropped counts are still
                  correct.
                </>
              ),
            },
            {
              title:
                "Even with conservative discounts, the gap is in the hundreds",
              body: (
                <>
                  Take the headline ~
                  {formatNumber(headlineDrop)} and apply each caveat at the
                  high end: 2.5% off for matcher miss, another 10% off for
                  undetected splits and merges, and you still land in the
                  high-300s of active 2024 use cases that left no Retired
                  trace in the 2025 filings of agencies that filed. The
                  finding survives the caveats.
                </>
              ),
            },
          ].map((c, i) => (
            <li
              key={c.title}
              className="grid grid-cols-1 gap-x-6 gap-y-2 border-b border-dotted border-border pb-6 md:grid-cols-[3rem_1fr]"
            >
              <div className="font-mono text-[2rem] italic leading-none tabular-nums text-[var(--stamp)]">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div>
                <h3 className="font-display text-[1.25rem] italic leading-tight text-foreground">
                  {c.title}
                </h3>
                <p className="mt-1.5 max-w-prose text-[0.92rem] leading-[1.6] text-foreground/80">
                  {c.body}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-8 max-w-prose font-mono text-[11px] leading-relaxed text-muted-foreground">
          Headline counts pulled live from{" "}
          <code className="bg-muted px-1 py-0.5 text-foreground">
            use_case_year_links
          </code>{" "}
          joined to{" "}
          <code className="bg-muted px-1 py-0.5 text-foreground">
            use_cases_2024
          </code>
          ; queries in{" "}
          <code className="bg-muted px-1 py-0.5 text-foreground">
            @/lib/db/year-comparison
          </code>
          .{" "}
          <Link
            href="/compare-years"
            className="underline decoration-dotted underline-offset-2 hover:text-[var(--stamp)]"
          >
            Back to the 2024 ↔ 2025 overview →
          </Link>
        </p>
      </Section>

      {/* ------------------------------------------------------------ */}
      {/* Colophon                                                      */}
      {/* ------------------------------------------------------------ */}
      <footer className="mt-24 grid grid-cols-12 gap-x-6 border-t-2 border-foreground pt-6">
        <div className="col-span-12 md:col-span-3">
          <div className="eyebrow !text-[var(--stamp)]">Colophon</div>
        </div>
        <p className="col-span-12 font-mono text-[11px] uppercase tracking-[0.1em] leading-relaxed text-muted-foreground md:col-span-9">
          Headline counts {" · "}
          <code className="bg-muted px-1 py-0.5 text-foreground">
            getSilentlyDroppedSummary
          </code>{" "}
          ·{" "}
          stage breakdown{" "}
          <code className="bg-muted px-1 py-0.5 text-foreground">
            getSilentlyDroppedByStage
          </code>{" "}
          · agency ledger{" "}
          <code className="bg-muted px-1 py-0.5 text-foreground">
            getSilentlyDroppedByAgency
          </code>{" "}
          · full list{" "}
          <code className="bg-muted px-1 py-0.5 text-foreground">
            getSilentlyDroppedRows
          </code>
          .{" "}
          Numbers are computed at request time and will drift slightly with
          re-runs of the lineage pass.
        </p>
      </footer>
    </div>
  );
}
