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
} from "@/lib/db";
import type {
  LineageStatus,
  PerAgencyLineageRow,
  RetiredBreakdown,
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
  };
}
