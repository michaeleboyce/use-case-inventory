"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartFrame } from "@/components/charts/chart-frame";
import { DefinitionToggle } from "./definition-toggle";
import {
  GENAI_DEFINITION_LABELS,
  type GenAiDefinition,
  type GenAiTimelinePoint,
} from "@/lib/experience-shared";

const ACTION_PLAN_YEAR = "2025";

/**
 * Stacked annual count of deployed GenAI go-live dates, with a vertical
 * reference line at the year Trump's AI Action Plan dropped (Jul 23, 2025).
 * The point of the chart is to show the curve was already bending pre-Plan.
 */
export function GenAiTimelineChart({
  data,
}: {
  data: GenAiTimelinePoint[];
}) {
  const [def, setDef] = React.useState<GenAiDefinition>("ifp_genai");

  // Filter unknown bucket out by default — agencies vary in how they fill
  // operational_date, and "unknown" carries no temporal signal.
  const rows = data
    .filter((d) => d.year !== "unknown" && Number(d.year) >= 2019)
    .map((d) => ({
      year: d.year,
      count: d.counts[def],
    }));

  const total = rows.reduce((a, r) => a + r.count, 0);
  const unknown = data.find((d) => d.year === "unknown")?.counts[def] ?? 0;

  return (
    <div className="flex flex-col gap-3">
      <DefinitionToggle value={def} onChange={setDef} />
      <p className="text-xs text-muted-foreground">
        Deployed-GenAI use cases bucketed by the year of their{" "}
        <code className="font-mono">operational_date</code>. Vertical dashed
        line marks 2025, the year of the AI Action Plan (Jul 23, 2025).{" "}
        {total} use cases have a parseable year under{" "}
        <strong>{GENAI_DEFINITION_LABELS[def]}</strong>; {unknown} additional
        rows have an unparseable or missing operational date.
      </p>
      <ChartFrame height={320}>
        <BarChart data={rows} margin={{ top: 8, right: 24, bottom: 36, left: 8 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="year"
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
          <ReferenceLine
            x={ACTION_PLAN_YEAR}
            stroke="var(--stamp)"
            strokeDasharray="4 4"
            label={{
              value: "AI Action Plan",
              position: "top",
              fill: "var(--stamp)",
              fontSize: 11,
            }}
          />
          <Bar dataKey="count" name="Deployed GenAI" fill="#b3361f" />
        </BarChart>
      </ChartFrame>
    </div>
  );
}
