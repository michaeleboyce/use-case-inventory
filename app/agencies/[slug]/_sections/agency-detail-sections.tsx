import Link from "next/link";

import { MonoChip } from "@/components/editorial";
import { formatNumber } from "@/lib/formatting";
import type { OrgWithUseCaseCount } from "@/lib/types";
import { agencyUseCasesUrl } from "@/lib/urls";

// IFP product-category palette + display labels for §I Portfolio · Fig. 4.
// Page-local rather than shared with editorial.tsx because the list of
// categories that can appear here is open-ended (any value of
// products.product_type) and we want a fallback color for unknown ones.
// Mirrors components/charts/category-distribution-chart.tsx — duplication
// is intentional; extract to shared if a third caller appears.
export const CATEGORY_COLORS: Record<string, string> = {
  general_llm: "#10b981",
  productivity: "#2563eb",
  security_tool: "#ef4444",
  computer_vision: "#8b5cf6",
  scientific_ml: "#0ea5e9",
  data_analytics: "#f59e0b",
  ml_platform: "#06b6d4",
  coding_assistant: "#84cc16",
  document_ai: "#ec4899",
  agent_platform: "#14b8a6",
  physical_security: "#dc2626",
  consumer_feature: "#94a3b8",
  developer_tool: "#a855f7",
  investigative_data: "#f97316",
  threat_intel: "#be123c",
  forensics: "#7c2d12",
};

export function humanizeCategory(c: string): string {
  return c.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export function BreakdownChips({
  agencyId,
  rows,
  labels,
  filterKey,
}: {
  agencyId: number;
  rows: { label: string; count: number }[];
  labels: Record<string, string>;
  filterKey:
    | "entryTypes"
    | "aiSophistications"
    | "deploymentScopes"
    | "productCategories";
}) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
        Jump to filtered:
      </span>
      {rows.map((row) => (
        <MonoChip
          key={row.label}
          href={agencyUseCasesUrl(agencyId, { [filterKey]: [row.label] })}
          tone="stamp"
          size="xs"
          title={`${labels[row.label] ?? row.label} (${row.count})`}
        >
          {(labels[row.label] ?? row.label)} ({formatNumber(row.count)})
        </MonoChip>
      ))}
    </div>
  );
}

export function FedrampStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-display text-[2.2rem] leading-none tabular-nums text-foreground md:text-[2.6rem]">
        {formatNumber(value)}
      </div>
      {sub ? (
        <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {sub}
        </div>
      ) : null}
    </div>
  );
}

export function Colophon({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dotted border-border pb-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

export function SubAgencyRollupGrid({ orgs }: { orgs: OrgWithUseCaseCount[] }) {
  return (
    <ul className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
      {orgs.map((o) => {
        const total = o.descendant_use_case_count ?? o.use_case_count;
        const subLabel =
          o.child_count > 0
            ? `${o.use_case_count} direct · ${total} w/ sub-orgs`
            : `${total} use cases`;
        return (
          <li key={o.id}>
            <Link
              href={`/agencies/${o.slug}`}
              className="group flex items-baseline justify-between gap-3 border-t-2 border-foreground py-3 hover:border-[var(--stamp)]"
            >
              <div className="min-w-0">
                <p className="font-display italic text-[1.1rem] leading-tight tracking-[-0.01em] text-foreground group-hover:text-[var(--stamp)]">
                  {o.name}
                </p>
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {o.abbreviation ?? o.level.replace(/_/g, " ")}
                  {" · "}
                  {subLabel}
                </p>
              </div>
              <span className="shrink-0 font-display text-[1.6rem] leading-none tabular-nums text-foreground">
                {formatNumber(total)}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
