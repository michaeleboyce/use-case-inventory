/**
 * /discrepancies — OMB consolidated 2025 vs IFP DB.
 *
 * Surfaces every place the OMB-published consolidated inventory disagrees
 * with our agency-as-filed dataset: missing rows, new rows, suggested
 * renames, duplicate filings, and field-level drift. Drives manual review
 * for the OMB-vs-IFP reconciliation work.
 *
 * Layout (Phase 6, forensic-editorial):
 *   1. Posture banner (Vercel = read-only, local = triage workbench)
 *   2. Detected patterns (cards — only when ≥1 detected)
 *   3. By agency (sparkline pulse list)
 *   4. All discrepancies (condensed stat cards + filterable table)
 *
 * Data: omb_match_audit (one row per match attempt) joined to use_cases
 * and omb_consolidated_rows. See lib/discrepancies.ts.
 */
import Link from "next/link";

import {
  getDiscrepancyAgencies,
  getDiscrepancyPatterns,
  getDiscrepancyRows,
  getDiscrepancySummary,
} from "@/lib/discrepancies";
import { canWriteResolutions } from "@/lib/resolutions";
import type { DiscrepancyStatus } from "@/lib/types";
import { Section, MonoChip } from "@/components/editorial";
import { BulkResolveBar } from "@/components/bulk-resolve-bar";
import { DiscrepancyTable } from "@/components/discrepancy/discrepancy-table";
import { DiscrepancyPatternCard } from "@/components/discrepancy/discrepancy-pattern-card";
import { DiscrepancyAgencyPulse } from "@/components/discrepancy/discrepancy-agency-pulse";
import { DiscrepancyPostureBanner } from "@/components/discrepancy/discrepancy-posture-banner";
import { SessionCounterPill } from "@/components/session-counter-pill";

export const metadata = {
  title: "Discrepancies · Federal AI Use Case Inventory",
  description:
    "Where OMB's 2025 consolidated inventory disagrees with our agency-as-filed dataset: missing rows, new rows, renames, duplicates, and field-level drift across 3,500+ use cases.",
};

const VALID_STATUSES: DiscrepancyStatus[] = [
  "matched_exact",
  "matched_fuzzy",
  "suggested_rename",
  "omb_only",
  "db_only",
  "duplicate_in_omb",
  "consolidated_upstream",
];

function coerceStatus(
  raw: string | string[] | undefined,
): DiscrepancyStatus | "all" {
  if (raw == null) return "all";
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (VALID_STATUSES as string[]).includes(value)
    ? (value as DiscrepancyStatus)
    : "all";
}

function coerceString(raw: string | string[] | undefined): string | undefined {
  if (raw == null) return undefined;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value || undefined;
}

export default async function DiscrepanciesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const initialStatus = coerceStatus(params.status);
  const initialAgency = coerceString(params.agency);
  const initialQuery = coerceString(params.q);

  const summary = getDiscrepancySummary();
  const rows = getDiscrepancyRows();
  const agencies = getDiscrepancyAgencies();
  const patterns = getDiscrepancyPatterns();
  const canWrite = canWriteResolutions();
  // First unresolved audit id — drives the "Begin triage →" CTA.
  const unresolvedRows = canWrite
    ? getDiscrepancyRows({ unresolvedOnly: true })
    : [];
  const firstUnresolvedId =
    unresolvedRows.length > 0 ? unresolvedRows[0].audit_id : null;
  const totalUnresolved = unresolvedRows.length;

  return (
    <div className="mx-auto max-w-7xl px-6 py-12 space-y-12">
      <DiscrepancyPostureBanner />

      <header className="space-y-4">
        <p className="eyebrow !text-[var(--stamp)]">§ Provenance audit</p>
        <h1 className="font-serif text-4xl font-medium leading-tight">
          Discrepancies
        </h1>
        <p className="max-w-prose text-stone-600">
          The 2025 OMB consolidated file
          {" "}
          (<MonoChip size="xs" tone="muted">2025_individually_reported_AI_use_cases.xlsx</MonoChip>)
          {" "}is OMB&rsquo;s normalized snapshot of agency filings. We keep our
          own row-for-row ingest of each agency&rsquo;s raw file. This page
          lists every place the two disagree — by row presence, by name, and by
          field value on matched pairs.
        </p>
        {canWrite ? (
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {firstUnresolvedId != null ? (
              <Link
                href={`/discrepancies/${firstUnresolvedId}`}
                className="inline-block bg-stone-900 text-white px-4 py-2 font-display text-sm hover:bg-stone-700"
              >
                Begin triage →
              </Link>
            ) : null}
            <BulkResolveBar />
            <SessionCounterPill
              totalUnresolved={totalUnresolved}
              resetOnMount
            />
          </div>
        ) : null}
      </header>

      {patterns.length > 0 ? (
        <Section
          number="01"
          title="Detected patterns"
          source="omb-derived"
          lede="Clusters that explain large chunks of the audit table at once. Open a card to filter the table to its rows."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {patterns.map((pattern) => (
              <DiscrepancyPatternCard key={pattern.id} pattern={pattern} />
            ))}
          </div>
        </Section>
      ) : null}

      <Section
        number="02"
        title="By agency"
        source="omb-derived"
        lede="Per-agency status pulse. Sparkline shows the mix of unresolved discrepancies; click a row to filter the table to that agency."
      >
        <DiscrepancyAgencyPulse rows={rows} />
      </Section>

      <Section
        number="03"
        title="All discrepancies"
        source="omb-derived"
        lede="Filter by status, agency, or use-case name. Click any row for the field-by-field comparison."
      >
        <CondensedStatGrid summary={summary} />
        <div className="mt-6">
          <DiscrepancyTable
            rows={rows}
            agencies={agencies}
            initialStatus={initialStatus}
            initialAgency={initialAgency}
            initialQuery={initialQuery}
          />
        </div>
      </Section>
    </div>
  );
}

function CondensedStatGrid({
  summary,
}: {
  summary: ReturnType<typeof getDiscrepancySummary>;
}) {
  const driftPct =
    summary.total_pairs_compared > 0
      ? (summary.total_with_drift / summary.total_pairs_compared) * 100
      : 0;

  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
      <CondensedStat
        label="OMB only (new)"
        value={summary.omb_only}
        highlight
      />
      <CondensedStat
        label="DB only (vanished)"
        value={summary.db_only}
        highlight
      />
      <CondensedStat
        label="Consolidated upstream"
        value={summary.consolidated_upstream}
      />
      <CondensedStat
        label="Pairs with field drift"
        value={summary.total_with_drift}
        sub={`${driftPct.toFixed(1)}% of ${summary.total_pairs_compared.toLocaleString()} matched`}
      />
    </dl>
  );
}

function CondensedStat({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: number;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`space-y-1 ${highlight ? "text-amber-700" : ""}`}>
      <dt className="text-xs uppercase tracking-wider text-stone-500">
        {label}
      </dt>
      <dd className="font-serif text-2xl font-medium tabular-nums">
        {value.toLocaleString()}
      </dd>
      {sub ? <dd className="text-xs text-stone-500">{sub}</dd> : null}
    </div>
  );
}
