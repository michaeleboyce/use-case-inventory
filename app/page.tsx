/**
 * Home — the guided front door. After the hero and a "how to read this"
 * band, the sections walk the site's seven numbered parts in nav order
 * (§ numerals come from lib/nav.ts, so home and the rail can't drift),
 * closing with a reference footband. Every major sub-area of the site
 * has an entry point on this page.
 */
import Link from "next/link";
import {
  formatDate,
  formatNumber,
  formatWholePercent,
  humanizeCategory,
  numberToWords,
} from "@/lib/formatting";
import { MaturityTierCard } from "@/components/maturity-tier-card";
import { TopProductsChart } from "@/components/charts/top-products-chart";
import { AgencyTypeChart } from "@/components/charts/agency-type-chart";
import { Section, Figure, MonoChip } from "@/components/editorial";
import { ReadinessHeadlineStat } from "@/components/readiness/readiness-headline-stat";
import { buildAgenciesUrl, buildUseCasesUrl } from "@/lib/urls";
import { NAV_SECTIONS } from "@/lib/nav";
import { buildHomeViewModel } from "./_view-model";
import { HomeHero } from "./_sections/home-hero";
import { HomeHowToRead } from "./_sections/home-how-to-read";
import { HomeChangeSection } from "./_sections/home-change-section";
import { HomeFeaturesSection } from "./_sections/home-features-section";
import { HomeFedrampSection } from "./_sections/home-fedramp-section";
import { HomeReferenceFootband } from "./_sections/home-reference-footband";
import { CrossCutCard, GapList, StatGlance } from "./_sections/home-bits";

