"use client";

/**
 * The 7-tile ledger at the top of /agencies/[slug] with in-place drill-downs
 * for the four use-case-counting tiles (Individual / General LLM / Coding /
 * Agentic). Click the tile body → still navigates to the explorer (preserved
 * "see all" affordance). Click the chevron in the corner → toggles an
 * expansion panel below the grid, rendered via the existing
 * `<CoverageUseCaseList>` (same idiom as /fedramp/coverage/* expanded rows).
 *
 * One shared panel below the grid; clicking another use-case-tile's chevron
 * swaps the contents; clicking the active chevron again collapses.
 *
 * `MetricTile` is kept purely presentational. The chevron lives in a sibling
 * `<ExpandableMetricTile>` wrapper that composes `<MetricTile>` + a small
 * absolutely-positioned chevron button.
 */

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { MetricTile } from "@/components/metric-tile";
import { CoverageUseCaseList } from "@/components/coverage/coverage-use-case-list";
import { Eyebrow } from "@/components/editorial";
import { formatYoY } from "@/lib/formatting";
import type {
  CoverageUseCaseRow,
  UseCaseWithTags,
} from "@/lib/types";

type DrillKey = "individual" | "general_llm" | "coding" | "agentic";

const PANEL_PREVIEW_LIMIT = 10;

function toCoverageRow(uc: UseCaseWithTags): CoverageUseCaseRow {
  const problem = uc.problem_statement?.trim() ?? "";
  const snippet =
    problem.length > 200 ? `${problem.slice(0, 200).trimEnd()}…` : problem;
  return {
    id: uc.id,
    slug: uc.slug,
    agency_abbreviation: uc.agency_abbreviation ?? "",
    use_case_name: uc.use_case_name,
    stage_of_development: uc.stage_of_development,
    problem_snippet: snippet || null,
  };
}

function ExpandableMetricTile({
  label,
  value,
  href,
  isExpanded,
  onToggleExpand,
}: {
  label: string;
  value: number;
  href: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  return (
    <div className="relative">
      <MetricTile label={label} value={value} href={href} />
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleExpand();
        }}
        aria-expanded={isExpanded}
        aria-label={
          isExpanded ? `Collapse ${label} list` : `Expand ${label} list`
        }
        className={`absolute right-0 top-2 inline-flex size-6 items-center justify-center rounded-sm border border-transparent text-muted-foreground transition-colors hover:border-[var(--rule)] hover:bg-[var(--paper-warm)]/60 hover:text-[var(--stamp)] ${
          isExpanded ? "text-[var(--stamp)]" : ""
        }`}
      >
        {isExpanded ? (
          <ChevronDown className="size-3.5" />
        ) : (
          <ChevronRight className="size-3.5" />
        )}
      </button>
    </div>
  );
}

export interface UseCaseDrillDownLedgerProps {
  /** Full per-agency lists, server-filtered. */
  individual: UseCaseWithTags[];
  generalLlm: UseCaseWithTags[];
  coding: UseCaseWithTags[];
  agentic: UseCaseWithTags[];

  /** Pre-computed display counts (from agency_maturity where applicable, so
   *  the tile values stay consistent with the rest of the page). */
  counts: {
    individual: number;
    consolidated: number;
    distinctProducts: number;
    generalLlm: number;
    coding: number;
    agentic: number;
    yoyGrowth: number;
  };

  /** "See all" hrefs (explorer URLs with the matching filters baked in). */
  hrefs: {
    individual: string;
    consolidated: string;
    distinctProducts: string;
    generalLlm: string;
    coding: string;
    agentic: string;
  };
}

export function UseCaseDrillDownLedger({
  individual,
  generalLlm,
  coding,
  agentic,
  counts,
  hrefs,
}: UseCaseDrillDownLedgerProps) {
  const [active, setActive] = useState<DrillKey | null>(null);

  const drilldowns: Record<
    DrillKey,
    { label: string; rows: UseCaseWithTags[]; href: string }
  > = {
    individual: {
      label: "Individual use cases",
      rows: individual,
      href: hrefs.individual,
    },
    general_llm: {
      label: "General LLM",
      rows: generalLlm,
      href: hrefs.generalLlm,
    },
    coding: {
      label: "Coding tools",
      rows: coding,
      href: hrefs.coding,
    },
    agentic: {
      label: "Agentic AI",
      rows: agentic,
      href: hrefs.agentic,
    },
  };

  const toggle = (key: DrillKey) =>
    setActive((cur) => (cur === key ? null : key));

  const activeDrill = active ? drilldowns[active] : null;
  const adapted: CoverageUseCaseRow[] = activeDrill
    ? activeDrill.rows.slice(0, PANEL_PREVIEW_LIMIT).map(toCoverageRow)
    : [];

  return (
    <>
      <section className="ink-in mt-10 grid grid-cols-2 gap-4 md:mt-14 md:grid-cols-4 lg:grid-cols-7">
        <ExpandableMetricTile
          label="Individual use cases"
          value={counts.individual}
          href={hrefs.individual}
          isExpanded={active === "individual"}
          onToggleExpand={() => toggle("individual")}
        />
        <MetricTile
          label="Consolidated entries"
          value={counts.consolidated}
          href={hrefs.consolidated}
        />
        <MetricTile
          label="Distinct products"
          value={counts.distinctProducts}
          href={hrefs.distinctProducts}
        />
        <ExpandableMetricTile
          label="General LLM"
          value={counts.generalLlm}
          href={hrefs.generalLlm}
          isExpanded={active === "general_llm"}
          onToggleExpand={() => toggle("general_llm")}
        />
        <ExpandableMetricTile
          label="Coding tools"
          value={counts.coding}
          href={hrefs.coding}
          isExpanded={active === "coding"}
          onToggleExpand={() => toggle("coding")}
        />
        <ExpandableMetricTile
          label="Agentic AI"
          value={counts.agentic}
          href={hrefs.agentic}
          isExpanded={active === "agentic"}
          onToggleExpand={() => toggle("agentic")}
        />
        <MetricTile
          label="YoY growth"
          value={counts.yoyGrowth}
          sublabel={formatYoY(counts.yoyGrowth)}
        />
      </section>

      {activeDrill ? (
        <section
          className="ink-in mt-4 rounded-sm border border-[var(--rule)] bg-[var(--paper-warm)]/40 px-5 py-5"
          aria-label={`Drill-down for ${activeDrill.label}`}
        >
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <Eyebrow color="stamp">
              § Drilling into · {activeDrill.label}
            </Eyebrow>
            <button
              type="button"
              onClick={() => setActive(null)}
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-[var(--stamp)]"
              aria-label="Collapse drill-down"
            >
              Close ×
            </button>
          </div>
          <CoverageUseCaseList
            rows={adapted}
            totalCount={activeDrill.rows.length}
            seeAllHref={activeDrill.href}
            emptyMessage="— No matching use cases —"
          />
        </section>
      ) : null}
    </>
  );
}
