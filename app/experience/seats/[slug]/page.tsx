/**
 * /experience/seats/[slug] — one agency's corrected seat model.
 *
 * slug = lowercased agency abbreviation (e.g. "dhs"). Statically generated
 * for every modeled agency; unknown slugs 404. Shows the agency's
 * floor/central/ceiling, its workforce denominator, the per-stratum bar, the
 * labeled band evidence, and any researched rollout evidence.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { breadcrumbTrail } from "@/lib/nav";
import { PageMasthead } from "@/components/page-masthead";
import { Section, MonoChip } from "@/components/editorial";
import { StratumBar, StratumLegend } from "@/components/experience/stratum-bar";
import {
  BandEvidenceTable,
  type BandEvidenceRow,
} from "@/components/experience/band-evidence-table";
import { AiAccessTable } from "@/components/readiness/ai-access-table";
import { formatPercent } from "@/lib/formatting";
import { buildSeatNarrative } from "@/lib/seat-narrative";
import {
  buildAgencySeatViewModel,
  getModeledAgencySlugs,
} from "./_view-model";

function fmt(n: number): string {
  return n.toLocaleString();
}

export function generateStaticParams(): Array<{ slug: string }> {
  return getModeledAgencySlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await buildAgencySeatViewModel(slug);
  if (!data) return { title: "Agency not found · Seat model" };
  return {
    title: `${data.agency.abbreviation} seat model · AI Experience`,
    description: `Corrected AI seat estimate for ${data.agency.name}: floor ${fmt(
      data.agency.floor ?? 0,
    )}, central ${fmt(data.agency.central ?? 0)}, ceiling ${fmt(
      data.agency.ceiling ?? 0,
    )}.`,
  };
}

export default async function AgencySeatPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await buildAgencySeatViewModel(slug);
  if (!data) notFound();
  const { agency, input, rows, access, eligibleShare, denominatorBase } = data;

  const evidenceRows = rows as unknown as BandEvidenceRow[];
  const abbrLower = agency.abbreviation.toLowerCase();

  return (
    <main className="mx-auto max-w-[1400px] px-4 pb-24 md:px-8">
      <div className="mt-6">
        <Breadcrumbs
          trail={[
            ...breadcrumbTrail("/experience"),
            { href: "/experience#section-04", label: "Seat model" },
            { label: agency.abbreviation },
          ]}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-baseline gap-3 border-b border-border pb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        <MonoChip tone="stamp" size="xs">
          IFP
        </MonoChip>
        <span>Seat model</span>
        <span aria-hidden className="text-muted-foreground/50">
          ·
        </span>
        <Link
          href="/experience#section-04"
          className="underline-offset-2 hover:text-foreground hover:underline"
        >
          ← All modeled agencies
        </Link>
      </div>

      <div className="mt-10">
        <PageMasthead
          kicker={`§ VI · Seat model · ${agency.abbreviation}`}
          metaLines={["Stratified-overlap model · band_labels_2026-07"]}
          title={agency.name}
          lede={
            <>
              Our best estimate: <strong>{fmt(agency.central ?? 0)}</strong>{" "}
              {agency.abbreviation} staff have at least one AI tool —{" "}
              <strong>
                {agency.coverage_share != null
                  ? formatPercent(agency.coverage_share)
                  : "—"}
              </strong>{" "}
              of the <strong>{fmt(agency.eligible ?? 0)}</strong> employees
              whose jobs could use one. Under the most conservative reading of
              the filings it&apos;s at least{" "}
              <strong>{fmt(agency.floor ?? 0)}</strong>; under the most
              generous, at most <strong>{fmt(agency.ceiling ?? 0)}</strong>.
            </>
          }
        />
      </div>

      {/* Denominator card */}
      <Section
        number="01"
        title="The workforce denominator"
        source="derived"
        lede="Every share is taken against this agency's AI-eligible headcount. Here is how that denominator was built."
      >
        <div className="grid grid-cols-2 gap-px border border-border bg-border md:grid-cols-4">
          <Stat
            label="Total headcount"
            value={agency.total_headcount != null ? fmt(agency.total_headcount) : "—"}
          />
          <Stat
            label="AI-eligible"
            value={agency.eligible != null ? fmt(agency.eligible) : "—"}
          />
          <Stat
            label="Eligible share"
            value={eligibleShare != null ? formatPercent(eligibleShare) : "—"}
          />
          <Stat
            label="Headcount as of"
            value={agency.headcount_as_of ?? "—"}
          />
        </div>

        <div className="mt-4 space-y-2 text-sm leading-relaxed text-muted-foreground">
          {input?.denominator_basis === "incl_contractors" ? (
            <p>
              This agency&apos;s denominator{" "}
              <strong>includes contractors</strong> — its AI tools plausibly
              reach a contractor workforce, so the base is federal staff plus
              about {fmt(input.contractor_headcount ?? 0)} contractors
              {denominatorBase != null ? ` (${fmt(denominatorBase)} total)` : ""}.
            </p>
          ) : null}
          {agency.headcount_source_url ? (
            <p>
              <a
                href={agency.headcount_source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-foreground underline decoration-dotted underline-offset-2 hover:text-[var(--stamp)]"
              >
                Headcount source
                <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            </p>
          ) : null}
        </div>
      </Section>

      {/* The estimate's logic, in plain English — generated from the model
          output itself so the story can't drift from the numbers. */}
      <Section
        number="02"
        title="How this estimate was built"
        source="derived"
        lede="The whole chain of reasoning, step by step — every number below comes from a filed inventory row, a hand-audited label, or a cited workforce source."
      >
        {(() => {
          const narrative = buildSeatNarrative(agency);
          return (
            <>
              <ol className="max-w-prose space-y-4">
                {narrative.steps.map((step, i) => (
                  <li key={step.title} className="flex gap-4">
                    <span className="mt-0.5 font-mono text-xs font-semibold text-[var(--stamp)]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-foreground">
                        {step.title}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-foreground/85">
                        {step.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
              {narrative.conclusion ? (
                <p className="mt-5 max-w-prose border-l-4 border-[var(--stamp)] bg-muted/20 px-4 py-3 text-sm font-medium leading-relaxed text-foreground">
                  {narrative.conclusion}
                </p>
              ) : null}
            </>
          );
        })()}
      </Section>

      {/* Stratum bar */}
      <Section
        number="03"
        title="Coverage by population group"
        source="derived"
        lede="Each group's coverage is its largest filed band, capped at the people who actually hold those roles; groups combine without double-counting into the best estimate."
      >
        <StratumBar agency={agency} />
        <div className="mt-6">
          <StratumLegend />
        </div>
      </Section>

      {/* Band evidence */}
      <Section
        number="04"
        title="The labeled band evidence"
        source="derived"
        lede="Every banded row this agency filed, with its population label, unit counted, confidence, and audit disposition."
      >
        {evidenceRows.length > 0 ? (
          <BandEvidenceTable rows={evidenceRows} />
        ) : (
          <p className="text-sm text-muted-foreground">
            No labeled band rows on file for this agency.
          </p>
        )}
      </Section>

      {/* Rollout evidence — reuse the /readiness/access finding table */}
      {access.length > 0 ? (
        <Section
          number="05"
          title="Researched rollout evidence"
          source="derived"
          lede="Public evidence of how widely this agency has made a general-purpose AI tool available — availability, not measured usage."
        >
          <AiAccessTable rows={access} />
        </Section>
      ) : null}

      {/* Cross-links */}
      <aside className="mt-16 border-t-2 border-foreground pt-5">
        <div className="eyebrow mb-4 !text-[var(--stamp)]">Continue</div>
        <ul className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          <li>
            <Link href={`/agencies/${abbrLower}`} className="group block">
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-foreground transition-colors group-hover:text-[var(--stamp)]">
                {agency.abbreviation} agency page →
              </span>
              <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">
                the full 2025 inventory for this agency
              </span>
            </Link>
          </li>
          <li>
            <Link href="/experience#section-04" className="group block">
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-foreground transition-colors group-hover:text-[var(--stamp)]">
                Back to the seat model →
              </span>
              <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">
                how many people across all agencies have AI
              </span>
            </Link>
          </li>
        </ul>
      </aside>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-mono text-xl tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}
