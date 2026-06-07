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
import { getHeadlineStats } from "@/lib/readiness";
import type { Tags2024Headlines } from "@/lib/types";

type Maturity = ReturnType<typeof getAgencyMaturity>;
type Tiers = ReturnType<typeof getMaturityTierSummary>;
type Stats = ReturnType<typeof getGlobalStats>;
type AgencyType = ReturnType<typeof getAgencyTypeByTier>;
type Recent = ReturnType<typeof getRecentlyModifiedAgencies>;
type ReadinessHeadline = ReturnType<typeof getHeadlineStats>;
type Categories = ReturnType<typeof getCategoryDistribution>;
type Products = ReturnType<typeof getTopProducts>;

export interface HomeViewModel {
  stats: Stats;
  maturity: Maturity;
  tiers: Tiers;
  agencyTypeData: AgencyType;
  recent: Recent;
  readinessHeadline: ReadinessHeadline;
  distinctProducts: number;
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

  return {
    stats,
    maturity,
    tiers,
    agencyTypeData,
    recent,
    readinessHeadline,
    distinctProducts: maturity.reduce(
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
    topProductsData: topProducts.map((product) => ({
      id: product.id,
      name: product.canonical_name,
      vendor: product.vendor,
      agency_count: product.agency_count,
      use_case_count: product.use_case_count,
    })),
  };
}
