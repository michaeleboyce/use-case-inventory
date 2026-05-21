/**
 * Use-case lineage breakdown — a single 100%-segmented horizontal bar
 * showing the five lineage statuses (continued / renamed / split /
 * retired_2024 / new_2025) as shares of all 4,259 links.
 *
 * Client Component (Recharts). The lineage is IFP-derived: a deterministic
 * name match followed by LLM adjudication of the ambiguous pairs.
 */

"use client";

import {
  Bar,
  BarChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartFrame } from "@/components/charts/chart-frame";
import type { LineageStatus } from "@/lib/types";

const SEGMENTS: Array<{
  key: LineageStatus;
  label: string;
  color: string;
}> = [
  { key: "continued", label: "Continued", color: "#10b981" },
  { key: "renamed", label: "Renamed", color: "#6366f1" },
  { key: "split", label: "Split", color: "#06b6d4" },
  { key: "retired_2024", label: "Retired (2024 only)", color: "#b3361f" },
  { key: "new_2025", label: "New (2025 only)", color: "#f59e0b" },
];

export function LineageBreakdownChart({
  counts,
}: {
  counts: Record<LineageStatus, number>;
}) {
  const total = SEGMENTS.reduce((acc, s) => acc + (counts[s.key] ?? 0), 0);

  // One synthetic row holds all five segments so they stack into a single bar.
  const row: Record<string, number | string> = { label: "Lineage" };
  for (const seg of SEGMENTS) row[seg.key] = counts[seg.key] ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <ChartFrame height={88}>
        <BarChart
          data={[row]}
          layout="vertical"
          margin={{ top: 4, right: 8, bottom: 4, left: 8 }}
          stackOffset="expand"
        >
          <XAxis type="number" hide domain={[0, 1]} />
          <YAxis type="category" dataKey="label" hide />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.3 }}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--popover-foreground)",
            }}
            formatter={(value, name) => {
              const v = Number(value ?? 0);
              const pct = total > 0 ? ((v / total) * 100).toFixed(1) : "0";
              return [`${v.toLocaleString()} (${pct}%)`, String(name ?? "")];
            }}
          />
          {SEGMENTS.map((seg) => (
            <Bar
              key={seg.key}
              dataKey={seg.key}
              name={seg.label}
              stackId="a"
              fill={seg.color}
            />
          ))}
        </BarChart>
      </ChartFrame>

      <ul className="flex flex-wrap gap-x-5 gap-y-2 font-mono text-[11px] text-muted-foreground">
        {SEGMENTS.map((seg) => {
          const v = counts[seg.key] ?? 0;
          const pct = total > 0 ? Math.round((v / total) * 100) : 0;
          return (
            <li key={seg.key} className="inline-flex items-baseline gap-1.5">
              <span
                aria-hidden
                className="inline-block h-2.5 w-3 translate-y-[1px]"
                style={{ background: seg.color }}
              />
              <span className="text-foreground">{seg.label}</span>
              <span className="tabular-nums">
                {v.toLocaleString()} · {pct}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
