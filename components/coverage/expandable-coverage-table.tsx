"use client";

/**
 * Back-compat shim — the generic expandable table now lives at
 * `components/expandable-table.tsx` (it grew optional search + pagination
 * and is shared beyond /fedramp/coverage). Existing coverage consumers
 * keep this import path and the original prop names.
 */

export {
  ExpandableTable as ExpandableCoverageTable,
  type ExpandableTableProps as ExpandableCoverageTableProps,
} from "@/components/expandable-table";
