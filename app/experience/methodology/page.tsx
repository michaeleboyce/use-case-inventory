/**
 * /experience/methodology — the seat-model methodology page.
 *
 * Documents how the /experience §04 headline seat number is built: why filed
 * license bands can't be summed, the labeling pass that classified each band,
 * the three model rules, the provenance the number rests on, its sensitivity,
 * and the honest scope gaps. Designed to be footnoted from an IFP essay.
 */

import Link from "next/link";
import type { Metadata } from "next";
import { PageSubnav } from "@/components/page-subnav";
import { Section, MonoChip } from "@/components/editorial";
import { PageMasthead } from "@/components/page-masthead";
import { StratumBar, StratumLegend } from "@/components/experience/stratum-bar";
import { ProvenanceBar } from "@/components/experience/provenance-bar";
import {
  BandEvidenceTable,
  type BandEvidenceRow,
} from "@/components/experience/band-evidence-table";
import { SensitivityRange } from "@/components/experience/sensitivity-range";
import { EXCLUDED_AGENCY_ABBRS } from "@/lib/experience-shared";
import { buildMethodologyViewModel } from "./_view-model";

export const metadata: Metadata = {
  title: "Seat methodology · AI Experience",
  description:
    "How the federal seat estimate is built: why filed license bands can't be summed, the labeling pass, the three model rules, provenance, sensitivity, and scope gaps.",
};

function fmt(n: number): string {
  return n.toLocaleString();
}

