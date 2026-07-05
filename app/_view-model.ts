/**
 * View-model for the homepage (app/page.tsx).
 *
 * Bundles the seven DB calls the home page makes and derives the
 * cross-cutting aggregates that the editorial sections render:
 *  - "at a glance" stat tiles (entry mix / stage mix / coverage),
 *  - the gap lists (agencies missing enterprise LLM / coding),
 *  - top categories chip-row and top-products chart series.
 *
 * Lives at `app/_view-model.ts` (the underscore-prefix folder name is
 * Next.js's "private to segment" convention; here it sits next to
 * `app/page.tsx` because the homepage has no route folder of its own).
 */
import {
  getAgencyMaturity,
  getAgencyTypeByTier,
  getCategoryDistribution,
  getGlobalStats,
  getMaturityTierSummary,
  getRecentlyModifiedAgencies,
  getTopProducts,
  getTags2024Headlines,
} from "@/lib/db";
import {
  getYearComparisonAggregates,
  getSilentlyDroppedGenAiRows,
} from "@/lib/db/year-comparison";
import {
  getAiClassificationCounts,
  hasAiClassification,
} from "@/lib/db/fedramp/classification";
import { getHeadlineStats } from "@/lib/readiness";
import type { Tags2024Headlines } from "@/lib/types";
import type { AiClassificationCounts } from "@/lib/types/fedramp";

/** 2024 ↔ 2025 headline deltas for the home front door (§ V teaser). */
export interface YoyHeadline {
  count2024: number;
  count2025: number;
  delta: number;
  pctChange: number | null;
  /** Distinct live-GenAI capabilities silently dropped from 2025 —
   *  the honest headline count (see compare-years view-model). */
  droppedGenAiDistinct: number;
}

type Maturity = ReturnType<typeof getAgencyMaturity>;
type Tiers = ReturnType<typeof getMaturityTierSummary>;
type Stats = ReturnType<typeof getGlobalStats>;
type AgencyType = ReturnType<typeof getAgencyTypeByTier>;
type Recent = ReturnType<typeof getRecentlyModifiedAgencies>;
type ReadinessHeadline = ReturnType<typeof getHeadlineStats>;
type Categories = ReturnType<typeof getCategoryDistribution>;

export interface HomeViewModel {
  stats: Stats;
  maturity: Maturity;
  tiers: Tiers;
  agencyTypeData: AgencyType;
  recent: Recent;
  readinessHeadline: ReadinessHeadline;
  /** Canonical product count — COUNT(*) FROM products (= stats.total_products). */
  distinctProducts: number;
  /** Agency×product deployment pairs — the sum of each agency's distinct
   *  products. A product run by 12 agencies counts 12 times, so this is
   *  NOT a product count; label it "deployments" wherever rendered. */
  productDeployments: number;
  codingEntries: number;
  agenticEntries: number;
  genAIEntries: number;
  tags2024: Tags2024Headlines;
  reportingAgencies: number;
  totalEntries: number;
  agenciesWithEnterpriseLLM: number;
  agenciesWithCoding: number;
  agenciesWithAgentic: number;
  agenciesWithCustom: number;
  missingEnterpriseLLM: Array<{ id: number; abbr: string; name: string }>;
  missingCoding: Array<{ id: number; abbr: string; name: string }>;
  topCategories: Categories;
  /** Null if the year_comparison table is absent (older DB snapshot). */
  yoyHeadline: YoyHeadline | null;
  /** Null if the FedRAMP AI-classification tables are absent. */
  fedrampHeadline: AiClassificationCounts | null;
  topProductsData: Array<{
    id: number;
    name: string;
    vendor: string | null;
    agency_count: number;
    use_case_count: number;
  }>;
}

