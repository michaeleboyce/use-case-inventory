"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartFrame } from "@/components/charts/chart-frame";
import {
  ENTERPRISE_TIERS,
  ENTERPRISE_TIER_BLURBS,
  ENTERPRISE_TIER_LABELS,
  type EnterpriseTier,
  type EnterpriseTierRollupRow,
} from "@/lib/experience-shared";

/** Stack order bottom→top: the operated tier anchors the bar so its growth
 *  reads as the bar's body; the permission tier sits on top as the thin
 *  vestige it became. */
const STACK_ORDER: EnterpriseTier[] = [
  "operated_build",
  "tenanted",
  "embedded_cots",
  "permission",
];

const TIER_COLORS: Record<EnterpriseTier, string> = {
  operated_build: "#b3361f", // stamp red — the 2025 story
  tenanted: "#d99a3e", // amber
  embedded_cots: "#94a3b8", // slate
  permission: "#4b5563", // gray — the 2024 vestige
};

/**
 * Two stacked bars (2024, 2025): enterprise-wide GenAI use cases by delivery
 * tier. Shows that the comparison changes in KIND, not just count — 2024's
 * enterprise GenAI was largely permissions, embedded COTS features, and
 * Copilot switch-ons; 2025's is dominated by operated internal services.
 */
export function EnterpriseTierChart({
  data,
}: {
  data: EnterpriseTierRollupRow[];
}) {
  if (data.length === 0) return null;

  const years = [...new Set(data.map((d) => d.year))].sort();
  const rows = years.map((year) => {
    const row: Record<string, number | string> = { year: String(year) };
    let total = 0;
    for (const tier of ENTERPRISE_TIERS) {
      const n = data.find((d) => d.year === year && d.tier === tier)?.n ?? 0;
      row[ENTERPRISE_TIER_LABELS[tier]] = n;
      total += n;
    }
    row.total = total;
    return row;
  });

  return (
    <div className="flex flex-col gap-3">
      <ChartFrame height={320}>
        <BarChart
          data={rows}
          margin={{ top: 8, right: 24, bottom: 8, left: 8 }}
          barCategoryGap="28%"
        >
          <CartesianGrid
            stroke="var(--border)"
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            stroke="var(--border)"
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            stroke="var(--border)"
          />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.4 }}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              fontSize: 12,
            }}
            formatter={(value, name, item) => {
              const v = typeof value === "number" ? value : Number(value ?? 0);
              const total = Number(
                (item?.payload as { total?: number } | undefined)?.total ?? 0,
              );
              const pct = total > 0 ? Math.round((v / total) * 100) : 0;
              return [`${v} (${pct}%)`, String(name)];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {STACK_ORDER.map((tier) => (
            <Bar
              key={tier}
              dataKey={ENTERPRISE_TIER_LABELS[tier]}
              stackId="tiers"
              fill={TIER_COLORS[tier]}
              maxBarSize={140}
            />
          ))}
        </BarChart>
      </ChartFrame>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-xs leading-relaxed text-muted-foreground sm:grid-cols-2">
        {STACK_ORDER.map((tier) => (
          <div key={tier} className="flex gap-2">
            <span
              className="mt-1 inline-block size-2.5 shrink-0 rounded-[2px]"
              style={{ background: TIER_COLORS[tier] }}
              aria-hidden
            />
            <div>
              <dt className="inline font-medium text-foreground">
                {ENTERPRISE_TIER_LABELS[tier]}.
              </dt>{" "}
              <dd className="inline">{ENTERPRISE_TIER_BLURBS[tier]}</dd>
            </div>
          </div>
        ))}
      </dl>
    </div>
  );
}
