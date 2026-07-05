/**
 * /readiness/access — "AI Access & Scale".
 *
 * Renders `agency_ai_access_evidence`: researched, source-backed evidence of
 * how widely each CFO Act agency has made a general-purpose AI tool available
 * to its workforce. `coverage_assessment` is an AVAILABILITY measure (who can
 * use the tool), deliberately distinct from active usage — see the
 * methodology note below.
 */

import Link from "next/link";
import type { Metadata } from "next";
import { Section, MonoChip } from "@/components/editorial";
import { PageMasthead } from "@/components/page-masthead";
import { AiAccessCoverageBand } from "@/components/readiness/ai-access-coverage-band";
import { AiAccessTable } from "@/components/readiness/ai-access-table";
import { getAgencyAiAccessEvidence, getAiAccessSummary } from "@/lib/db";

export const metadata: Metadata = {
  title: "AI Access & Scale · Federal AI Readiness",
  description:
    "Researched, source-backed evidence of how widely each CFO Act agency has made a general-purpose AI tool available to its workforce.",
};

function formatDate(iso: string | null): string {
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

export default function AiAccessPage() {
  const rows = getAgencyAiAccessEvidence();
  const summary = getAiAccessSummary();
  const c = summary.by_coverage;
  const partialPilot = c.partial + c.pilot;
  const accessDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <main className="mx-auto max-w-[1400px] px-4 pb-24 md:px-8">
      {/* Dateline strip */}
      <div className="mt-6 flex flex-wrap items-baseline gap-3 border-b border-border pb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        <MonoChip tone="stamp" size="xs">
          IFP
        </MonoChip>
        <span>AI Access &amp; Scale</span>
        <span aria-hidden className="text-muted-foreground/50">
          ·
        </span>
        <span>Data as of {formatDate(summary.computed_at)}</span>
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

      {/* Header + lede */}
      <div className="mt-10">
        <PageMasthead
          kicker="How widely is a general-purpose AI tool available to federal staff?"
          title="AI Access & Scale"
          lede={
            <>
              Of the {summary.total_agencies} CFO Act agencies in the federal AI
              use-case inventory,{" "}
              <strong className="font-semibold">
                {c.all} have made a general-purpose AI tool available to all
                employees
              </strong>{" "}
              and {c.most} to most. {partialPilot} run partial or pilot
              deployments, {c.latent} have only latent access — a Microsoft 365
              entitlement with no deliberate rollout — {c.unknown} have no public
              statement of scope, and {c.none} has paused staff AI use. Most
              findings below are backed by a verbatim quote and a dated public
              source; where no public evidence exists, the gap is recorded rather
              than hidden.
            </>
          }
        />
      </div>

      {/* Methodology note */}
      <aside className="mt-8 max-w-3xl border-l-4 border-[var(--stamp)] bg-muted/20 px-5 py-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          How to read &ldquo;coverage&rdquo;
        </p>
        <p className="mt-2 text-sm leading-relaxed text-foreground">
          Coverage is an <strong>availability</strong> measure — who{" "}
          <em>can</em> use the tool — not how many actively do. A tool
          available to an entire workforce is{" "}
          <span className="font-mono text-xs">all</span> even if only a
          fraction log in. Example: the State Department&apos;s StateChat is
          available to all 75,000+ staff worldwide, so it is{" "}
          <span className="font-mono text-xs">all</span> — though its measured
          adoption is roughly 58,000 users. Active-usage figures, where known,
          appear in each finding&apos;s detail line, never in the coverage
          tier.
        </p>
      </aside>

      {/* § 01 — Coverage band */}
      <Section
        number="01"
        title="The coverage band"
        source="derived"
        lede="All 22 CFO Act agencies sorted by how widely a general-purpose AI tool is available. Each agency is placed in its most-available tier."
      >
        <AiAccessCoverageBand rows={rows} />
      </Section>

      {/* § 02 — Evidence */}
      <Section
        number="02"
        title="The evidence"
        source="mixed"
        lede="One row per researched finding — agency, tool, availability, a verbatim quote, and a dated source. Agencies with no public deployment data are shown as an explicit gap."
      >
        <AiAccessTable rows={rows} />
      </Section>

      {/* Footer */}
      <footer className="mt-12 border-t border-border pt-5 font-mono text-[11px] leading-relaxed text-muted-foreground">
        <p>
          {summary.corroborated_findings} corroborated findings ·{" "}
          {summary.searched_no_source} researched gaps · across{" "}
          {summary.total_agencies} CFO Act agencies. Department of Defense and
          USAID are not in the OMB M-25-21 inventory and are excluded.
        </p>
        <p className="mt-2">
          Researched and verified for the Institute for Progress. Data as of{" "}
          {formatDate(summary.computed_at)} · accessed {accessDate} ·{" "}
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