export async function buildHomeViewModel(): Promise<HomeViewModel> {
  const stats = getGlobalStats();
  const maturity = getAgencyMaturity();
  const tiers = getMaturityTierSummary();
  const topProducts = getTopProducts(10);
  const agencyTypeData = getAgencyTypeByTier();
  const recent = getRecentlyModifiedAgencies(5);
  const readinessHeadline = getHeadlineStats();
  const categories = getCategoryDistribution();
  const tags2024 = getTags2024Headlines();

  const reportingAgencies = maturity.length;
  const totalEntries = stats.total_use_cases + stats.total_consolidated;

  // Front-door teasers for § V (year over year) and § VII (FedRAMP).
  // Both degrade to null on older DB snapshots rather than crashing home.
  let yoyHeadline: YoyHeadline | null = null;
  try {
    const total = getYearComparisonAggregates().find(
      (r) => r.dimension === "total",
    );
    if (total) {
      const dropped = getSilentlyDroppedGenAiRows();
      yoyHeadline = {
        count2024: total.count_2024,
        count2025: total.count_2025,
        delta: total.delta,
        pctChange: total.pct_change,
        droppedGenAiDistinct: new Set(
          dropped.map(
            (r) => `${r.agency_abbreviation ?? "?"}|${r.use_case_name ?? "?"}`,
          ),
        ).size,
      };
    }
  } catch {
    yoyHeadline = null;
  }

  let fedrampHeadline: AiClassificationCounts | null = null;
  try {
    fedrampHeadline = hasAiClassification() ? getAiClassificationCounts() : null;
  } catch {
    fedrampHeadline = null;
  }

  if (
    process.env.NODE_ENV !== "production" &&
    reportingAgencies !== stats.total_agencies_with_data
  ) {
    console.warn(
      `[home view-model] maturity rows (${reportingAgencies}) != agencies with inventory data (${stats.total_agencies_with_data}); prose uses total_agencies_with_data`,
    );
  }

  return {
    stats,
    maturity,
    tiers,
    agencyTypeData,
    recent,
    readinessHeadline,
    distinctProducts: stats.total_products,
    productDeployments: maturity.reduce(
      (acc, row) => acc + (row.maturity?.distinct_products_deployed ?? 0),
      0,
    ),
    codingEntries: maturity.reduce(
      (acc, row) => acc + (row.maturity?.coding_tool_count ?? 0),
      0,
    ),
    missingEnterpriseLLM: maturity
      .filter((agency) => (agency.maturity?.has_enterprise_llm ?? 0) === 0)
      .map((agency) => ({
        id: agency.id,
        abbr: agency.abbreviation,
        name: agency.name,
      }))
      .sort((a, b) => a.abbr.localeCompare(b.abbr)),
    missingCoding: maturity
      .filter((agency) => (agency.maturity?.has_coding_assistants ?? 0) === 0)
      .map((agency) => ({
        id: agency.id,
        abbr: agency.abbreviation,
        name: agency.name,
      }))
      .sort((a, b) => a.abbr.localeCompare(b.abbr)),
    reportingAgencies,
    totalEntries,
    agenciesWithEnterpriseLLM: maturity.filter(
      (agency) => (agency.maturity?.has_enterprise_llm ?? 0) === 1,
    ).length,
    agenciesWithCoding: maturity.filter(
      (agency) => (agency.maturity?.has_coding_assistants ?? 0) === 1,
    ).length,
    agenciesWithAgentic: maturity.filter(
      (agency) => (agency.maturity?.has_agentic_ai ?? 0) === 1,
    ).length,
    agenciesWithCustom: maturity.filter(
      (agency) => (agency.maturity?.has_custom_ai ?? 0) === 1,
    ).length,
    agenticEntries: maturity.reduce(
      (acc, row) => acc + (row.maturity?.agentic_ai_count ?? 0),
      0,
    ),
    genAIEntries: stats.total_genai_entries,
    tags2024,
    topCategories: categories.slice(0, 6),
    yoyHeadline,
    fedrampHeadline,
    topProductsData: topProducts.map((product) => ({
      id: product.id,
      name: product.canonical_name,
      vendor: product.vendor,
      agency_count: product.agency_count,
      use_case_count: product.use_case_count,
    })),
  };
}
