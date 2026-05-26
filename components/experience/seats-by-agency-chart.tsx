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
import type { SeatExtrapolationRow } from "@/lib/experience-shared";

/**
 * Horizontal bars of midpoint seat estimates per agency, derived from the
 * license bands on `consolidated_use_cases`. Bands ("1001-5000" etc.) are
 * collapsed onto their midpoints; the bar's tooltip exposes the defensible
 * lower/upper range so readers can see how wide the band-collapse error is.
 *
 * Seats = "AI tool entitlements," not unique employees. An employee with
 * MS Copilot AND ChatGPT counts twice.
 */
export function SeatsByAgencyChart({
  rows,
}: {
  rows: SeatExtrapolationRow[];
}) {
  const top = rows.slice(0, 15);
  const height = Math.max(280, top.length * 32);

  return (
    <ChartFrame height={height}>
      <BarChart
        data={[...top].reverse()}
        layout="vertical"
        margin={{ top: 4, right: 80, bottom: 24, left: 8 }}
      >
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          stroke="var(--border)"
          tickFormatter={(v) => Intl.NumberFormat("en-US", { notation: "compact" }).format(v as number)}
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
            const r = item.payload as SeatExtrapolationRow;
            return [
              `${r.midpoint.toLocaleString()} (range ${r.lower_bound.toLocaleString()}–${r.upper_bound.toLocaleString()})`,
              "Est. seats",
            ];
          }}
          labelFormatter={(abbr) => {
            const r = top.find((x) => x.abbreviation === abbr);
            return r ? `${r.name} (${r.abbreviation})` : String(abbr);
          }}
        />
        <Bar dataKey="midpoint" fill="#b3361f" radius={[0, 3, 3, 0]}>
          {top.map((_, i) => (
            <Cell key={i} fill="#b3361f" />
          ))}
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}
