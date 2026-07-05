/**
 * Per-agency status pulse list on /discrepancies.
 *
 * Computes per-agency counts across the 6 actionable statuses (omits
 * matched_exact — too noisy to be triage-actionable) and renders one
 * row per agency with a CSS sparkline bar (200px total, segment widths
 * proportional to status counts) plus a brief inline count summary and
 * a link to the /discrepancies?agency=XYZ filtered view.
 */
import Link from "next/link";
import type { DiscrepancyRow, DiscrepancyStatus } from "@/lib/types";

const ACTIONABLE_STATUSES: DiscrepancyStatus[] = [
  "omb_only",
  "db_only",
  "consolidated_upstream",
  "suggested_rename",
  "duplicate_in_omb",
  "matched_fuzzy",
];

const STATUS_BAR_CLASS: Record<DiscrepancyStatus, string> = {
  omb_only: "bg-[var(--highlight)]",
  db_only: "bg-[var(--stamp)]",
  consolidated_upstream: "bg-[var(--highlight)]/60",
  suggested_rename: "bg-[var(--highlight)]/40",
  duplicate_in_omb: "bg-[var(--stamp)]/60",
  matched_fuzzy: "bg-muted-foreground/50",
  matched_exact: "",
};

const STATUS_SHORT_LABEL: Record<DiscrepancyStatus, string> = {
  omb_only: "new",
  db_only: "vanished",
  consolidated_upstream: "consolidated",
  suggested_rename: "rename",
  duplicate_in_omb: "duplicate",
  matched_fuzzy: "fuzzy",
  matched_exact: "exact",
};

interface AgencyPulse {
  agency: string;
  total: number;
  counts: Record<DiscrepancyStatus, number>;
}

function computeAgencyPulses(rows: DiscrepancyRow[]): AgencyPulse[] {
  const byAgency = new Map<string, AgencyPulse>();
  for (const r of rows) {
    if (r.resolved_at != null) continue;
    const agency = r.agency_abbreviation;
    if (!agency) continue;
    let pulse = byAgency.get(agency);
    if (!pulse) {
      pulse = {
        agency,
        total: 0,
        counts: {
          matched_exact: 0,
          matched_fuzzy: 0,
          suggested_rename: 0,
          omb_only: 0,
          db_only: 0,
          duplicate_in_omb: 0,
          consolidated_upstream: 0,
        },
      };
      byAgency.set(agency, pulse);
    }
    pulse.counts[r.match_status]++;
    if (ACTIONABLE_STATUSES.includes(r.match_status)) {
      pulse.total++;
    }
  }
  return Array.from(byAgency.values())
    .filter((p) => p.total > 0)
    .sort((a, b) => b.total - a.total);
}

const BAR_WIDTH_PX = 200;

export function DiscrepancyAgencyPulse({ rows }: { rows: DiscrepancyRow[] }) {
  const pulses = computeAgencyPulses(rows);

  if (pulses.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No unresolved discrepancies by agency.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border border border-border">
      {pulses.map((pulse) => {
        const inlineCounts = ACTIONABLE_STATUSES.filter(
          (s) => pulse.counts[s] > 0,
        )
          .map((s) => `${pulse.counts[s]} ${STATUS_SHORT_LABEL[s]}`)
          .join(" · ");
        return (
          <li key={pulse.agency}>
            <Link
              href={`/discrepancies?agency=${encodeURIComponent(pulse.agency)}`}
              className="flex items-center gap-4 px-4 py-3 hover:bg-muted/20"
            >
              <span className="w-16 font-mono text-xs uppercase tracking-wider text-foreground">
                {pulse.agency}
              </span>
              <span
                aria-hidden
                className="inline-flex h-2 overflow-hidden bg-muted"
                style={{ width: `${BAR_WIDTH_PX}px` }}
              >
                {ACTIONABLE_STATUSES.map((status) => {
                  const count = pulse.counts[status];
                  if (count === 0) return null;
                  const width = (count / pulse.total) * BAR_WIDTH_PX;
                  return (
                    <span
                      key={status}
                      className={STATUS_BAR_CLASS[status]}
                      style={{ width: `${width}px`, display: "inline-block" }}
                    />
                  );
                })}
              </span>
              <span className="flex-1 text-xs text-muted-foreground truncate">
                {inlineCounts}
              </span>
              <span className="font-mono text-sm tabular-nums text-foreground">
                {pulse.total.toLocaleString()}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
