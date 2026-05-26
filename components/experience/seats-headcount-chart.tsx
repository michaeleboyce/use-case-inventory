"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  Cell,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartFrame } from "@/components/charts/chart-frame";
import type { AgencyToolMatrixRow } from "@/lib/experience-shared";

/**
 * Horizontal bar chart of the headcount-derived seat estimate per agency.
 * Sibling to `seats-by-agency-chart.tsx` (filed bands); the two together
 * let readers visually compare the two methodologies.
 *
 * Headcount-derived seats = workforce × AI-eligible share × Σ per-tool
 * share-of-eligible across the matrix cells that have an evidence row.
 * Agencies without a populated `agency_workforce_profile` row appear at
 * zero (filtered out below; matched to "Filed bands" chart's top 15).
 */
export function SeatsHeadcountChart({
  rows,
}: {
  rows: AgencyToolMatrixRow[];
}) {
  // Same agency set as the Filed-bands chart (top 15 by filed-band seats)
  // so the two charts can be read side-by-side and the missing-data agencies
  // are visible as dashes rather than absent rows.
  const sortedByFiled = [...rows].sort(
    (a, b) => b.estimated_seats_filed - a.estimated_seats_filed,
  );
  const top = sortedByFiled.slice(0, 15);
  const chartData = top.map((r) => ({
    abbreviation: r.abbreviation,
    name: r.name,
    headcount_seats: r.estimated_seats_headcount ?? 0,
    has_data: r.estimated_seats_headcount != null,
    breakdown: r.headcount_breakdown,
  }));
  const height = Math.max(280, chartData.length * 32);

  return (
    <ChartFrame height={height}>
      <BarChart
        data={[...chartData].reverse()}
        layout="vertical"
        margin={{ top: 4, right: 80, bottom: 24, left: 8 }}
      >
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          stroke="var(--border)"
          tickFormatter={(v) =>
            Intl.NumberFormat("en-US", { notation: "compact" }).format(
              v as number,
            )
          }
        />
        <YAxis
          type="category"
          dataKey="abbreviation"
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          stroke="var(--border)"
          width={64}
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
          formatter={(_value, _name, item) => {
            const r = item.payload as {
              has_data: boolean;
              headcount_seats: number;
              breakdown: string | null;
            };
            if (!r.has_data) {
              return [
                "no workforce data yet",
                "Headcount-derived",
              ];
            }
            return [
              `${r.headcount_seats.toLocaleString()} — ${r.breakdown ?? ""}`,
              "Headcount-derived",
            ];
          }}
          labelFormatter={(abbr) => {
            const r = chartData.find((x) => x.abbreviation === abbr);
            return r ? `${r.name} (${r.abbreviation})` : String(abbr);
          }}
        />
        <Bar dataKey="headcount_seats" radius={[0, 3, 3, 0]}>
          {chartData.map((d, i) => (
            <Cell key={i} fill={d.has_data ? "#1f7a8c" : "#e5e7eb"} />
          ))}
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}
