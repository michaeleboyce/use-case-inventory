/**
 * View-model for /analytics.
 *
 * Wraps the eleven analytics queries that back the ten-figure
 * supplement, plus the leaderboard re-shaping (coding / enterprise LLM
 * rows reformatted into the standard {abbreviation, value, href}
 * shape used by `<CodingLeaderboard />`).
 *
 * `ANALYTICS_FIGURES` (the figure index used by the table of contents)
 * lives here too because it's tightly coupled to the figures rendered
 * below it.
 */
import {
  getAnalyticsInsights,
  getArchitectureDistribution,
  getCodingToolAgencies,
  getCycleAgencyCounts,
  getEnterpriseLLMAgencies,
  getEntryTypeMixByAgency,
  getGlobalStats,
  getLLMVendorShare,
  getCuratedVendorFlagShare,
  getLLMVendorVisibilityByAgency,
  getMaturityScatterData,
  getProductAgencyMatrix,
  getVendorMarketShare,
  getYoYGrowthData,
} from "@/lib/db";
import { agencyUseCasesUrl } from "@/lib/urls";

export const ANALYTICS_FIGURES: Array<{
  num: string;
  id: string;
  title: string;
  section: string;
}> = [
  { num: "01", id: "insights", title: "Headline insights", section: "Adoption" },
  { num: "02", id: "yoy", title: "Year-over-year growth", section: "Growth" },
  { num: "03", id: "vendors", title: "Vendor market share", section: "Market share" },
  { num: "04", id: "heatmap", title: "Product adoption heatmap", section: "Market share" },
  { num: "05", id: "scatter", title: "Maturity × growth × scale", section: "Growth" },
  { num: "06", id: "architecture", title: "Architecture distribution", section: "Adoption" },
  { num: "07", id: "llm-vendors", title: "LLM vendor share", section: "Market share" },
  { num: "07a", id: "llm-visibility", title: "LLM visibility gap", section: "Market share" },
  { num: "08", id: "coding", title: "Coding tool adoption", section: "Reach" },
  { num: "09", id: "enterprise-llm", title: "Enterprise LLM access", section: "Reach" },
  { num: "10", id: "entry-mix", title: "Entry-type mix", section: "Adoption" },
];

type LeaderboardRow = {
  id: number;
  abbreviation: string;
  name: string;
  value: number;
  href: string;
  subLabel?: string;
};

function buildAnalyticsLeaderboards({
  coding,
  enterpriseLLM,
}: {
  coding: ReturnType<typeof getCodingToolAgencies>;
  enterpriseLLM: ReturnType<typeof getEnterpriseLLMAgencies>;
}): { codingRows: LeaderboardRow[]; enterpriseLLMRows: LeaderboardRow[] } {
  return {
    codingRows: coding.map((row) => ({
      id: row.agency_id,
      abbreviation: row.abbreviation,
      name: row.name,
      value: row.coding_tool_count,
      href: agencyUseCasesUrl(row.agency_id, { isCodingTool: true }),
    })),
    enterpriseLLMRows: enterpriseLLM
      .filter((row) => row.has_enterprise_llm === 1)
      .map((row) => ({
        id: row.agency_id,
        abbreviation: row.abbreviation,
        name: row.name,
        value: row.general_llm_count,
        subLabel: "enterprise LLM",
        href: agencyUseCasesUrl(row.agency_id, {
          isGeneralLLMAccess: true,
        }),
      })),
  };
}

function sumCounts(rows: Array<{ count: number }>): number {
  return rows.reduce((acc, row) => acc + row.count, 0);
}

export interface AnalyticsViewModel {
  globalStats: ReturnType<typeof getGlobalStats>;
  cycleAgencies: ReturnType<typeof getCycleAgencyCounts>;
  insights: ReturnType<typeof getAnalyticsInsights>;
  yoy: ReturnType<typeof getYoYGrowthData>;
  vendorShare: ReturnType<typeof getVendorMarketShare>;
  heatmap: ReturnType<typeof getProductAgencyMatrix>;
  scatter: ReturnType<typeof getMaturityScatterData>;
  architecture: ReturnType<typeof getArchitectureDistribution>;
  llmVendors: ReturnType<typeof getLLMVendorShare>;
  curatedVendorFlags: ReturnType<typeof getCuratedVendorFlagShare>;
  llmVisibilityGap: ReturnType<typeof getLLMVendorVisibilityByAgency>;
  entryMix: ReturnType<typeof getEntryTypeMixByAgency>;
  codingRows: LeaderboardRow[];
  enterpriseLLMRows: LeaderboardRow[];
  llmVendorTotal: number;
}

export async function buildAnalyticsViewModel(): Promise<AnalyticsViewModel> {
  const globalStats = getGlobalStats();
  const cycleAgencies = getCycleAgencyCounts();
  const insights = getAnalyticsInsights();
  const yoy = getYoYGrowthData();
  const vendorShare = getVendorMarketShare();
  const heatmap = getProductAgencyMatrix(15, 20);
  const scatter = getMaturityScatterData();
  const architecture = getArchitectureDistribution();
  const llmVendors = getLLMVendorShare();
  const curatedVendorFlags = getCuratedVendorFlagShare();
  const llmVisibilityGap = getLLMVendorVisibilityByAgency();
  const coding = getCodingToolAgencies();
  const enterpriseLLM = getEnterpriseLLMAgencies();
  const entryMix = getEntryTypeMixByAgency();

  const { codingRows, enterpriseLLMRows } = buildAnalyticsLeaderboards({
    coding,
    enterpriseLLM,
  });
  const llmVendorTotal = sumCounts(llmVendors);

  return {
    globalStats,
    cycleAgencies,
    insights,
    yoy,
    vendorShare,
    heatmap,
    scatter,
    architecture,
    llmVendors,
    curatedVendorFlags,
    llmVisibilityGap,
    entryMix,
    codingRows,
    enterpriseLLMRows,
    llmVendorTotal,
  };
}
