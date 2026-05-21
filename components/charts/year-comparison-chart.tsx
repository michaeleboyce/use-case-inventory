/**
 * Per-agency 2024 vs 2025 comparison — grouped horizontal bars, one pair
 * per agency. Client Component (Recharts + a Top / Bottom / All toggle on
 * absolute 2025 volume). Adapted from `yoy-growth-chart.tsx`.
 *
 * Counts come from the `year_comparison` table (dimension=`agency`), so
 * they reflect the aggregate cycle rollup — not the per-use-case lineage.
 */

"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartFrame } from "@/components/charts/chart-frame";
import { Button } from "@/components/ui/button";

const COLOR_2024 = "#94a3b8"; // slate-400 — prior cycle, muted
const COLOR_2025 = "#b3361f"; // vermilion stamp — current cycle

export type YearComparisonChartRow = {
  abbreviation: string;
  name: string;
  count_2024: number;
  count_2025: number;
};

type ViewMode = "top20" | "bottom20" | "all";

export function YearComparisonChart({
  data,
}: {
  data: YearComparisonChartRow[];
}) {
  const [mode, setMode] = React.useState<ViewMode>("top20");

  // Sorted by current-cycle volume, largest first.
  const rows = React.useMemo(
    () => [...data].sort((a, b) => b.count_2025 - a.count_2025),
    [data],
  );

  const visible = React.useMemo(() => {
    if (mode === "top20") return rows.slice(0, 20);
    if (mode === "bottom20") return rows.slice(-20);
    return rows;
  }, [mode, rows]);

  // Flip so the biggest agency sits at the top of the chart.
  const display = [...visible].reverse();
  const height = Math.max(280, display.length * 34);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Show:</span>
        <Button
          variant={mode === "top20" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("top20")}
        >
          Top 20
        </Button>
        <Button
          variant={mode === "bottom20" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("bottom20")}
        >
          Bottom 20
        </Button>
        <Button
          variant={mode === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("all")}
        >
          All ({rows.length})
        </Button>
      </div>

      <ChartFrame height={height}>
        <BarChart
          data={display}
          layout="vertical"
          barGap={2}
          margin={{ top: 4, right: 48, bottom: 24, left: 8 }}
        >
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            stroke="var(--border)"
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="abbreviation"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            stroke="var(--border)"
            width={70}
            interval={0}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.4 }}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--popover-foreground)",
            }}
            labelFormatter={(abbr) => {
              const key = String(abbr ?? "");
              const row = display.find((r) => r.abbreviation === key);
              return row ? `${row.name} (${row.abbreviation})` : key;
            }}
            formatter={(value, name) => [
              String(value ?? 0),
              String(name ?? ""),
            ]}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
          <Bar
            dataKey="count_2024"
            name="2024"
            fill={COLOR_2024}
            radius={[0, 3, 3, 0]}
          />
          <Bar
            dataKey="count_2025"
            name="2025"
            fill={COLOR_2025}
            radius={[0, 3, 3, 0]}
          />
        </BarChart>
      </ChartFrame>
    </div>
  );
}
