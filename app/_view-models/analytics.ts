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
  { num: "08", id: "coding", title: "Coding tool adoption", section: "Reach" },
  { num: "09", id: "enterprise-llm", title: "Enterprise LLM access", section: "Reach" },
  { num: "10", id: "entry-mix", title: "Entry-type mix", section: "Adoption" },
];

export function buildAnalyticsLeaderboards({
  coding,
  enterpriseLLM,
}: {
  coding: Array<{
    agency_id: number;
    abbreviation: string;
    name: string;
    coding_tool_count: number;
  }>;
  enterpriseLLM: Array<{
    agency_id: number;
    abbreviation: string;
    name: string;
    general_llm_count: number;
    has_enterprise_llm: number | null;
  }>;
}) {
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

export function sumCounts(rows: Array<{ count: number }>): number {
  return rows.reduce((acc, row) => acc + row.count, 0);
}
