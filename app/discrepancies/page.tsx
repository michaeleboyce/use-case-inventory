/**
 * /discrepancies — OMB consolidated 2025 vs IFP DB.
 *
 * Surfaces every place the OMB-published consolidated inventory disagrees
 * with our agency-as-filed dataset: missing rows, new rows, suggested
 * renames, duplicate filings, and field-level drift. Drives manual review
 * for the OMB-vs-IFP reconciliation work.
 *
 * Data: omb_match_audit (one row per match attempt) joined to use_cases
 * and omb_consolidated_rows. See lib/discrepancies.ts.
 */
import {
  getDiscrepancyAgencies,
  getDiscrepancyRows,
  getDiscrepancySummary,
} from "@/lib/discrepancies";
import { Section, MonoChip } from "@/components/editorial";
import { DiscrepancyTable } from "@/components/discrepancy-table";

export const metadata = {
  title: "Discrepancies · Federal AI Use Case Inventory",
  description:
    "Where OMB's 2025 consolidated inventory disagrees with our agency-as-filed dataset: missing rows, new rows, renames, duplicates, and field-level drift across 3,500+ use cases.",
};

export default function DiscrepanciesPage() {
  const summary = getDiscrepancySummary();
  // Fetch ALL rows; the client-side table has a "Resolved?" filter that
  // defaults to unresolved-only. This way switching filters doesn't require
  // a server round-trip.
  const rows = getDiscrepancyRows();
  const agencies = getDiscrepancyAgencies();

  const driftPct =
    summary.total_pairs_compared > 0
      ? (summary.total_with_drift / summary.total_pairs_compared) * 100
      : 0;

  return (
    <div className="mx-auto max-w-7xl px-6 py-12 space-y-12">
      <header className="space-y-4">
        <p className="eyebrow !text-[var(--stamp)]">§ Provenance audit</p>
        <h1 className="font-serif text-4xl font-medium leading-tight">
          OMB consolidated 2025 vs IFP database
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
      </header>

      <Section
        number="I"
        title="What changed between OMB's and IFP's versions"
        source="omb-derived"
      >
        <dl className="grid grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-3 lg:grid-cols-4">
          <Stat label="Exact name matches" value={summary.matched_exact} />
          <Stat label="Fuzzy name matches" value={summary.matched_fuzzy} />
          <Stat label="Suggested renames" value={summary.suggested_rename} />
          <Stat label="Duplicate in OMB" value={summary.duplicate_in_omb} />
          <Stat
            label="OMB-only (new in OMB)"
            value={summary.omb_only}
            highlight
          />
          <Stat
            label="DB-only (vanished from OMB)"
            value={summary.db_only}
            highlight
          />
          <Stat
            label="Pairs with field drift"
            value={summary.total_with_drift}
            sub={`${driftPct.toFixed(1)}% of ${summary.total_pairs_compared.toLocaleString()} matched pairs`}
          />
        </dl>
      </Section>

      <Section
        number="II"
        title="All unresolved discrepancies"
        source="omb-derived"
        lede="Filter by status, agency, or use-case name. Click any row for the field-by-field comparison. Most actionable buckets float to the top."
      >
        <DiscrepancyTable rows={rows} agencies={agencies} />
      </Section>
    </div>
  );
}

function Stat({
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
      <dd className="font-serif text-3xl font-medium tabular-nums">
        {value.toLocaleString()}
      </dd>
      {sub ? <dd className="text-xs text-stone-500">{sub}</dd> : null}
    </div>
  );
}
