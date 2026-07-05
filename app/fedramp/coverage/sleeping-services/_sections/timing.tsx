"use client";

/**
 * V5 — does recency explain the gap? Year-bucketed bar of the first host
 * ATO behind every sleeping pair (timing-excluded pairs included, shown in
 * their own bucket). Thin client wrapper around HorizontalBarChart,
 * mirroring the sleeping page's by-impact chart.
 */
import { HorizontalBarChart } from "@/components/charts/horizontal-bar-chart";
import type { SleepingTimingBucket } from "@/lib/types";

const BUCKET_COLOR: Record<string, string> = {
  "2022 or earlier": "#8a8a8a",
  "2023–24": "#6f6f6f",
  "2025 H1": "#565656",
  "2025 H2": "#3d3d3d",
  "Post-cutoff (2026)": "#c9c9c9",
  "No usable date": "#e0e0e0",
};

export function TimingChart({
  rows,
}: {
  rows: Array<{ bucket: SleepingTimingBucket; label: string; count: number }>;
}) {
  return (
    <HorizontalBarChart
      data={rows.map((r) => ({ label: r.label, count: r.count }))}
      colorMap={BUCKET_COLOR}
      labelWidth={150}
    />
  );
}
