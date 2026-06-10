/**
 * /readiness/methodology — citable rubric documentation.
 *
 * Designed to be footnoted in an IFP policy paper. Every editorial choice
 * on the readiness scorecard (weights, tier bands, headline pick, caveats)
 * is justified here. The page is intentionally text-heavy and prints well.
 */

import Link from "next/link";
import type { Metadata } from "next";
import { PageSubnav } from "@/components/page-subnav";
import { Section, MonoChip } from "@/components/editorial";
import { ReadinessRubricTable } from "@/components/readiness/readiness-rubric-table";
import {
  RUBRIC_VERSION,
  RUBRIC_DIMENSIONS,
  TIER_BANDS,
} from "@/lib/readiness/rubric";
import { getHeadlineStats } from "@/lib/readiness";

export const metadata: Metadata = {
  title: "Methodology · Federal AI Readiness Index",
  description:
    "The 5-dimension rubric, weights, tier bands, headline-statistic justification, caveats, and source data behind the Federal AI Readiness Index.",
};

function formatComputedAt(iso: string | null): string {
  if (!iso) return "unknown";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function MethodologyPage() {
  const headline = getHeadlineStats();
  const computedAtLabel = formatComputedAt(headline.computed_at);
  const accessDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      <PageSubnav
        tabs={[
          { id: "why", label: "Why" },
          { id: "rubric", label: "Rubric" },
          { id: "tier-bands", label: "Tier bands" },
          { id: "headline-statistics", label: "Headline stats" },
          { id: "caveats", label: "Caveats" },
          { id: "source-data", label: "Sources" },
          { id: "changelog", label: "Changelog" },
          { id: "citation", label: "Citation" },
        ]}
      />
    <main className="mx-auto max-w-[1400px] px-4 pb-24 md:px-8">
      {/* Dateline strip */}
      <div className="mt-6 flex flex-wrap items-baseline gap-3 border-b border-border pb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        <MonoChip tone="stamp" size="xs">
          IFP
        </MonoChip>
        <span>Methodology · v{RUBRIC_VERSION}</span>
        <span aria-hidden className="text-muted-foreground/50">
          ·
        </span>
        <span>Data as of {computedAtLabel}</span>
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

      <header className="mt-10 max-w-3xl">
        <h1 className="font-display italic text-[2.6rem] leading-[0.95] tracking-[-0.02em] text-foreground md:text-[3.6rem]">
          Methodology
        </h1>
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Federal AI Readiness Index · v{RUBRIC_VERSION}
        </p>
        <p className="mt-6 text-lg leading-relaxed text-foreground">
          The Federal AI Readiness Index scores each cabinet-level and
          independent agency in the OMB M-25-21 AI use case inventory along
          five weighted dimensions. It is a published rubric — every
          numerator, denominator, weight, and tier threshold on this page is
          fixed in code and reproducible from the public source data.
        </p>
      </header>

      <Section
        id="why"
        number="01"
        title="Why this exists"
        source="derived"
        lede="A state-capacity scorecard for the IFP audience: policy influencers, Hill staff, agency modernization leaders."
      >
        <div className="prose prose-stone max-w-none space-y-4 text-base leading-relaxed text-foreground">
          <p>
            Federal AI policy is now well-articulated — OMB M-25-21 prescribes
            disclosure, risk management, and procurement disciplines for every
            agency that deploys AI. What does not yet exist is a published
            measurement of how operationally ready each agency is to do those
            things. The disclosures themselves are the raw material; the
            Readiness Index turns them into a comparative scorecard.
          </p>
          <p>
            The artifact this rubric is modeled on is the Belfer Center&apos;s{" "}
            <em>National Cyber Power Index</em>: a small number of dimensions,
            published weights, per-actor scorecards, and a methodology page
            that survives the footnote bar of a policy paper. Domestically,
            the FITARA scorecards and GAO&apos;s High-Risk List play the same
            role — turning compliance data the executive branch already
            collects into something Hill staff can cite. None of those
            artifacts exists yet for federal AI deployment. This is an attempt
            at one.
          </p>
          <p>
            The rubric is opinionated by design. Procurement Hygiene and
            Reporting Quality together carry 50% of the composite score, which
            reflects an editorial judgment that the binding constraint on
            federal AI right now is institutional plumbing — ATOs, FedRAMP
            authorization, and disclosure discipline — not model capability.
            Readers who disagree can recompute the composite with their own
            weights; the per-dimension scores are published.
          </p>
        </div>
      </Section>

      <Section
        number="02"
        title="The rubric"
        source="derived"
        lede="Five dimensions, weighted. Each yields 0–100; composite is the weighted sum."
      >
        <div id="rubric" className="scroll-mt-36">
          <ReadinessRubricTable />
          <p className="mt-4 font-mono text-[11px] text-muted-foreground">
            Weights sum to{" "}
            {Math.round(
              RUBRIC_DIMENSIONS.reduce((s, d) => s + d.weight, 0) * 100,
            )}
            %. Each dimension is computed independently and rescaled to 0–100
            before the weighted composite.
          </p>
        </div>
      </Section>

      <Section
        number="03"
        title="Tier bands"
        source="derived"
        lede="Composite scores translate into letter tiers. Bands are intentionally demanding."
      >
        <div id="tier-bands" className="scroll-mt-36 border-t-2 border-foreground">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                <th scope="col" className="py-2 pr-4 align-bottom">
                  Tier
                </th>
                <th scope="col" className="py-2 pr-4 text-right align-bottom">
                  Range
                </th>
                <th scope="col" className="py-2 pr-4 align-bottom">
                  Label
                </th>
                <th scope="col" className="py-2 align-bottom">
                  Description
                </th>
              </tr>
            </thead>
            <tbody>
              {TIER_BANDS.map((b) => (
                <tr
                  key={b.tier}
                  className="border-b border-border/60 align-top last:border-b-0"
                >
                  <th
                    scope="row"
                    className="py-3 pr-4 text-left font-mono text-[1.05rem] font-semibold text-foreground"
                  >
                    {b.tier}
                  </th>
                  <td className="py-3 pr-4 text-right font-mono tabular-nums text-foreground">
                    {b.min}
                    {b.max === 100 ? "+" : `–${b.max}`}
                  </td>
                  <td className="py-3 pr-4 font-display italic text-foreground">
                    {b.label}
                  </td>
                  <td className="py-3 leading-snug text-muted-foreground">
                    {b.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          The bands are deliberately strict. As of {computedAtLabel}, zero
          agencies score in tier A and only one reaches tier B. That is not a
          defect of the rubric — it is the headline finding. A Frontier-Ready
          agency would need to (a) build AI in-house at scale, (b) include
          frontier-model and agentic capability, (c) run on ATO&apos;d and
          FedRAMP-authorized infrastructure, (d) have oversight on its risky
          deployments, and (e) reach across multiple bureaus. No agency clears
          all five thresholds today.
        </p>
      </Section>

      <Section
        number="04"
        title="Headline statistics"
        source="derived"
        lede="Three capacity-first numbers are featured; a fourth compliance baseline is preserved for contrast."
      >
        <div id="headline-statistics" className="scroll-mt-36 space-y-6">
          <article
            id="internal-build"
            className="scroll-mt-36 border-l-4 border-[var(--stamp)] bg-stone-50 p-4"
          >
            <div className="flex items-baseline gap-3">
              <span className="font-mono tabular-nums text-3xl font-semibold text-foreground">
                {headline.internal_build_pct.toFixed(1)}%
              </span>
              <MonoChip tone="stamp" size="xs">
                Featured on homepage
              </MonoChip>
            </div>
            <p className="mt-2 font-display italic text-[1.2rem] text-foreground">
              of federal AI is built in-house.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Counts a use case as internally built if it is custom-coded,
              labeled in-house in <code className="font-mono">development_type</code>,
              or attached to a product the catalog tags as an agency-internal
              platform. The remainder is commercial tooling. This is the
              cleanest direct measure of state capacity the inventory permits.
            </p>
          </article>

          <article
            id="production-rate"
            className="scroll-mt-36 border-l-2 border-border bg-background p-4"
          >
            <span className="font-mono tabular-nums text-2xl font-semibold text-foreground">
              {headline.production_rate_pct.toFixed(1)}%
            </span>
            <p className="mt-2 font-display italic text-[1.1rem] text-foreground">
              of reported use cases have reached deployed status.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Distinguishes shipped AI from pilots, acquisitions, and
              pre-deployment work. Counts the <em>c) Deployed</em> stage and
              the legacy <em>Operation and Maintenance</em> label. A real
              deployment signal — not a paperwork signal.
            </p>
          </article>

          <article
            id="fedramp"
            className="scroll-mt-36 border-l-2 border-border bg-background p-4"
          >
            <span className="font-mono tabular-nums text-2xl font-semibold text-foreground">
              {headline.fedramp_coverage_pct.toFixed(1)}%
            </span>
            <p className="mt-2 font-display italic text-[1.1rem] text-foreground">
              of federal AI use cases run on FedRAMP-authorized
              infrastructure.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Joined through curated product-to-FedRAMP links (roughly 80
              link rows as of publication), so this is a floor for what
              FedRAMP coverage truly is, not a ceiling. The procurement
              hygiene story.
            </p>
          </article>

          <article
            id="compliance-vs-capacity"
            className="scroll-mt-36 border-l-2 border-stone-400 bg-stone-50/60 p-4"
          >
            <div className="flex items-baseline gap-3">
              <span className="font-mono tabular-nums text-2xl font-semibold text-foreground">
                {headline.hi_no_risk_docs_pct.toFixed(1)}%
              </span>
              <MonoChip tone="muted" size="xs">
                Compliance baseline — not featured
              </MonoChip>
            </div>
            <p className="mt-2 font-display italic text-[1.1rem] text-foreground">
              of federal AI lacks the M-25-21 risk-documentation fields filled
              in.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Preserved here for honesty about what the rubric chose
              <em> not</em> to weight. This number measures whether agencies
              filled out OMB&apos;s disclosure form — a compliance question,
              not a capability one. v1.1 of the rubric replaced
              <em> Reporting Quality</em> and <em>Governance Documentation</em>
              {" "}as scored dimensions with <em>Internal Capacity</em> and
              {" "}<em>Risk-Relevant Governance</em>, precisely because filling
              the form is not the same as deploying competent AI.
            </p>
          </article>
        </div>
      </Section>

      <Section
        number="05"
        title="Caveats"
        source="derived"
        lede="What this score does not measure, and where the data is thinnest."
      >
        <div id="caveats" className="scroll-mt-36 space-y-4 text-base leading-relaxed text-foreground">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Agencies with no risky use cases score 0 on
              Risk-Relevant Governance.</strong> The denominator is risky
              deployments only — an agency with no PII or high-impact systems
              cannot earn this dimension. By design, but it caps the ceiling
              for some smaller-portfolio agencies.
            </li>
            <li>
              <strong>Single-year snapshot.</strong> The rubric is computed
              from the 2025 M-25-21 inventory only. Year-over-year change
              cannot be read off this score until a second year is published.
            </li>
            <li>
              <strong>Opinionated weights.</strong> The 30/25/20/15/10 split
              reflects an editorial view that direct technical capacity (what
              the agency builds and runs) matters more than disclosure
              completeness. The per-dimension scores are published so readers
              can recompute with their own weights.
            </li>
            <li>
              <strong>FedRAMP coverage is modest.</strong> The procurement
              dimension joins through a curated product-to-FedRAMP link
              table; coverage of inventoried products is partial. Where a
              product is not linked it is treated as not-on-FedRAMP, which
              undercounts agencies that deploy obscurely-named-but-authorized
              services.
            </li>
            <li>
              <strong>Compliance ≠ capacity.</strong> We do not score whether
              agencies filled out the M-25-21 disclosure form. That number is
              preserved in the headline-statistics section as a separate
              compliance baseline — but is not a state-capacity signal in the
              way the audience uses that term.
            </li>
            {RUBRIC_DIMENSIONS.flatMap((d) =>
              d.caveats.map((c, i) => (
                <li key={`${d.key}-${i}`}>
                  <strong>{d.label}:</strong> {c}
                </li>
              )),
            )}
          </ul>
        </div>
      </Section>

      <Section
        number="06"
        title="Source data"
        source="omb-derived"
        lede="Per-dimension source tables. Same lineage as the rest of the dashboard."
      >
        <div id="source-data" className="scroll-mt-36 space-y-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            All inputs are derived from the OMB M-25-21 federal AI use case
            inventory plus the IFP analytical layer described on the{" "}
            <Link
              href="/about"
              className="underline-offset-2 hover:text-foreground hover:underline"
            >
              colophon
            </Link>
            . Per-dimension breakdown:
          </p>
          <div className="border-t-2 border-foreground">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  <th scope="col" className="py-2 pr-4 align-bottom">
                    Dimension
                  </th>
                  <th scope="col" className="py-2 align-bottom">
                    Source tables / columns
                  </th>
                </tr>
              </thead>
              <tbody>
                {RUBRIC_DIMENSIONS.map((d) => (
                  <tr
                    key={d.key}
                    className="border-b border-border/60 align-top last:border-b-0"
                  >
                    <th
                      scope="row"
                      className="py-3 pr-4 text-left font-display italic text-foreground"
                    >
                      {d.label}
                    </th>
                    <td className="py-3 font-mono text-[11px] leading-snug text-muted-foreground">
                      {d.source}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      <Section
        number="07"
        title="Changelog"
        source="derived"
        lede="Versioned changes to weights, thresholds, or dimension definitions are recorded here."
      >
        <div id="changelog" className="scroll-mt-36">
          <ul className="space-y-3 text-base leading-relaxed text-foreground">
            <li>
              <span className="font-mono font-semibold text-foreground">
                v1.1
              </span>{" "}
              <span className="text-muted-foreground">
                (initial publication, capacity-first rubric)
              </span>{" "}
              — 5-dimension rubric with weights 30/25/20/15/10:
              Internal Capacity / Frontier Capability / Procurement Hygiene
              / Risk-Relevant Governance / Adoption Breadth. Tier bands at
              70 / 55 / 35 / 15.
            </li>
            <li>
              <span className="font-mono text-muted-foreground line-through">
                v1.0
              </span>{" "}
              <span className="text-muted-foreground italic">
                (drafted but not published)
              </span>{" "}
              — Earlier draft scored Reporting Quality and Governance
              Documentation as primary dimensions. Replaced before publication
              after the framing was challenged: counting whether agencies
              filled out the disclosure form is a compliance question, not a
              state-capacity question.
            </li>
          </ul>
        </div>
      </Section>

      <Section
        number="08"
        title="Citation"
        source="derived"
        lede="Copy-paste citation for footnoting in policy papers and articles."
      >
        <div id="citation" className="scroll-mt-36">
          <blockquote className="border-l-4 border-stone-400 bg-stone-50 p-4 font-mono text-sm leading-relaxed text-foreground">
            Institute for Progress. &ldquo;Federal AI Readiness
            Index.&rdquo; Federal AI Use Case Inventory, accessed{" "}
            {accessDate}. https://use-case-inventory.vercel.app/readiness
          </blockquote>
          <p className="mt-4 text-sm text-muted-foreground">
            Permalink to this methodology page:{" "}
            <Link
              href="/readiness/methodology"
              className="font-mono text-[11px] underline-offset-2 hover:text-foreground hover:underline"
            >
              /readiness/methodology
            </Link>
          </p>
        </div>
      </Section>

      <footer className="mt-16 border-t border-border pt-4 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        Data as of {computedAtLabel} · Rubric v{RUBRIC_VERSION}
      </footer>
    </main>
    </>
  );
}
