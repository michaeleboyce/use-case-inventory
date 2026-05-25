"use client";

import type { AgencyPolicyPages } from "@/lib/types/policy";
import { HorizontalBarChart } from "@/components/charts/horizontal-bar-chart";

const CABINET_COLOR = "#1f5c8b";
const INDEPENDENT_COLOR = "#5a9bbf";

interface Props {
  rows: AgencyPolicyPages[];
}

export function PagesByAgencyChart({ rows }: Props) {
  const data = rows.map((r) => ({ label: r.agency_abbr, count: r.pages }));
  const colorMap = Object.fromEntries(
    rows.map((r) => [
      r.agency_abbr,
      r.agency_type === "Cabinet" ? CABINET_COLOR : INDEPENDENT_COLOR,
    ]),
  );

  // HorizontalBarChart manages its own ChartFrame. Pass a height that scales
  // with row count so all ~45 agency bars are visible.
  return (
    <HorizontalBarChart
      data={data}
      colorMap={colorMap}
      height={Math.max(380, rows.length * 18)}
      labelWidth={64}
    />
  );
}
