/**
 * View-model for /readiness.
 *
 * Wraps the three primary readiness queries (ranked agencies, tier
 * summary, headline stats) and adapts the three "sub-story" extras
 * (vendor concentration, frontier penetration, reporting completeness)
 * into the row shapes the page renders. The sub-story extras are
 * still imported defensively because Agent C may not yet have landed
 * `getVendorConcentration` / `getFrontierPenetration` /
 * `getReportingCompleteness` in lib/readiness — degrade to empty
 * sections rather than crash.
 *
 * Tier banding (the leading / progressing / early / minimal split) is
 * computed in `getReadinessTierSummary`; we only forward it. The
 * page rounds the headline percentages, so we round them here once.
 */
import * as readinessLib from "@/lib/readiness";
import {
  getAgencyReadinessRanked,
  getHeadlineStats,
  getReadinessTierSummary,
} from "@/lib/readiness";
import { getAiAccessSummary } from "@/lib/db";
import type { AiAccessSummary } from "@/lib/types";

interface VendorConcentrationRow {
  vendor: string;
  use_case_count: number;
  agency_count: number;
  share_of_uc_pct: number;
}
interface FrontierPenetrationRow {
  agency_abbreviation: string;
  agency_name: string;
  frontier_use_case_count: number;
  total_use_case_count: number;
  pct_frontier: number;
}
interface ReportingCompletenessRow {
  agency_abbreviation: string;
  agency_name: string;
  completion_rate_pct: number;
  fields_evaluated: number;
}

interface ReadinessLibExtras {
  getVendorConcentration?: () => {
    top_vendors: Array<{
      vendor: string;
      use_case_count: number;
      agency_count: number;
      share_of_total: number;
    }>;
    herfindahl_index: number;
    top5_share: number;
  };
  getFrontierPenetration?: () => {
    federal_frontier_pct: number;
    top_agencies: Array<{
      agency_abbreviation: string;
      frontier_pct: number;
      frontier_count: number;
      total_count: number;
    }>;
  };
  getReportingCompleteness?: () => Array<{
    agency_abbreviation: string;
    overall_completeness: number;
    per_field: Record<string, number>;
  }>;
}

function loadSubStories(): {
  vendors: VendorConcentrationRow[];
  vendorHerfindahl: number | null;
  frontier: FrontierPenetrationRow[];
  reporting: ReportingCompletenessRow[];
} {
  let vendors: VendorConcentrationRow[] = [];
  let vendorHerfindahl: number | null = null;
  let frontier: FrontierPenetrationRow[] = [];
  let reporting: ReportingCompletenessRow[] = [];

  const extras = readinessLib as unknown as ReadinessLibExtras;
  try {
    if (typeof extras.getVendorConcentration === "function") {
      const vc = extras.getVendorConcentration();
      vendors = vc.top_vendors.map((v) => ({
        vendor: v.vendor,
        use_case_count: v.use_case_count,
        agency_count: v.agency_count,
        share_of_uc_pct: v.share_of_total * 100,
      }));
      // HHI on the 0-10000 antitrust scale for inline display.
      vendorHerfindahl = Math.round(vc.herfindahl_index * 10000);
    }
    if (typeof extras.getFrontierPenetration === "function") {
      const fp = extras.getFrontierPenetration();
      frontier = fp.top_agencies.map((r) => ({
        agency_abbreviation: r.agency_abbreviation,
        agency_name: r.agency_abbreviation,
        frontier_use_case_count: r.frontier_count,
        total_use_case_count: r.total_count,
        pct_frontier: r.frontier_pct * 100,
      }));
    }
    if (typeof extras.getReportingCompleteness === "function") {
      const rc = extras.getReportingCompleteness();
      reporting = rc.map((r) => ({
        agency_abbreviation: r.agency_abbreviation,
        agency_name: r.agency_abbreviation,
        completion_rate_pct: r.overall_completeness * 100,
        fields_evaluated: Object.keys(r.per_field).length,
      }));
    }
  } catch {
    // Defensive — extras may throw at runtime if they query a not-yet-built
    // table; degrade to empty sections rather than crash the page.
  }
  return { vendors, vendorHerfindahl, frontier, reporting };
}

type Ranked = ReturnType<typeof getAgencyReadinessRanked>;
type Tiers = ReturnType<typeof getReadinessTierSummary>;
type Headline = ReturnType<typeof getHeadlineStats>;

export interface ReadinessViewModel {
  ranked: Ranked;
  tiers: Tiers;
  headline: Headline;
  vendors: VendorConcentrationRow[];
  vendorHerfindahl: number | null;
  frontier: FrontierPenetrationRow[];
  reporting: ReportingCompletenessRow[];
  totalScored: number;
  fedrampPct: number;
  internalBuildPct: number;
  productionPct: number;
  complianceGapPct: number;
  /** Null if the agency_ai_access_evidence table is absent (degrades the
   *  teaser gracefully rather than crashing /readiness). */
  aiAccess: AiAccessSummary | null;
}

export async function buildReadinessViewModel(): Promise<ReadinessViewModel> {
  const ranked = getAgencyReadinessRanked();
  const tiers = getReadinessTierSummary();
  const headline = getHeadlineStats();
  const { vendors, vendorHerfindahl, frontier, reporting } = loadSubStories();

  let aiAccess: AiAccessSummary | null = null;
  try {
    aiAccess = getAiAccessSummary();
  } catch {
    // Table not present (e.g. older DB snapshot) — teaser is omitted.
    aiAccess = null;
  }

  return {
    ranked,
    tiers,
    headline,
    vendors,
    vendorHerfindahl,
    frontier,
    reporting,
    totalScored: headline.total_agencies_scored,
    fedrampPct: Math.round(headline.fedramp_coverage_pct),
    internalBuildPct: Math.round(headline.internal_build_pct),
    productionPct: Math.round(headline.production_rate_pct),
    complianceGapPct: Math.round(headline.hi_no_risk_docs_pct),
    aiAccess,
  };
}