export default async function HomePage() {
  const {
    stats,
    maturity,
    tiers,
    agencyTypeData,
    recent,
    readinessHeadline,
    agenciesWithAgentic,
    agenciesWithCoding,
    agenciesWithCustom,
    agenciesWithEnterpriseLLM,
    agenticEntries,
    codingEntries,
    distinctProducts,
    genAIEntries,
    missingCoding,
    missingEnterpriseLLM,
    reportingAgencies,
    tags2024,
    topCategories,
    topProductsData,
    productDeployments,
    yoyHeadline,
    fedrampHeadline,
  } = await buildHomeViewModel();

  const agenciesWithDataWord = numberToWords(stats.total_agencies_with_data);
  // § numerals mirror the nav registry exactly — never hard-code them here.
  const kickers = Object.fromEntries(
    NAV_SECTIONS.map((s) => [s.label, s.kicker]),
  );

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-14 md:px-8 md:py-20">
      <HomeHero
        stats={stats}
        distinctProducts={distinctProducts}
        productDeployments={productDeployments}
        codingEntries={codingEntries}
        agenciesWithDataWord={agenciesWithDataWord}
      />

      <HomeHowToRead stats={stats} />

      {/* ------------------------------------------------------------ */}
      {/* § I — AGENCIES                                                */}
      {/* ------------------------------------------------------------ */}
      <Section
        number={kickers.Agencies}
        title="The agencies"
        lede="How the filers sort — a breadth-heuristic ledger, the capability gaps, and the freshest filings."
        source="omb-derived"
      >
        <div className="space-y-12">
          <MaturityTierCard tiers={tiers} />

          <p className="max-w-prose font-display text-[1rem] italic leading-snug text-muted-foreground">
            The ledger above groups agencies by an internal-heuristic maturity
            tier; the readiness index in § {kickers.Readiness} scores them
            against a published rubric — the two deliberately disagree (<Link href="/about#maturity-vs-readiness" className="underline decoration-dotted underline-offset-4 text-foreground hover:text-[var(--stamp)]">why</Link>).{" "}
            <Link
              href="/agencies"
              className="underline decoration-dotted underline-offset-4 text-foreground hover:text-[var(--stamp)]"
            >
              All agencies →
            </Link>{" "}
            <Link
              href="/agencies/compare"
              className="underline decoration-dotted underline-offset-4 text-foreground hover:text-[var(--stamp)]"
            >
              Compare agencies →
            </Link>
          </p>

          <div>
            <div className="mb-3 eyebrow">
              Agency coverage · of {reportingAgencies} reporting
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
              <StatGlance
                label="With enterprise LLM"
                count={agenciesWithEnterpriseLLM}
                pct={formatWholePercent(agenciesWithEnterpriseLLM, reportingAgencies)}
                href={buildAgenciesUrl({ hasEnterpriseLlm: true })}
                accent="stamp"
              />
              <StatGlance
                label="With coding assistants"
                count={agenciesWithCoding}
                pct={formatWholePercent(agenciesWithCoding, reportingAgencies)}
                href={buildAgenciesUrl({ hasCoding: true })}
                accent="verified"
              />
              <StatGlance
                label="With agentic AI"
                count={agenciesWithAgentic}
                pct={formatWholePercent(agenciesWithAgentic, reportingAgencies)}
                href={buildAgenciesUrl({ hasAgentic: true })}
              />
              <StatGlance
                label="With custom AI"
                count={agenciesWithCustom}
                pct={formatWholePercent(agenciesWithCustom, reportingAgencies)}
                href={buildAgenciesUrl({ hasCustom: true })}
              />
            </div>
          </div>

          <div className="grid gap-x-8 gap-y-10 md:grid-cols-2">
            <GapList
              kicker="A"
              title="Agencies without an enterprise LLM"
              note={
                <>
                  <Link
                    href={buildAgenciesUrl({ hasEnterpriseLlm: false })}
                    className="font-medium text-foreground transition-colors hover:text-[var(--stamp)]"
                  >
                    {missingEnterpriseLLM.length} of {maturity.length}
                  </Link>{" "}
                  reporting agencies do not list department- or
                  enterprise-wide access to a general-purpose language model.
                </>
              }
              items={missingEnterpriseLLM}
              tone="stamp"
            />
            <GapList
              kicker="B"
              title="Agencies without coding assistants"
              note={
                <>
                  <Link
                    href={buildAgenciesUrl({ hasCoding: false })}
                    className="font-medium text-foreground transition-colors hover:text-[var(--stamp)]"
                  >
                    {missingCoding.length} of {maturity.length}
                  </Link>{" "}
                  reporting agencies have no recorded deployment of GitHub
                  Copilot, Claude Code, CodeWhisperer, or any coding tool.
                </>
              }
              items={missingCoding}
              tone="ink"
            />
          </div>

          <div>
            <div className="mb-3 eyebrow">Most recent filings</div>
            <ul className="divide-y divide-border border-y-2 border-foreground">
              {recent.map((a, i) => (
                <li
                  key={a.id}
                  className="group grid grid-cols-[2.25rem_3.75rem_1fr_auto] items-baseline gap-x-3 py-3 text-[0.95rem] md:grid-cols-[2.75rem_5rem_1fr_auto] md:gap-x-5"
                >
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <Link
                    href={`/agencies/${a.abbreviation}`}
                    className="font-mono text-sm font-semibold tracking-[0.04em] text-foreground hover:text-[var(--stamp)]"
                  >
                    {a.abbreviation}
                  </Link>
                  <Link
                    href={`/agencies/${a.abbreviation}`}
                    className="truncate font-display text-[1.08rem] italic text-foreground transition-[letter-spacing] group-hover:tracking-[-0.01em]"
                  >
                    {a.name}
                  </Link>
                  <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                    {formatDate(a.last_modified)}
                  </span>
                </li>
              ))}
              {recent.length === 0 ? (
                <li className="py-3 text-sm text-muted-foreground">
                  No modification timestamps recorded.
                </li>
              ) : null}
            </ul>
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------------ */}
      {/* § II — READINESS                                              */}
      {/* ------------------------------------------------------------ */}
      <Section
        number={kickers.Readiness}
        title="Readiness"
        lede="A published rubric for state-capacity readiness, scored against five dimensions."
        source="derived"
      >
        <ReadinessHeadlineStat
          value={Number(readinessHeadline.internal_build_pct.toFixed(1))}
          unit="%"
          label="of federal AI is built in-house — the rest is purchased commercial tooling"
          caption={`Computed across all reported use cases · ${readinessHeadline.total_agencies_scored} agencies scored against the v1.1 capacity-first rubric`}
          variant="big"
          href="/readiness/methodology#internal-build"
        />
        <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          <Link href="/readiness" className="transition-colors hover:text-[var(--stamp)]">
            → The league table
          </Link>
          <Link href="/readiness/access" className="transition-colors hover:text-[var(--stamp)]">
            → AI Access &amp; Scale
          </Link>
          <Link href="/readiness/methodology" className="transition-colors hover:text-[var(--stamp)]">
            → Methodology &amp; rubric
          </Link>
        </p>
      </Section>

      {/* ------------------------------------------------------------ */}
      {/* § III — USE CASES                                             */}
      {/* ------------------------------------------------------------ */}
      <Section
        number={kickers["Use Cases"]}
        title="The use cases"
        lede={`What ${reportingAgencies} reporting agencies collectively say about their AI — and the cross-cuts to slice it by.`}
        source="mixed"
      >
        <div className="space-y-10">
          <div>
            <div className="mb-3 eyebrow">
              Entry mix · of {formatNumber(stats.total_use_cases)} individually
              filed use cases (consolidated entries are untagged)
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
              <StatGlance
                label="Coding assistants"
                count={stats.total_coding_entries}
                pct={formatWholePercent(stats.total_coding_entries, stats.total_use_cases)}
                href={buildUseCasesUrl({ isCodingTool: true, entryKind: "all" })}
                accent="verified"
              />
              <StatGlance
                label="Generative AI"
                count={genAIEntries}
                pct={formatWholePercent(genAIEntries, stats.total_use_cases)}
                href={buildUseCasesUrl({ isGenAI: true, entryKind: "all" })}
                accent="stamp"
              />
              <StatGlance
                label="Agentic AI"
                count={agenticEntries}
                pct={formatWholePercent(agenticEntries, stats.total_use_cases)}
                href={buildUseCasesUrl({
                  aiSophistications: ["agentic"],
                  entryKind: "all",
                })}
              />
              <StatGlance
                label="High-impact"
                count={stats.total_high_impact_entries}
                pct={formatWholePercent(stats.total_high_impact_entries, stats.total_use_cases)}
                href={buildUseCasesUrl({
                  highImpactDesignations: ["high_impact"],
                  entryKind: "all",
                })}
              />
            </div>
            <p className="mt-3 max-w-prose font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/80">
              GenAI counts use the IFP tag; the 2024 comparison and Experience
              pages apply different definitions —{" "}
              <Link
                href="/about"
                className="underline decoration-dotted underline-offset-2 transition-colors hover:text-[var(--stamp)]"
              >
                see methods
              </Link>
              .
            </p>

            {/* 2024 baseline — the prior cycle's IFP-tagged GenAI numbers,
                shown alongside (not replacing) the 2025 entry mix above so the
                year-over-year shift is visible at a glance. */}
            <div className="mt-5 flex flex-wrap items-baseline gap-x-6 gap-y-2 border-t border-dotted border-border pt-4">
              <span className="eyebrow !text-[var(--stamp)]">
                2024 baseline
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                <strong className="font-semibold text-foreground tabular-nums">
                  {formatNumber(tags2024.genai)}
                </strong>{" "}
                GenAI use cases
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                <strong className="font-semibold text-foreground tabular-nums">
                  {formatNumber(tags2024.enterprise_wide)}
                </strong>{" "}
                enterprise-wide
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                of {formatNumber(tags2024.total)} use cases · IFP-tagged
              </span>
              <Link
                href="/compare-years"
                className="ml-auto font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-[var(--stamp)]"
              >
                → 2024 ↔ 2025 comparison
              </Link>
            </div>
          </div>

          <div>
            <div className="mb-3 eyebrow">
              Stage mix · of {formatNumber(stats.total_use_cases)} individual use cases
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
              <StatGlance
                label="Pre-deployment"
                count={stats.stage_bucket_counts.pre_deployment}
                pct={formatWholePercent(stats.stage_bucket_counts.pre_deployment, stats.total_use_cases)}
                href={buildUseCasesUrl({ stageBuckets: ["pre_deployment"] })}
              />
              <StatGlance
                label="Pilot"
                count={stats.stage_bucket_counts.pilot}
                pct={formatWholePercent(stats.stage_bucket_counts.pilot, stats.total_use_cases)}
                href={buildUseCasesUrl({ stageBuckets: ["pilot"] })}
              />
              <StatGlance
                label="Deployed"
                count={stats.stage_bucket_counts.deployed}
                pct={formatWholePercent(stats.stage_bucket_counts.deployed, stats.total_use_cases)}
                href={buildUseCasesUrl({ stageBuckets: ["deployed"] })}
                accent="verified"
              />
              <StatGlance
                label="Retired"
                count={stats.stage_bucket_counts.retired}
                pct={formatWholePercent(stats.stage_bucket_counts.retired, stats.total_use_cases)}
                href={buildUseCasesUrl({ stageBuckets: ["retired"] })}
              />
            </div>
          </div>

          {/* Cross-cuts — the browse dimensions, one slice at a time. */}
          <div>
            <div className="mb-3 eyebrow">
              Cross-cuts · slice the entire inventory by one dimension
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-4 md:grid-cols-4">
              <CrossCutCard
                kicker="A"
                href="/browse/sophistication"
                label="Sophistication"
                note="Browse by AI sophistication tier."
                source="derived"
              />
              <CrossCutCard
                kicker="B"
                href="/browse/high-impact"
                label="High-impact"
                note="Browse by high-impact designation."
                source="omb"
              />
              <CrossCutCard
                kicker="C"
                href="/browse/topic-area"
                label="Topic area"
                note="Browse by mission topic area."
                source="omb"
              />
              <CrossCutCard
                kicker="D"
                href="/browse/vendor"
                label="Vendor"
                note="Browse by product vendor."
                source="omb"
              />
            </div>
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------------ */}
      {/* § IV — PRODUCTS                                               */}
      {/* ------------------------------------------------------------ */}
      <Section
        number={kickers.Products}
        title="What they run"
        lede="The ten most widely deployed AI products, weighted by agencies reporting them."
      >
        <div className="grid gap-x-6 gap-y-10 md:grid-cols-5">
          <Figure
            className="md:col-span-3"
            eyebrow="Fig. 1 · Product adoption"
            caption={
              <>
                Source: <span className="text-foreground">use_cases</span>{" "}
                joined with <span className="text-foreground">products</span>;
                top 10 by distinct agencies.
              </>
            }
          >
            <TopProductsChart data={topProductsData} />
          </Figure>
          <Figure
            className="md:col-span-2"
            eyebrow="Fig. 2 · Agency type × tier"
            caption="Agencies with inventory data, grouped by type and maturity tier."
          >
            <AgencyTypeChart data={agencyTypeData} />
          </Figure>
        </div>

        {/* Top categories — IFP product categories by use-case reach. */}
        {topCategories.length > 0 ? (
          <div className="mt-8 border-t border-dotted border-border pt-5">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <div className="eyebrow !text-[var(--stamp)]">
                Top categories
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                IFP-derived · top 6 by use-case reach
              </span>
            </div>
            <ul className="flex flex-wrap items-center gap-1.5">
              {topCategories.map((c) => (
                <li key={c.category}>
                  <MonoChip
                    href={`/products?category=${encodeURIComponent(c.category)}`}
                    tone="stamp"
                    title={`${humanizeCategory(c.category)} · ${formatNumber(c.use_case_count)} use cases`}
                  >
                    {humanizeCategory(c.category)} ({formatNumber(c.use_case_count)})
                  </MonoChip>
                </li>
              ))}
              <li className="ml-1">
                <Link
                  href="/browse/category"
                  className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-[var(--stamp)]"
                >
                  → All categories
                </Link>
              </li>
            </ul>
          </div>
        ) : null}
      </Section>

      {/* ------------------------------------------------------------ */}
      {/* § V — WHAT CHANGED (2024 ↔ 2025)                              */}
      {/* ------------------------------------------------------------ */}
      {yoyHeadline ? (
        <HomeChangeSection kicker={kickers.Analytics} yoy={yoyHeadline} />
      ) : null}

      {/* ------------------------------------------------------------ */}
      {/* § VI — FEATURES                                               */}
      {/* ------------------------------------------------------------ */}
      <HomeFeaturesSection kicker={kickers.Features} />

      {/* ------------------------------------------------------------ */}
      {/* § VII — FEDRAMP                                               */}
      {/* ------------------------------------------------------------ */}
      {fedrampHeadline ? (
        <HomeFedrampSection kicker={kickers.FedRAMP} counts={fedrampHeadline} />
      ) : null}

      <HomeReferenceFootband />
    </div>
  );
}
