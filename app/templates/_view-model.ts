/**
 * View-model for /templates.
 *
 * Wraps the single `getAllTemplates` query and computes the per-category
 * roll-up (capability_category sums of use_case_count) plus headline
 * totals (entries, OMB-standard count, distinct categories) that the
 * page header / chart consume.
 */
import { getAllTemplates } from "@/lib/db";

type AllTemplates = ReturnType<typeof getAllTemplates>;

export interface TemplatesViewModel {
  templates: AllTemplates;
  chartData: Array<{ category: string; use_case_count: number }>;
  totalEntries: number;
  ombStandard: number;
  distinctCategories: number;
}

export async function buildTemplatesViewModel(): Promise<TemplatesViewModel> {
  const templates = getAllTemplates();

  // Aggregate usage by capability_category for the bar chart.
  // capability_category is an IFP-curated grouping of OMB Appendix B
  // templates (writing, coding, security, etc.). Templates without a
  // category fall into a single "other" bucket on the chart.
  const byCategory = new Map<string, number>();
  for (const t of templates) {
    const cat = t.capability_category ?? "other";
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + t.use_case_count);
  }
  const chartData = Array.from(byCategory.entries())
    .map(([category, use_case_count]) => ({ category, use_case_count }))
    .sort((a, b) => b.use_case_count - a.use_case_count);

  const totalEntries = templates.reduce((a, t) => a + t.use_case_count, 0);
  const ombStandard = templates.filter((t) => t.is_omb_standard === 1).length;
  const distinctCategories = byCategory.size;

  return {
    templates,
    chartData,
    totalEntries,
    ombStandard,
    distinctCategories,
  };
}
