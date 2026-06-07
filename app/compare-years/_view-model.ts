/**
 * View-model for /compare-years.
 *
 * Pulls the four cycle-comparison queries and shapes them into a single
 * typed payload the page renders. `page.tsx` stays thin —
 * `await buildCompareYearsViewModel()` → render.
 *
 * The aggregate rows (`year_comparison`) are sliced by dimension here so
 * the page never re-filters; the lineage breakdown is keyed by status so
 * the page can read counts without scanning an array.
 */

import {
  getLineageBreakdown,
  getPerAgencyLineage,
  getRetiredBreakdown,
  getYearComparisonAggregates,
  getYearCompareGenAiByAgency,
  getTags2024Headlines,
  getSilentlyDroppedGenAiRows,
} from "@/lib/db";
import type { AgencyYearCompareGenAiRow } from "@/lib/db";
import type {
  LineageStatus,
  PerAgencyLineageRow,
  RetiredBreakdown,
  Tags2024Headlines,
  YearComparisonRow,
} from "@/lib/types";

/** Lineage counts keyed by status, with all five keys always present. */
export type LineageCounts = Record<LineageStatus, number>;

const ZERO_LINEAGE: LineageCounts = {
  continued: 0,
  renamed: 0,
  split: 0,
  retired_2024: 0,
  new_2025: 0,
};

export interface CompareYearsViewModel {
  /** The dimension=`total` row — the headline 2024 vs 2025 numbers. */
  total: YearComparisonRow;
  /** dimension=`stage` rows (lossy — taxonomies differ across cycles). */
  stageRows: YearComparisonRow[];
  /** dimension=`dev_method` rows (lossy). */
  devMethodRows: YearComparisonRow[];
  /** dimension=`agency` rows. */
  agencyRows: YearComparisonRow[];
  /** Lineage status counts, keyed; all five keys present. */
  lineage: LineageCounts;
  /** Total lineage links across all statuses. */
  lineageTotal: number;
  /** Per-agency lineage rollup, ordered by 2025 count desc. */
  perAgency: PerAgencyLineageRow[];
  /** Active-vs-already-retired split of `retired_2024`. */
  retired: RetiredBreakdown;
  /** IFP-tagged 2024 headline counts (total / GenAI / enterprise-wide). */
  tags2024: Tags2024Headlines;
  /** Per-agency 2024-vs-2025 IFP-tagged GenAI counts + delta. */
  genaiByAgency: AgencyYearCompareGenAiRow[];
  /** Count of live GenAI *filings* silently dropped from the 2025 cycle.
   *  Includes repeated-name entries (e.g. ED's 49 "Generative AI Usage"). */
  silentlyDroppedGenAiCount: number;
  /** Distinct live-GenAI *capabilities* — filings collapsed by (agency,
   *  name). The honest headline count; `silentlyDroppedGenAiCount` overstates
   *  it because a few agencies filed many entries under one repeated name. */
  silentlyDroppedGenAiDistinct: number;
}

/** A fallback total row, used only if the table is unexpectedly empty. */
const EMPTY_TOTAL: YearComparisonRow = {
  dimension: "total",
  bucket: null,
  agency_id: null,
  count_2024: 0,
  count_2025: 0,
  delta: 0,
  pct_change: null,
  comparability: "clean",
  notes: null,
};

export async function buildCompareYearsViewModel(): Promise<CompareYearsViewModel> {
  const aggregates = getYearComparisonAggregates();
  const lineageRows = getLineageBreakdown();
  const perAgency = getPerAgencyLineage();
  const retired = getRetiredBreakdown();
  const tags2024 = getTags2024Headlines();
  const genaiByAgency = getYearCompareGenAiByAgency();
  const liveGenAiRows = getSilentlyDroppedGenAiRows();
  const silentlyDroppedGenAiCount = liveGenAiRows.length;
  // Distinct named capabilities: collapse by (agency, use_case_name). Same
  // key the silently-dropped roster table groups on, kept in sync by format.
  const silentlyDroppedGenAiDistinct = new Set(
    liveGenAiRows.map(
      (r) => `${r.agency_abbreviation ?? "?"}|${r.use_case_name ?? "?"}`,
    ),
  ).size;

  const total =
    aggregates.find((r) => r.dimension === "total") ?? EMPTY_TOTAL;
  const stageRows = aggregates.filter((r) => r.dimension === "stage");
  const devMethodRows = aggregates.filter((r) => r.dimension === "dev_method");
  const agencyRows = aggregates.filter((r) => r.dimension === "agency");

  const lineage: LineageCounts = { ...ZERO_LINEAGE };
  for (const row of lineageRows) {
    lineage[row.lineage_status] = row.count;
  }
  const lineageTotal = lineageRows.reduce((acc, r) => acc + r.count, 0);

  return {
    total,
    stageRows,
    devMethodRows,
    agencyRows,
    lineage,
    lineageTotal,
    perAgency,
    retired,
    tags2024,
    genaiByAgency,
    silentlyDroppedGenAiCount,
    silentlyDroppedGenAiDistinct,
  };
}