export default async function SeatMethodologyPage() {
  const vm = await buildMethodologyViewModel();
  const { totals, naiveSum, provenance, sensitivity, labeling, exemplar, seatSource } =
    vm;

  const accessDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // seatSource.rows are LabeledBandRow, structurally the BandEvidenceRow the
  // table renders.
  const evidenceRows = seatSource.rows as unknown as BandEvidenceRow[];

  return (
    <>
      <PageSubnav
        tabs={[
          { id: "why", label: "Why not sum" },
          { id: "labeling", label: "Labeling pass" },
          { id: "rules", label: "Model rules" },
          { id: "provenance", label: "Provenance" },
          { id: "sensitivity", label: "Sensitivity" },
          { id: "scope", label: "Scope & gaps" },
        ]}
      />
      <main className="mx-auto max-w-[1400px] px-4 pb-24 md:px-8">
        {/* Dateline strip */}
        <div className="mt-6 flex flex-wrap items-baseline gap-3 border-b border-border pb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <MonoChip tone="stamp" size="xs">
            IFP
          </MonoChip>
          <span>Seat methodology</span>
          <span aria-hidden className="text-muted-foreground/50">
            ·
          </span>
          <Link
            href="/experience#section-04"
            className="underline-offset-2 hover:text-foreground hover:underline"
          >
            ← Back to the AI Experience
          </Link>
        </div>

        <div className="mt-10">
          <PageMasthead
            kicker="§ VI · Features"
            metaLines={["The stratified-overlap seat model · band_labels_2026-07"]}
            title="How we counted the people, not the licenses"
            lede={
              <>
                The headline says between{" "}
                <strong>{fmt(totals.floor)}</strong> and{" "}
                <strong>{fmt(totals.ceiling)}</strong> federal employees — a
                central estimate of <strong>{fmt(totals.central)}</strong> of{" "}
                <strong>{fmt(totals.eligible_total)}</strong> AI-eligible staff
                across {fmt(totals.agencies_modeled)} agencies — have at least
                one AI tool. That number is <em>not</em> the sum of the license
                bands agencies filed. Summing the bands gives{" "}
                {fmt(naiveSum)} — nearly double — because the same employees
                appear once per task row and once per tool, and some bands count
                devices or members of the public, not staff. This page shows
                every correction between those two numbers.
              </>
            }
          />
        </div>

        <Section
          id="why"
          number="01"
          title="Why bands can't be summed"
          source="derived"
          lede="Three failure modes make the naive band sum an overcount. Each is corrected explicitly, never silently dropped."
        >
          <div className="space-y-4 text-base leading-relaxed text-foreground">
            <ol className="list-decimal space-y-4 pl-6">
              <li>
                <strong>Task-row repetition.</strong> Agencies file one
                consolidated row per <em>task</em>, not per tool or per person.
                EPA filed roughly <strong>11 task rows</strong> each carrying
                the <code>10,000–50,000</code> band against a workforce of about{" "}
                <strong>12,198</strong> staff — summing them would claim well
                over 100,000 EPA seats from a 12,000-person agency. The same
                people are counted once per task they might do.
              </li>
              <li>
                <strong>Multiple products per row.</strong> Banded rows average
                about <strong>1.63 products each</strong> — a single
                &ldquo;general chat&rdquo; row can list Copilot, ChatGPT, and
                Gemini together. Those tools reach the same office population;
                treating each as an independent band triple-counts the staff.
              </li>
              <li>
                <strong>Non-people units inside the bands.</strong> Some filed
                bands count things that aren&apos;t employees at all — devices
                and endpoints, members of the public using a chatbot, or
                applications and cases processed. DOE&apos;s largest bands, for
                instance, mix workforce tools with public-facing and
                device-scoped counts. These are removed before any seat math.
              </li>
            </ol>
          </div>
        </Section>

        <Section
          id="labeling"
          number="02"
          title="The labeling pass"
          source="derived"
          lede="Every banded row was classified by population stratum, unit counted, and org scope — then the mass-carrying rows were hand-audited."
        >
          <div className="space-y-4 text-base leading-relaxed text-foreground">
            <p>
              All <strong>{fmt(labeling.totalLabeled)}</strong> banded rows were
              labeled by model batches for population stratum (general office,
              developers, legal, investigative, communications, clinical), the
              unit the band actually counts (employees, devices, public users,
              cases), and organizational scope. Of those,{" "}
              <strong>{fmt(labeling.auditedCount)}</strong> were hand-audited —
              including <strong>100%</strong> of the{" "}
              <strong>{fmt(labeling.largeBandCount)}</strong> rows in the ≥10,000
              bands, which carry{" "}
              <strong>{labeling.largeBandMassShare}%</strong> of the total seat
              mass. The largest bands move the headline the most, so they get
              the most scrutiny.
            </p>
            <p className="text-sm text-muted-foreground">
              Per-row labels, the labeler&apos;s reasoning, and the audit
              disposition are persisted in the ETL repo under{" "}
              <code>audit/retag/band_labels_2026-07/</code>. The full labeled
              set is reproduced in the provenance table below.
            </p>
          </div>
        </Section>

        <Section
          id="rules"
          number="03"
          title="The three model rules"
          source="derived"
          lede="Once labeled, three stateable rules turn 'what agencies filed' into 'how many people plausibly have a tool.'"
        >
          <div className="space-y-6">
            <div className="border-l-2 border-[var(--stamp)] pl-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--stamp)]">
                Rule 1 · MAX within a stratum
              </p>
              <p className="mt-2 font-mono text-sm text-foreground">
                reach<sub>s</sub> = max<sub>r ∈ s</sub> band(r)
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                All the tools in one population stratum reach the same people,
                so a stratum&apos;s reach is its single largest filed band —
                never a sum. Task-row repeats and multi-tool overlap collapse.
              </p>
            </div>
            <div className="border-l-2 border-border pl-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Rule 2 · Independence across strata
              </p>
              <p className="mt-2 font-mono text-sm text-foreground">
                union = eligible × (1 − ∏<sub>s</sub> (1 − share<sub>s</sub>))
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Different populations combine by independence: a developer with
                a coding assistant is assumed to hold the general chat tool at
                the same rate as everyone else, so strata union rather than sum.
              </p>
            </div>
            <div className="border-l-2 border-border pl-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Rule 3 · Caps at the eligible workforce
              </p>
              <p className="mt-2 font-mono text-sm text-foreground">
                capped<sub>s</sub> = min(reach<sub>s</sub>, min(eligible,
                occupation_count<sub>s</sub>))
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Every stratum is a share of the AI-eligible workforce, bounded
                by FedScope occupation counts for role strata — so no agency can
                structurally exceed its own headcount.
              </p>
            </div>
          </div>

          <div className="mt-8">
            <StratumLegend />
          </div>

          {exemplar ? (
            <div className="mt-8 border-t border-border pt-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Worked example · {exemplar.abbreviation} — {exemplar.name}
              </p>
              <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted-foreground">
                {exemplar.abbreviation}&apos;s general-office stratum is
                saturated — the filed band meets or exceeds the population
                ceiling — so the union is driven almost entirely by that one
                stratum, with the role strata adding a thin margin on top.
              </p>
              <div className="mt-5">
                <StratumBar agency={exemplar} />
              </div>
            </div>
          ) : null}
        </Section>

        <Section
          id="provenance"
          number="04"
          title="Provenance"
          source="derived"
          lede="What the headline rests on: seat mass by unit counted, by labeler confidence, and by audit status — then every labeled row."
        >
          <ProvenanceBar provenance={provenance} />
          <div className="mt-8 border-t border-border pt-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Every labeled band row
            </p>
            <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted-foreground">
              All {fmt(labeling.totalLabeled)} banded rows with their labels,
              units, strata, confidence, and audit disposition — including the
              rows excluded from the seat math (devices, public users, cases).
            </p>
            <div className="mt-4">
              <BandEvidenceTable rows={evidenceRows} />
            </div>
          </div>
        </Section>

        <Section
          id="sensitivity"
          number="05"
          title="Sensitivity"
          source="derived"
          lede="What moves the number, and by how much."
        >
          <SensitivityRange scenarios={sensitivity} />
          <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              The central estimate is most sensitive to the band end chosen —
              filed bands are wide (<code>1,001–5,000</code>,{" "}
              <code>10,000–50,000</code>), so the lower-end and upper-end
              scenarios bracket a substantial range. Dropping low-confidence
              labels barely moves the total because the mass-carrying large
              bands were all hand-audited to high confidence. Excluding the
              clinical stratum matters only for the few health agencies where
              ambient-scribe tools reach a large clinical population.
            </p>
          </div>
        </Section>

        <Section
          id="scope"
          number="06"
          title="Scope & honest gaps"
          source="derived"
          lede="What's excluded by policy, how the denominators were sourced, and what the inventory still can't tell you."
        >
          <div className="space-y-4 text-base leading-relaxed text-foreground">
            <ul className="list-disc space-y-3 pl-6">
              <li>
                <strong>
                  {EXCLUDED_AGENCY_ABBRS.join(" and ")} are excluded by policy.
                </strong>{" "}
                The Department of Defense (~770,000 civilians) and the U.S.
                Postal Service file separately from the M-25-21 inventory, so
                they are absent from every count and seat estimate here. Their
                absence means the federal total is a floor on what a
                fully-scoped inventory would show.
              </li>
              <li>
                <strong>Denominators are sourced post-2025-RIF.</strong>{" "}
                Workforce headcounts reflect the reductions in force earlier in
                2025, not pre-RIF staffing — OPM is modeled at about{" "}
                <strong>2,000</strong> staff, not the pre-RIF 5,600. Where an
                agency&apos;s AI tools plausibly reach contractors, the
                denominator includes them (DOE, for instance, adds roughly{" "}
                <strong>94,000</strong> contractors to its federal headcount);
                those rows carry a <code>denominator_basis</code> of{" "}
                <code>incl_contractors</code>.
              </li>
              <li>
                <strong>A license is not usage.</strong> The inventory records
                that a tool was made available at some scale — it cannot tell
                you how many of those people log in, how often, or whether
                access is default-on or opt-in. The seat model estimates{" "}
                <em>reach</em> (who could use a tool), not active use.
              </li>
            </ul>
          </div>

          <div className="mt-8 border-t border-border pt-6">
            <Link
              href="/experience#section-04"
              className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-foreground hover:text-[var(--stamp)]"
            >
              ← Back to §04 · How many people actually have AI
            </Link>
          </div>
        </Section>

        <footer className="mt-16 border-t border-border pt-4 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Stratified-overlap seat model · band_labels_2026-07 · accessed{" "}
          {accessDate}
        </footer>
      </main>
    </>
  );
}
