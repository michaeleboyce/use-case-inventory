/**
 * View-model for /discrepancies.
 *
 * Loads the four discrepancy roll-ups (summary / rows / per-agency
 * counts / detected patterns), then conditionally fetches the
 * unresolved-only slice that drives the "Begin triage" CTA and the
 * session counter. Keeping this all in one place lets the page render
 * stay focused on layout.
 *
 * Filter values (status / agency / search query) are still parsed in
 * the page since they're forwarded straight to the client table — the
 * VM accepts them as inputs and echoes them back in `initial*` for the
 * page to spread into `<DiscrepancyTable />`.
 */
import {
  getDiscrepancyAgencies,
  getDiscrepancyPatterns,
  getDiscrepancyRows,
  getDiscrepancySummary,
} from "@/lib/discrepancies";
import { canWriteResolutions } from "@/lib/resolutions";
import type { DiscrepancyStatus } from "@/lib/types";

export interface DiscrepanciesViewModelInput {
  initialStatus: DiscrepancyStatus | "all";
  initialAgency: string | undefined;
  initialQuery: string | undefined;
}

type Summary = ReturnType<typeof getDiscrepancySummary>;
type Rows = ReturnType<typeof getDiscrepancyRows>;
type Agencies = ReturnType<typeof getDiscrepancyAgencies>;
type Patterns = ReturnType<typeof getDiscrepancyPatterns>;

export interface DiscrepanciesViewModel extends DiscrepanciesViewModelInput {
  summary: Summary;
  rows: Rows;
  agencies: Agencies;
  patterns: Patterns;
  canWrite: boolean;
  firstUnresolvedId: number | null;
  totalUnresolved: number;
}

export async function buildDiscrepanciesViewModel(
  input: DiscrepanciesViewModelInput,
): Promise<DiscrepanciesViewModel> {
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

  return {
    ...input,
    summary,
    rows,
    agencies,
    patterns,
    canWrite,
    firstUnresolvedId,
    totalUnresolved,
  };
}
