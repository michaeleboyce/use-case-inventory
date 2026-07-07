"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartFrame } from "@/components/charts/chart-frame";
import type { GenAiCycleStats } from "@/lib/types/adoption";

/**
 * Federal GenAI growth across the two inventory cycles, as raw counts —
 * deliberately a separate figure from the %-adoption curves so counts never
 * share an axis with percentages (the population-attribution trap).
 * Individual use cases only; consolidated/Appendix-B entries are excluded
 * because they have no 2024 counterpart.
 */

const COLOR_2024 = "var(--chart-adoption-context)";
const COLOR_2025 = "var(--chart-adoption-1)";

const METRIC_LABELS: Array<{
  key: keyof Omit<GenAiCycleStats, "inventory_year">;
  label: string;
}> = [
  { key: "total_use_cases", label: "All use cases" },
  { key: "genai_use_cases", label: "GenAI (IFP tag)" },
  { key: "deployed_genai", label: "Deployed GenAI" },
];

export function GenAiGrowthChart({ cycles }: { cycles: GenAiCycleStats[] }) {
  const by = (y: number) => cycles.find((c) => c.inventory_year === y);
  const rows = METRIC_LABELS.map(({ key, label }) => ({
    metric: label,
    y2024: by(2024)?.[key] ?? 0,
    y2025: by(2025)?.[key] ?? 0,
  }));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-[2px]"
            style={{ background: COLOR_2024 }}
          />
          2024 inventory
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-[2px]"
            style={{ background: COLOR_2025 }}
          />
          2025 inventory
        </span>
      </div>
      <ChartFrame height={300}>
        <BarChart
          data={rows}
          margin={{ top: 20, right: 16, bottom: 4, left: 8 }}
        >
          <CartesianGrid
            stroke="var(--border)"
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            dataKey="metric"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            stroke="var(--border)"
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            stroke="var(--border)"
            allowDecimals={false}
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
          />
          <Bar
            dataKey="y2024"
            name="2024 inventory"
            fill={COLOR_2024}
            stroke="var(--background)"
            strokeWidth={1}
          >
            <LabelList
              dataKey="y2024"
              position="top"
              style={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            />
          </Bar>
          <Bar
            dataKey="y2025"
            name="2025 inventory"
            fill={COLOR_2025}
            stroke="var(--background)"
            strokeWidth={1}
          >
            <LabelList
              dataKey="y2025"
              position="top"
              style={{ fontSize: 10, fill: "var(--foreground)" }}
            />
          </Bar>
        </BarChart>
      </ChartFrame>
    </div>
  );
}
