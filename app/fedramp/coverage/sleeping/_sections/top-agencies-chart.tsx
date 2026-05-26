"use client";

import type { SleepingByAgencyRow } from "@/lib/types";
import { HorizontalBarChart } from "@/components/charts/horizontal-bar-chart";

const BAR_COLOR = "#1f5c8b";

export function TopSleepingAgenciesChart({ rows }: { rows: SleepingByAgencyRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        No agencies with sleeping authorizations.
      </p>
    );
  }
  // Use agency abbreviation as the bar label so the chart stays narrow; the
  // full agency name shows on hover via Recharts' tooltip.
  const data = rows.map((r) => ({ label: r.agency_abbreviation, count: r.sleeping_count }));
  const colorMap = Object.fromEntries(rows.map((r) => [r.agency_abbreviation, BAR_COLOR]));
  return (
    <HorizontalBarChart
      data={data}
      colorMap={colorMap}
      height={Math.max(220, rows.length * 22)}
      labelWidth={64}
    />
  );
}
