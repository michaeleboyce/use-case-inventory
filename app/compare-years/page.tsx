import Link from "next/link";
import { formatNumber, formatYoY } from "@/lib/formatting";
import { InsightCard } from "@/components/insight-card";
import { Section, Figure, SourceLegend, Eyebrow } from "@/components/editorial";
import { YearComparisonChart } from "@/components/charts/year-comparison-chart";
import { LineageBreakdownChart } from "@/components/charts/lineage-breakdown-chart";
import { buildCompareYearsViewModel } from "./_view-model";
import { PerAgencyTable } from "./_sections/per-agency-table";
import { GenAiByAgencyTable } from "./_sections/genai-by-agency-table";

export const metadata = {
  title: "2024 ↔ 2025 · Federal AI Use Case Inventory",
  description:
    "An IFP lineage analysis across two consecutive OMB federal AI use case inventories — aggregate year-over-year growth, use-case-level lineage, and the honest caveats that make a clean comparison hard.",
};

/** Lineage status display labels (mirrors the chart legend). */
const LINEAGE_LABELS: Record<string, string> = {
  continued: "Continued",
  renamed: "Renamed",
  split: "Split",
  retired_2024: "Retired",
  new_2025: "New in 2025",
};

export default async function CompareYearsPage() {
  const vm = await buildCompareYearsViewModel();
  const {
    total,
    stageRows,
    agencyRows,
    lineage,
    lineageTotal,
    perAgency,
    retired,
    tags2024,
    genaiByAgency,
    silentlyDroppedGenAiCount,
    silentlyDroppedGenAiDistinct,
  } = vm;

  const genai2025Total = genaiByAgency.reduce((a, r) => a + r.genai_2025, 0);
  const genaiDelta = genai2025Total - tags2024.genai;

  // Per-agency chart rows from the aggregate `year_comparison` rollup.
  const chartRows = agencyRows
    .filter((r) => r.bucket)
    .map((r) => ({
      abbreviation: r.bucket as string,
      name:
        perAgency.find((p) => p.abbreviation === r.bucket)?.name ??
        (r.bucket as string),
      count_2024: r.count_2024,
      count_2025: r.count_2025,
    }));

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-14 md:px-8 md:py-20">
      {/* ------------------------------------------------------------ */}
      {/* HERO                                                          */}
      {/* ------------------------------------------------------------ */}
      <header className="ink-in grid grid-cols-12 gap-x-6 border-b border-border pb-12 md:pb-16">
        <aside className="col-span-12 mb-8 md:col-span-3 md:mb-0">
          <div className="sticky top-32 space-y-4">
            <div>
              <div className="eyebrow mb-1.5 !text-[var(--stamp)]">
                § Cycle Comparison
              </div>
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Two-Cycle Analysis
              </div>
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                2024 → 2025 · M-25-21
              </div>
            </div>

            <div className="hidden space-y-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground md:block">
              <div className="border-t border-border pt-3">
                <div className="mb-0.5 text-[9px] text-muted-foreground/70">
                  Corpus
                </div>
                <div className="text-foreground">
                  {formatNumber(total.count_2024)} → {formatNumber(total.count_2025)} uc
                </div>
              </div>
              <div>
                <div className="mb-0.5 text-[9px] text-muted-foreground/70">
                  Lineage links
                </div>
                <div className="text-foreground">
                  {formatNumber(lineageTotal)} adjudicated
                </div>
              </div>
            </div>
          </div>
        </aside>

        <div className="col-span-12 md:col-span-9">
          <h1 className="font-display text-[clamp(2.6rem,6.5vw,5.4rem)] leading-[0.95] tracking-[-0.03em] text-foreground">
            <em className="inline font-normal italic">2024</em>{" "}
            <span className="text-muted-foreground">↔</span>{" "}
            <em className="inline font-normal italic">2025</em>
            <br />
            two inventories,
            <br />
            <span className="relative inline-block">
              <span
                aria-hidden
                className="absolute inset-x-[-0.08em] bottom-[0.16em] h-[0.38em] bg-[var(--highlight)]/90"
              />
              <span className="relative">one lineage.</span>
            </span>
          </h1>

          <p className="mt-10 max-w-prose text-[1.05rem] leading-[1.55] text-foreground/85">
            <span className="float-left mr-2 font-display italic text-[3.6rem] leading-[0.82] text-foreground">
              T
            </span>
            <span>wo consecutive OMB</span> federal AI use case inventories,
            placed side by side. The headline is real growth —{" "}
            <span className="font-medium text-foreground">
              {formatNumber(total.count_2024)}
            </span>{" "}
            individual use cases in 2024 rose to{" "}
            <span className="font-medium text-foreground">
              {formatNumber(total.count_2025)}
            </span>{" "}
            in 2025. But a like-for-like comparison is harder than the totals
            suggest. This is an{" "}
            <em className="italic">IFP lineage analysis</em>: we matched and
            adjudicated every use case across the two cycles, and one finding
            stands out —{" "}
            <span className="font-medium text-[var(--stamp)]">
              roughly {formatNumber(roundTo(retired.active, 10))} use cases that
              were active in 2024 simply vanished
            </span>{" "}
            from the 2025 filing rather than being marked Retired.
          </p>
        </div>
      </header>

      {/* ------------------------------------------------------------ */}
      {/* § I — GROWTH AT A GLANCE                                       */}
      {/* ------------------------------------------------------------ */}
      <Section
        number="I"
        title="Growth at a glance"
        source="omb-derived"
        lede="The two headline counts, the net change, and the caveat that belongs right next to them."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <InsightCard
            kicker="A · 2024 cycle"
            value={formatNumber(total.count_2024)}
            accent="ink"
            headline={<>Individual use cases in the 2024 inventory.</>}
            subtext="The prior-cycle baseline, across 41 reporting agencies."
          />
          <InsightCard
            kicker="B · 2025 cycle"
            value={formatNumber(total.count_2025)}
            accent="ink"
            headline={<>Individual use cases in the 2025 inventory.</>}
            subtext="The current cycle, across 36 reporting agencies — a smaller agency set covering more use cases."
          />
          <InsightCard
            kicker="C · Net change"
            value={formatYoY(total.pct_change)}
            accent="verified"
            headline={
              <>
                Net growth in reported use cases, 2024 → 2025 (
                {total.delta > 0 ? "+" : ""}
                {formatNumber(total.delta)}).
              </>
            }
            subtext="Genuine expansion — but see §V: the 2025 cycle also moved COTS products into a separate appendix, so this is not strictly apples-to-apples."
          />
          <InsightCard
            kicker="D · The drop"
            value={`~${formatNumber(roundTo(retired.active, 10))}`}
            accent="stamp"
            href="/compare-years/silently-dropped"
            headline={
              <>
                Use cases that were{" "}
                <span className="italic">active</span> in 2024 but absent from
                the 2025 inventory.
              </>
            }
            subtext={`Of ${formatNumber(retired.total)} use cases present only in 2024, ${formatNumber(retired.alreadyRetired)} had already been filed as Retired. The other ${formatNumber(retired.active)} were in Pre-deployment, Pilot, or Deployed status — and were dropped, not retired. An agency-compliance gap, not a data artifact. Open the deep dive →`}
          />
        </div>
        <SourceLegend />
      </Section>

      {/* ------------------------------------------------------------ */}
      {/* § II — USE-CASE LINEAGE                                       */}
      {/* ------------------------------------------------------------ */}
      <Section
        number="II"
        title="Use-case lineage"
        source="derived"
        lede="Not just aggregate counts — every use case traced from one cycle to the next."
      >
        <p className="max-w-prose text-[0.95rem] leading-[1.6] text-foreground/85">
          Aggregate totals can hide churn: an agency can post the same count two
          years running while replacing half its inventory. To see the real
          picture, IFP linked the two cycles{" "}
          <em className="italic">at the use-case level</em> —{" "}
          {formatNumber(lineageTotal)} links built by deterministic name
          matching, with the ambiguous pairs adjudicated by an LLM review pass
          (renamed vs. genuinely new, one use case split into several, and so
          on). Each use case lands in exactly one of five lineage statuses.
        </p>

        <Figure
          className="mt-10"
          eyebrow="Fig. 1 · Lineage breakdown"
          caption={
            <>
              All {formatNumber(lineageTotal)} cross-cycle links, by status.
              &quot;Continued&quot; and &quot;Renamed&quot; are the same use
              case in both years; &quot;Retired&quot; appears only in 2024;
              &quot;New&quot; appears only in 2025. Status assigned by IFP
              deterministic match + LLM adjudication.
            </>
          }
        >
          <LineageBreakdownChart counts={lineage} />
        </Figure>

        <div className="mt-10 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {(
            [
              ["continued", "verified"],
              ["renamed", "ink"],
              ["split", "ink"],
              ["retired_2024", "stamp"],
              ["new_2025", "ink"],
            ] as const
          ).map(([key, accent]) => (
            <div
              key={key}
              className="flex flex-col gap-1 border-t-2 border-foreground pt-2"
            >
              <div className="eyebrow truncate">{LINEAGE_LABELS[key]}</div>
              <div
                className={`font-display text-[2.2rem] italic leading-[0.95] tracking-[-0.02em] tabular-nums ${
                  accent === "verified"
                    ? "text-[var(--verified)]"
                    : accent === "stamp"
                      ? "text-[var(--stamp)]"
                      : "text-foreground"
                }`}
              >
                {formatNumber(lineage[key])}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                {lineageTotal > 0
                  ? Math.round((lineage[key] / lineageTotal) * 100)
                  : 0}
                % of links
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ------------------------------------------------------------ */}
      {/* § IIa — GENERATIVE AI, YEAR OVER YEAR                         */}
      {/* ------------------------------------------------------------ */}
      <Section
        number="IIa"
        title="Generative AI, year over year"
        source="derived"
        lede="The one AI-type comparison that 2024 and 2025 now share — because IFP re-tagged both cycles with the same definition."
      >
        <p className="max-w-prose text-[0.95rem] leading-[1.6] text-foreground/85">
          The OMB inventory&apos;s AI-type field is not comparable across cycles
          (see §V). But IFP independently tagged generative AI from the narrative
          columns in <em className="italic">both</em> years using one definition,
          so this slice <em className="italic">is</em> like-for-like.{" "}
          <span className="font-medium text-foreground">
            {formatNumber(tags2024.genai)}
          </span>{" "}
          IFP-tagged GenAI use cases in 2024 rose to{" "}
          <span className="font-medium text-foreground">
            {formatNumber(genai2025Total)}
          </span>{" "}
          in 2025 —{" "}
          <span className="font-medium text-[var(--verified)]">
            {genaiDelta > 0 ? "+" : ""}
            {formatNumber(genaiDelta)}
          </span>{" "}
          net.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <InsightCard
            kicker="2024 · IFP-tagged"
            value={formatNumber(tags2024.genai)}
            accent="ink"
            headline={<>Generative-AI use cases in the 2024 inventory.</>}
            subtext={`Of ${formatNumber(tags2024.total)} use cases IFP tagged in the prior cycle.`}
          />
          <InsightCard
            kicker="2025 · IFP-tagged"
            value={formatNumber(genai2025Total)}
            accent="ink"
            headline={<>Generative-AI use cases in the 2025 inventory.</>}
            subtext="Same is_generative_ai tag, applied to the current cycle."
          />
          <InsightCard
            kicker="Net change"
            value={`${genaiDelta > 0 ? "+" : ""}${formatNumber(genaiDelta)}`}
            accent="verified"
            headline={<>Growth in IFP-tagged GenAI, 2024 → 2025.</>}
            subtext="A like-for-like comparison — both years tagged by the same IFP narrative definition."
          />
        </div>

        <div className="mt-12">
          <Eyebrow color="stamp">Fig. 1a · Per-agency GenAI ledger</Eyebrow>
          <p className="mt-2 mb-4 max-w-prose text-xs text-muted-foreground">
            Sortable. IFP-tagged generative-AI use-case counts per agency in each
            cycle, and the net change. Both columns use the{" "}
            <code>is_generative_ai</code> tag (2024 from{" "}
            <code>use_case_tags_2024_canonical</code>, 2025 from{" "}
            <code>use_case_tags</code>). Click a row for the agency detail page.
          </p>
          <GenAiByAgencyTable rows={genaiByAgency} />
        </div>

        {silentlyDroppedGenAiDistinct > 0 ? (
          <div className="mt-10 border-l-4 border-[var(--stamp)] bg-stone-50 px-5 py-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              The sharp edge
            </p>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-foreground">
              <span className="font-semibold text-[var(--stamp)]">
                {formatNumber(silentlyDroppedGenAiDistinct)}
              </span>{" "}
              distinct{" "}
              <em className="italic">live generative-AI capabilities</em> — in
              production or implementation in 2024, IFP-tagged as GenAI, and gone
              from the 2025 inventory without being filed as Retired
              {silentlyDroppedGenAiCount > silentlyDroppedGenAiDistinct
                ? ` (${formatNumber(silentlyDroppedGenAiCount)} filings in all)`
                : ""}
              .{" "}
              <Link
                href="/compare-years/silently-dropped#live-genai"
                className="underline decoration-dotted underline-offset-2 hover:text-[var(--stamp)]"
              >
                See the roster →
              </Link>
            </p>
          </div>
        ) : null}
      </Section>

      {/* ------------------------------------------------------------ */}
      {/* § III — BY AGENCY                                             */}
      {/* ------------------------------------------------------------ */}
      <Section
        number="III"
        title="By agency"
        source="omb-derived"
        lede="Where the growth concentrated — and where inventories shrank or fully turned over."
      >
        <Figure
          eyebrow="Fig. 2 · Per-agency volume, 2024 vs 2025"
          caption={
            <>
              Reported use cases per agency in each cycle (grey = 2024,
              vermilion = 2025). Toggle Top / Bottom / All; agencies are
              ordered by 2025 volume. Source:{" "}
              <code>year_comparison</code> (dimension = agency).
            </>
          }
        >
          <YearComparisonChart data={chartRows} />
        </Figure>

        <div className="mt-12">
          <Eyebrow color="stamp">Fig. 2a · Agency ledger</Eyebrow>
          <p className="mt-2 mb-4 max-w-prose text-xs text-muted-foreground">
            Sortable. Aggregate 2024 / 2025 counts and net change come from the
            OMB-derived rollup; the Continued / Renamed / Retired / New columns
            are the IFP lineage split. Click a row for the agency detail page.
          </p>
          <PerAgencyTable rows={perAgency} />
        </div>
      </Section>

      {/* ------------------------------------------------------------ */}
      {/* § IV — STAGE MIX                                              */}
      {/* ------------------------------------------------------------ */}
      <Section
        number="IV"
        title="Stage mix"
        source="omb-derived"
        lede="How the deployment-stage distribution shifted — read with care, the taxonomies changed."
      >
        <Figure
          eyebrow="Fig. 3 · Deployment stage, 2024 → 2025"
          caption={
            <>
              <span className="text-[var(--stamp)]">Lossy comparison.</span>{" "}
              The 2024 and 2025 inventories use different deployment-stage
              taxonomies; these buckets are an IFP recode onto a common scale,
              and a use case can land in a different bucket purely because of
              the recode. Read the direction of travel, not the exact deltas.
            </>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse">
              <thead>
                <tr className="border-b-2 border-foreground">
                  <th className="px-3 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    Stage
                  </th>
                  <th className="px-3 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    2024
                  </th>
                  <th className="px-3 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    2025
                  </th>
                  <th className="px-3 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    Δ
                  </th>
                  <th className="px-3 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    % chg
                  </th>
                </tr>
              </thead>
              <tbody>
                {stageRows.map((row) => (
                  <tr
                    key={row.bucket ?? "unknown"}
                    className="border-b border-border"
                  >
                    <td className="px-3 py-3 font-display text-[1.05rem] italic text-foreground">
                      {humanizeStage(row.bucket)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-[12px] tabular-nums text-muted-foreground">
                      {formatNumber(row.count_2024)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-[13px] font-semibold tabular-nums text-foreground">
                      {formatNumber(row.count_2025)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span
                        className={`font-mono text-[12px] font-semibold tabular-nums ${
                          row.delta > 0
                            ? "text-[var(--verified)]"
                            : row.delta < 0
                              ? "text-[var(--stamp)]"
                              : "text-muted-foreground"
                        }`}
                      >
                        {row.delta > 0 ? "+" : ""}
                        {formatNumber(row.delta)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-[12px] tabular-nums text-muted-foreground">
                      {formatYoY(row.pct_change)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Figure>
      </Section>

      {/* ------------------------------------------------------------ */}
      {/* § V — METHODOLOGY & CAVEATS                                   */}
      {/* ------------------------------------------------------------ */}
      <Section
        number="V"
        title="Methodology & caveats"
        source="omb-derived"
        lede="Five reasons a clean year-over-year comparison is harder than the totals make it look."
      >
        <p className="max-w-prose text-[0.95rem] leading-[1.6] text-foreground/85">
          The 2024 and 2025 inventories were filed under evolving OMB guidance.
          Comparing them honestly means naming what changed. The reasoning
          behind each caveat is documented in IFP&apos;s{" "}
          <code className="bg-muted px-1 py-0.5 text-foreground">
            COMPARABILITY-MATRIX.md
          </code>
          ; the five below are the ones that matter for reading this page.
        </p>

        <ol className="mt-8 space-y-6 border-t-2 border-foreground pt-6">
          {CAVEATS.map((c, i) => (
            <li
              key={c.title}
              className="grid grid-cols-1 gap-x-6 gap-y-2 border-b border-dotted border-border pb-6 md:grid-cols-[3rem_1fr]"
            >
              <div className="font-mono text-[2rem] italic leading-none tabular-nums text-[var(--stamp)]">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div>
                <h3 className="font-display text-[1.3rem] italic leading-tight text-foreground">
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
          Aggregate counts (§I, §III, §IV) are computed from OMB-filed
          inventories. The use-case lineage (§II and the lineage columns in
          §III) is an IFP analytical layer — a deterministic name match plus an
          LLM adjudication pass — and should be read as IFP&apos;s best
          reconstruction, not an official OMB crosswalk.{" "}
          <Link
            href="/analytics"
            className="underline decoration-dotted underline-offset-2 hover:text-[var(--stamp)]"
          >
            See the 2025 analytics supplement →
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
          Aggregates from{" "}
          <code className="bg-muted px-1 py-0.5 text-foreground">
            year_comparison
          </code>
          {" · "}
          lineage from{" "}
          <code className="bg-muted px-1 py-0.5 text-foreground">
            use_case_year_links
          </code>
          {" · "}
          queries in{" "}
          <code className="bg-muted px-1 py-0.5 text-foreground">
            @/lib/db/year-comparison
          </code>
          {" · "}
          page at{" "}
          <code className="bg-muted px-1 py-0.5 text-foreground">
            app/compare-years/page.tsx
          </code>
          .
        </p>
      </footer>
    </div>
  );
}

/** Round to the nearest `step` — used to present "~600" rather than a precise
 *  figure for the headline drop number, since the exact count drifts with
 *  re-runs of the lineage adjudication. */
function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}

/** Strip the OMB "a) " / "b) " stage prefixes for display. */
function humanizeStage(bucket: string | null): string {
  if (!bucket) return "Unknown";
  const stripped = bucket.replace(/^[a-z]\)\s*/i, "");
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

const CAVEATS: Array<{ title: string; body: React.ReactNode }> = [
  {
    title: "The counting method changed",
    body: (
      <>
        The 2025 cycle moved commercial off-the-shelf (COTS) products into a
        separate ~900-row consolidated appendix, which 2024 did not have. The
        headline 2024 → 2025 totals on this page count individual use cases
        only and exclude that appendix — so part of the apparent growth is a
        reporting-format change, not new deployment.
      </>
    ),
  },
  {
    title: "The impact taxonomy is not comparable",
    body: (
      <>
        How agencies classified rights-impacting and safety-impacting use cases
        was redefined between cycles. A 2024 &quot;high-impact&quot; flag and a
        2025 one do not mean the same thing, so this page does not attempt an
        impact-level year-over-year comparison.
      </>
    ),
  },
  {
    title: "AI-type is comparable only for generative AI",
    body: (
      <>
        The 2025 inventory introduced an OMB AI-type / technique field
        (generative, predictive, computer vision, and so on) with no 2024
        equivalent, so the <em className="italic">filed</em> AI-type mix cannot
        be trended. The exception is generative AI: IFP re-tagged both cycles
        from their narrative columns using one definition (the{" "}
        <code>is_generative_ai</code> tag), which makes the GenAI count in §IIa a
        genuine year-over-year comparison. The other AI types remain
        single-cycle snapshots.
      </>
    ),
  },
  {
    title: "~600 active use cases were dropped, not retired",
    body: (
      <>
        Of the use cases present only in 2024, roughly 600 were in an active
        deployment stage — Pre-deployment, Pilot, or Deployed — yet they are
        absent from the 2025 inventory and were never filed as{" "}
        <span className="italic">Retired</span>. This is an
        agency-compliance finding: a like-for-like inventory would have either
        carried these forward or marked them retired. It is the single biggest
        reason the raw totals understate churn.
      </>
    ),
  },
  {
    title: "The deployment-stage recode is lossy",
    body: (
      <>
        The 2024 and 2025 stage taxonomies differ. The §IV stage table maps
        both onto a common set of buckets, but a use case can shift buckets
        purely because of that recode rather than any real change in its
        status. Treat the stage deltas as directional.
      </>
    ),
  },
];
