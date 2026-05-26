"use client";

import type { SleepingByImpactRow } from "@/lib/types";
import { HorizontalBarChart } from "@/components/charts/horizontal-bar-chart";

// Impact-level → bar color. Higher impact = warmer / louder; mirrors the
// MonoChip impactTone treatment used elsewhere on coverage pages.
const IMPACT_COLOR: Record<string, string> = {
  High: "#9a3320",
  Moderate: "#b07a1e",
  "Li-SaaS": "#6b7280",
  Low: "#94a3b8",
  Unknown: "#cbd5e1",
};

export function SleepingByImpactChart({ rows }: { rows: SleepingByImpactRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        No sleeping authorizations.
      </p>
    );
  }
  const data = rows.map((r) => ({ label: r.impact_level, count: r.sleeping_count }));
  const colorMap = Object.fromEntries(
    rows.map((r) => [r.impact_level, IMPACT_COLOR[r.impact_level] ?? "#94a3b8"]),
  );
  return (
    <HorizontalBarChart
      data={data}
      colorMap={colorMap}
      height={Math.max(160, rows.length * 36)}
      labelWidth={96}
    />
  );
}
