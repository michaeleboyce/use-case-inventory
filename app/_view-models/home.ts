import type {
  AgencyWithMaturity,
  CategoryDistributionRow,
  GlobalStats,
  ProductWithCounts,
} from "@/lib/types";

export function humanizeCategory(category: string): string {
  return category
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function formatWholePercent(numerator: number, denominator: number): string {
  return denominator === 0
    ? "—"
    : `${Math.round((numerator / denominator) * 100)}%`;
}

export function buildHomeViewModel({
  stats,
  maturity,
  topProducts,
  categories,
}: {
  stats: GlobalStats;
  maturity: AgencyWithMaturity[];
  topProducts: ProductWithCounts[];
  categories: CategoryDistributionRow[];
}) {
  const reportingAgencies = maturity.length;
  const totalEntries = stats.total_use_cases + stats.total_consolidated;

  return {
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
