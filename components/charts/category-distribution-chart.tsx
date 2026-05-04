/**
 * IFP product-category distribution chart. Client Component.
 *
 * Two side-by-side horizontal bar panels: "By use-case reach" and "By
 * agency count". Bars are clickable — each navigates to /browse/category
 * (the cross-cut landing page) so readers can drill into per-category
 * agency × value detail.
 *
 * Twin of `vendor-share-chart.tsx` but bucketed by IFP product_type
 * instead of vendor. Excludes the 'unclassified' placeholder upstream
 * (see lib/db.ts:getCategoryDistribution).
 */

"use client";

import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CategoryDistributionRow } from "@/lib/types";

const CATEGORY_COLORS: Record<string, string> = {
  general_llm: "#10b981", // emerald
  productivity: "#2563eb", // blue
  security_tool: "#ef4444", // red
  computer_vision: "#8b5cf6", // violet
  scientific_ml: "#0ea5e9", // sky
  data_analytics: "#f59e0b", // amber
  ml_platform: "#06b6d4", // cyan
  coding_assistant: "#84cc16", // lime
  document_ai: "#ec4899", // pink
  agent_platform: "#14b8a6", // teal
  physical_security: "#dc2626", // red-600
  consumer_feature: "#94a3b8", // slate-400
  developer_tool: "#a855f7", // purple
  investigative_data: "#f97316", // orange
  threat_intel: "#be123c", // rose
  forensics: "#7c2d12", // amber-900
};

function categoryColor(c: string): string {
  return CATEGORY_COLORS[c] ?? "#64748b"; // slate-500 fallback
}

function humanizeCategory(c: string): string {
  return c.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

type Props = {
  data: CategoryDistributionRow[];
  /** Cap the number of categories shown per panel (default 14). */
  limit?: number;
};

export function CategoryDistributionChart({ data, limit = 14 }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No category data available.
      </div>
    );
  }

  const byReach = [...data]
    .sort((a, b) => b.use_case_count - a.use_case_count)
    .slice(0, limit);
  const byAgencies = [...data]
    .sort((a, b) => b.agency_count - a.agency_count)
    .slice(0, limit);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <CategoryPanel
        title="By use-case reach"
        subtitle="Distinct use cases referencing any product in the category"
        data={byReach}
        valueKey="use_case_count"
      />
      <CategoryPanel
        title="By agency adoption"
        subtitle="Distinct agencies with at least one product in the category"
        data={byAgencies}
        valueKey="agency_count"
      />
    </div>
  );
}

function CategoryPanel({
  title,
  subtitle,
  data,
  valueKey,
}: {
  title: string;
  subtitle: string;
  data: CategoryDistributionRow[];
  valueKey: "use_case_count" | "agency_count";
}) {
  const router = useRouter();
  const display = [...data].reverse(); // top-down for vertical-layout BarChart
  const height = Math.max(240, display.length * 28);

  return (
    <div className="flex flex-col gap-2">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart
            data={display}
            layout="vertical"
            margin={{ top: 4, right: 40, bottom: 4, left: 8 }}
          >
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              stroke="var(--border)"
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="category"
              tickFormatter={humanizeCategory}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              stroke="var(--border)"
              width={140}
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
              formatter={(value, _name, entry) => {
                const d = (entry as { payload: CategoryDistributionRow })
                  .payload;
                const v = value as number;
                return [
                  valueKey === "use_case_count"
                    ? `${v} use cases · ${d.agency_count} agencies · ${d.product_count} products`
                    : `${v} agencies · ${d.use_case_count} use cases · ${d.product_count} products`,
                  humanizeCategory(d.category),
                ];
              }}
              labelFormatter={() => ""}
            />
            <Bar
              dataKey={valueKey}
              radius={[0, 4, 4, 0]}
              cursor="pointer"
              onClick={(entry) => {
                const cat = (entry as { category?: string }).category;
                if (cat) {
                  router.push(`/products?category=${encodeURIComponent(cat)}`);
                }
              }}
            >
              {display.map((d) => (
                <Cell key={d.category} fill={categoryColor(d.category)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
