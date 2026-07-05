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
import { PageMasthead } from "@/components/page-masthead";
import { ReadinessRubricTable } from "@/components/readiness/readiness-rubric-table";
import {
  RUBRIC_VERSION,
  RUBRIC_DIMENSIONS,
  TIER_BANDS,
} from "@/lib/readiness/rubric";
import { getHeadlineStats, getReadinessTierSummary } from "@/lib/readiness";

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

  // Tier occupancy is computed at render time — never hard-coded. The
  // empty top tiers are the finding, but the prose must stay correct if a
  // future rebuild lands an agency in A or B.
  const tierSummary = getReadinessTierSummary();
  const aCount = tierSummary.find((t) => t.tier === "A")?.count ?? 0;
  const bCount = tierSummary.find((t) => t.tier === "B")?.count ?? 0;
  const aPhrase = `${aCount} ${aCount === 1 ? "agency scores" : "agencies score"} in tier A`;
  const bPhrase = `${bCount} ${bCount === 1 ? "reaches" : "reach"} tier B`;
  const emptyTopPhrase =
    aCount === 0 && bCount === 0
      ? "the top two tiers standing empty"
      : aCount === 0
        ? "the top tier standing empty"
        : null;
  const tierFinding = emptyTopPhrase
    ? `That ${emptyTopPhrase} is not a defect of the rubric — it is the headline finding.`
    : "That the field still clusters so far below the Frontier-Ready bar is not a defect of the rubric — it is the headline finding.";

  return (
    <>
      <PageSubnav
        tabs={[
          { id: "why", label: "Why" },
          { id: "rubric", label: "Rubric" },
          { id: "tier-bands", label: "Tier bands" },
          { id: "headline-statistics", label: "Headline stats" },
          { id: "mechanics", label: "v1.2 mechanics" },
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

      <div className="mt-10">
        <PageMasthead
          kicker={`Federal AI Readiness Index · v${RUBRIC_VERSION}`}
          title="Methodology"
          lede={
            <>
              The Federal AI Readiness Index scores each cabinet-level and
              independent agency in the OMB M-25-21 AI use case inventory along
              five weighted dimensions. It is a published rubric — every
              numerator, denominator, weight, and tier threshold on this page is
              fixed in code and reproducible from the public source data.
            </>
          }
        />
      </div>

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
            The rubric is opinionated by design. Internal Capacity (30%) and
            Frontier Capability (25%) together carry 55% of the composite score
            — an editorial judgment that the binding signal is direct technical
            capacity: whether an agency builds and ships its own AI, at the
            frontier, rather than only buying commercial wrappers. Procurement
            Hygiene (20%), Risk-Relevant Governance (15%), and Adoption Breadth
            (10%) split the remainder. Readers who disagree can recompute the
            composite with their own weights; the per-dimension scores are
            published.
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
          The bands are deliberately strict. As of {computedAtLabel}, {aPhrase}{" "}
          and {bPhrase}. {tierFinding} A Frontier-Ready agency would need to (a)
          build AI in-house at scale, (b) include frontier-model and agentic
          capability, (c) run on ATO&apos;d and FedRAMP-authorized
          infrastructure, (d) have oversight on its risky deployments, and (e)
          reach across multiple bureaus.{" "}
          {aCount === 0
            ? "No agency clears all five thresholds today."
            : `Only ${aCount === 1 ? "one agency clears" : `${aCount} agencies clear`} all five thresholds today.`}
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
            className="scroll-mt-36 border-l-4 border-[var(--stamp)] bg-muted/20 p-4"
          >
            <div className="flex items-baseline gap-3">
              <span className="font-mono tabular-nums text-3xl font-semibold text-foreground">
                {Number(headline.internal_build_pct.toFixed(1))}%
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
              platform — unless the only claim is a bare in-house label sitting
              next to a commercial vendor with no custom code, which earns no
              credit (see the{" "}
              <a
                href="#inhouse-crosscheck"
                className="underline-offset-2 hover:text-foreground hover:underline"
              >
                in-house cross-check
              </a>
              ). The rest of the portfolio splits into{" "}
              {Number(headline.purchased_pct.toFixed(1))}% purchased commercial
              tooling and {Number(headline.unreported_pct.toFixed(1))}% that
              reports no build type at all. We show that third number rather
              than fold it into &ldquo;commercial,&rdquo; because a majority-adjacent
              disclosure gap is itself a finding about state capacity.
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
              of active use cases have reached deployed status.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Distinguishes shipped AI from pilots, acquisitions, and
              pre-deployment work. Counts the <em>c) Deployed</em> stage and
              the legacy <em>Operation and Maintenance</em> label; OMB{" "}
              <em>Pilot</em> rows are <strong>not</strong> counted as deployed
              (a v1.1 substring bug that swept them in is fixed — see the
              changelog). The denominator is <em>active</em> units only:
              retired use cases are excluded. Across all units including
              retired, the rate is{" "}
              {headline.production_rate_all_pct.toFixed(1)}%. A real deployment
              signal — not a paperwork signal.
            </p>
          </article>

          <article
            id="fedramp"
            className="scroll-mt-36 border-l-2 border-border bg-background p-4"
          >
            <span className="font-mono tabular-nums text-2xl font-semibold text-foreground">
              {headline.fedramp_linked_pct.toFixed(1)}%
            </span>
            <p className="mt-2 font-display italic text-[1.1rem] text-foreground">
              of use cases with an identified product run on FedRAMP-authorized
              infrastructure.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Joined through curated product-to-FedRAMP links (
              {headline.fedramp_link_row_count.toLocaleString()} link rows as
              of publication). The honest denominator is the roughly one-third
              of the inventory that names a product we can resolve to the
              catalog — most filings never name a checkable product. Measured
              instead against <em>all</em> units, the floor is{" "}
              {headline.fedramp_floor_pct.toFixed(1)}%. Both are floors, not
              ceilings: an unlinked product is treated as not-on-FedRAMP, which
              undercounts obscurely-named-but-authorized services. The
              procurement hygiene story.
            </p>
          </article>

          <article
            id="compliance-vs-capacity"
            className="scroll-mt-36 border-l-2 border-border bg-muted/20 p-4"
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
              filled out OMB&apos;s disclosure form — a compliance question, not
              a capability one. Crucially, M-25-21 Section 5 makes those fields
              only <em>conditionally</em> required — for high-impact use cases —
              so the all-rows figure above is a coverage statistic, <strong>not
              a non-compliance rate</strong>. Among the high-impact use cases
              where the fields <em>are</em> required,{" "}
              {headline.hi_no_risk_docs_high_impact_pct.toFixed(1)}% still lack
              them. The rubric replaced scored <em>Reporting Quality</em> and
              {" "}<em>Governance Documentation</em> dimensions with{" "}
              <em>Internal Capacity</em> and <em>Risk-Relevant Governance</em>,
              precisely because filling the form is not the same as deploying
              competent AI.
            </p>
          </article>
        </div>
      </Section>

      <Section
        number="05"
        title="How v1.2 is computed"
        source="derived"
        lede="Four mechanics separate v1.2 from the first published cut. Each exists to stop a specific way the raw filings mislead a naive share."
      >
        <div id="mechanics" className="scroll-mt-36 space-y-8 text-base leading-relaxed text-foreground">
          <div id="effective-units" className="scroll-mt-36 space-y-2">
            <h3 className="font-display text-[1.3rem] italic text-foreground">
              Effective-unit dedup
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Some agencies atomize a single program into dozens of
              near-identical filings; others report the same program once. Left
              raw, the atomizers dominate every share-based dimension. Before
              computing shares, v1.2 collapses rows that share an identical
              problem statement (at least 25 characters), vendor, and
              development type <em>within the same agency</em> into one{" "}
              <em>effective unit</em>. The{" "}
              {headline.total_use_cases.toLocaleString()} raw use cases reduce to{" "}
              {headline.total_units.toLocaleString()} effective units, and every
              share on this page is taken over the latter. This stops
              boilerplate volume from buying a higher score.
            </p>
          </div>

          <div id="inhouse-crosscheck" className="scroll-mt-36 space-y-2">
            <h3 className="font-display text-[1.3rem] italic text-foreground">
              In-house cross-check
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              A filing that claims pure in-house development while naming a
              commercial vendor and carrying no custom code is not building AI —
              it is describing a procurement. v1.2 withholds internal-capacity
              credit from exactly that pattern: a bare in-house label{" "}
              <em>plus</em> a commercial vendor <em>plus</em> no custom code
              scores as commercial. Hybrid filings — those with any custom code
              or an explicit both-contracting-and-in-house label — keep their
              credit. This reclassification moved roughly 126 rows out of the
              in-house column.
            </p>
          </div>

          <div id="shrinkage" className="scroll-mt-36 space-y-2">
            <h3 className="font-display text-[1.3rem] italic text-foreground">
              Governance shrinkage
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Risk-Relevant Governance divides oversight signals by risky
              deployments only, so an agency with one or two risky use cases
              could post a perfect (or zero) score off a single row. v1.2
              shrinks each agency&apos;s raw oversight rate toward the pooled
              federal rate with an Empirical-Bayes estimator:
            </p>
            <p className="font-mono text-[13px] leading-relaxed text-foreground">
              score = (x + K · p<sub>0</sub>) / (n + K)
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              where <em>x</em> is the agency&apos;s risky use cases carrying
              oversight, <em>n</em> its risky total, <em>p<sub>0</sub></em> the
              pooled federal oversight rate (about 47%), and <em>K</em> = 5 a
              fixed pseudo-count. A thin portfolio is pulled toward the federal
              mean; a deep one barely moves. An agency with zero risky use cases
              still scores 0 — we do not reward the absence of risk exposure.
              The oversight predicate itself was tightened in v1.2: junk PIA
              URLs and literal <code className="font-mono">N/A</code> Section-5
              values no longer count as oversight.
            </p>
          </div>

          <div id="missingness" className="scroll-mt-36 space-y-2">
            <h3 className="font-display text-[1.3rem] italic text-foreground">
              Blank means not counted
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              The inventory is sparsely filed. <code className="font-mono">has_ato</code>{" "}
              is blank on roughly 53% of rows, <code className="font-mono">has_pii</code>{" "}
              on about 55%, and the build-type fields on about 51%. v1.2 never
              imputes a blank as a positive signal: a field left empty scores as
              absent, so sparse filers score conservatively by design. This is
              why the three-way build split reports an{" "}
              <em>unreported</em> share rather than assuming unreported means
              commercial — the honest answer is that the filing does not say.
            </p>
          </div>
        </div>
      </Section>

      <Section
        number="06"
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
        number="07"
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
        number="08"
        title="Changelog"
        source="derived"
        lede="Versioned changes to weights, thresholds, or dimension definitions are recorded here."
      >
        <div id="changelog" className="scroll-mt-36">
          <ul className="space-y-3 text-base leading-relaxed text-foreground">
            <li>
              <span className="font-mono font-semibold text-foreground">
                v1.2
              </span>{" "}
              <span className="text-muted-foreground">
                (current — correctness pass over v1.1&apos;s published numbers)
              </span>{" "}
              — Same 30/25/20/15/10 weights and tier bands; the changes are to
              how the inputs are counted. (1) A substring bug that counted OMB{" "}
              <em>Pilot</em> rows as <em>Deployed</em> is fixed — the deployed
              rate falls from v1.1&apos;s published{" "}
              <span className="line-through">42%</span> to roughly 30%. (2)
              Near-identical filings within an agency now collapse into{" "}
              <a href="#effective-units" className="underline-offset-2 hover:text-foreground hover:underline">effective units</a>{" "}
              before any share is taken. (3) An{" "}
              <a href="#inhouse-crosscheck" className="underline-offset-2 hover:text-foreground hover:underline">in-house cross-check</a>{" "}
              (pure in-house claim + commercial vendor + no custom code = no
              credit) reclassified roughly 126 rows. (4) Risk-Relevant
              Governance is now{" "}
              <a href="#shrinkage" className="underline-offset-2 hover:text-foreground hover:underline">Empirical-Bayes shrunk</a>{" "}
              toward the pooled federal rate (K = 5), and the oversight
              predicate was tightened so junk PIA URLs and literal{" "}
              <code className="font-mono">N/A</code> Section-5 values no longer
              count. (5) Retired rows are excluded from stage-share
              denominators. (6) FedRAMP shares are computed after full
              product-link recovery, and reported with an honest
              product-linked denominator plus an all-units floor. (7) The hero
              was reframed to the three-way build split — v1.1&apos;s
              &ldquo;the rest is purchased commercial tooling&rdquo; was
              unsupported: about 52% of filings report no build type at all.
              Materially, several v1.1 rankings driven by these artifacts moved
              (ED was #2 and NARA #4 largely on pilot-as-deployed and
              atomized-filing effects).
            </li>
            <li>
              <span className="font-mono text-muted-foreground line-through">
                v1.1
              </span>{" "}
              <span className="text-muted-foreground italic">
                (superseded by v1.2 — cite with care)
              </span>{" "}
              — Initial publication of the capacity-first rubric: 5 dimensions
              weighted 30/25/20/15/10 (Internal Capacity / Frontier Capability
              / Procurement Hygiene / Risk-Relevant Governance / Adoption
              Breadth), tier bands at 70 / 55 / 35 / 15. Published headline
              numbers now known to be wrong: 42% deployed (pilot substring
              bug), and a hero framing that treated all non-in-house AI as
              &ldquo;purchased commercial tooling.&rdquo; Rankings from this
              version predate effective-unit dedup and the in-house
              cross-check.
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
        number="09"
        title="Citation"
        source="derived"
        lede="Copy-paste citation for footnoting in policy papers and articles."
      >
        <div id="citation" className="scroll-mt-36">
          <blockquote className="border-l-4 border-border bg-muted/20 p-4 font-mono text-sm leading-relaxed text-foreground">
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
