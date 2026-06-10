"use client";

// Client Component — Recharts renders via browser APIs (SVG + ResizeObserver).

import { useRouter } from "next/navigation";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  Tooltip,
} from "recharts";
import { ChartFrame } from "@/components/charts/chart-frame";
import { humanize } from "@/lib/formatting";

export type DonutDatum = {
  label: string;
  count: number;
};

type Props = {
  data: DonutDatum[];
  colorMap?: Record<string, string>;
  palette?: string[];
  height?: number;
  labelMap?: Record<string, string>;
  centerLabel?: string;
  centerSubLabel?: string;
  /** When provided, slices whose datum maps to a URL become clickable.
   *  Return undefined for synthetic buckets that have no filter target. */
  hrefFor?: (d: DonutDatum) => string | undefined;
};

const DEFAULT_PALETTE = [
  "#3b82f6",
  "#8b5cf6",
  "#a855f7",
  "#06b6d4",
  "#14b8a6",
  "#6366f1",
  "#64748b",
  "#f59e0b",
  "#f97316",
  "#ef4444",
  "#10b981",
  "#ec4899",
];

export function DonutChart({
  data,
  colorMap = {},
  palette = DEFAULT_PALETTE,
  height = 240,
  labelMap,
  centerLabel,
  centerSubLabel,
  hrefFor,
}: Props) {
  const router = useRouter();
  const total = data.reduce((acc, d) => acc + d.count, 0);
  const display = centerLabel ?? String(total);

  const chartData = data
    .filter((d) => d.count > 0)
    .map((d, i) => ({
      name: labelMap?.[d.label] ?? humanize(d.label),
      rawLabel: d.label,
      value: d.count,
      fill: colorMap[d.label] ?? palette[i % palette.length],
      href: hrefFor?.(d),
    }));

  if (chartData.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height }}
      >
        No data
      </div>
    );
  }

  return (
    <ChartFrame
      height={height}
      overlay={
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-9">
          <span className="font-display text-[2rem] leading-none tabular-nums">
            {display}
          </span>
          {centerSubLabel ? (
            <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {centerSubLabel}
            </span>
          ) : null}
        </div>
      }
    >
      <PieChart>
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          innerRadius="55%"
          outerRadius="85%"
          strokeWidth={1}
          paddingAngle={1}
          onClick={(entry) => {
            const href = (entry as { href?: string }).href;
            if (href) router.push(href);
          }}
        >
          {chartData.map((d) => (
            <Cell
              key={d.rawLabel}
              fill={d.fill}
              cursor={d.href ? "pointer" : undefined}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            fontSize: 12,
            borderRadius: 0,
            borderColor: "var(--border)",
            background: "var(--background)",
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 11 }}
          iconSize={8}
          verticalAlign="bottom"
          height={36}
        />
      </PieChart>
    </ChartFrame>
  );
}
