/**
 * View-model for /readiness.
 *
 * Wraps the three primary readiness queries (ranked agencies, tier
 * summary, headline stats) and adapts the three "sub-story" extras
 * (vendor concentration, frontier penetration, reporting completeness)
 * into the row shapes the page renders.
 *
 * v1.2: headline stats are a pure read of the ETL-persisted
 * `readiness_headline` table (see lib/readiness getHeadlineStats). The
 * sub-story extras are still loaded defensively — they query base tables
 * that always exist, but on an older DB snapshot we degrade to empty
 * sections rather than crash the page.
 *
 * Tier banding (the leading / progressing / early / minimal split) is
 * computed in `getReadinessTierSummary`; we only forward it. The page
 * rounds the headline percentages, so we round them here once.
 */
import {
  getAgencyReadinessRanked,
  getFrontierPenetration,
  getHeadlineStats,
  getReadinessTierSummary,
  getReportingCompleteness,
  getVendorConcentration,
} from "@/lib/readiness";
import { getAiAccessSummary } from "@/lib/db";
import type { AiAccessSummary } from "@/lib/types";

interface VendorConcentrationRow {
  vendor: string;
  use_case_count: number;
  agency_count: number;
  /** Share of vendor-attributed use cases, as a 0..100 percentage. */
  share_of_attributed_pct: number;
  /** Share of ALL use cases, as a 0..100 percentage. */
  share_of_all_pct: number;
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

  try {
    const vc = getVendorConcentration();
    vendors = vc.top_vendors.map((v) => ({
      vendor: v.vendor,
      use_case_count: v.use_case_count,
      agency_count: v.agency_count,
      share_of_attributed_pct: v.share_of_attributed * 100,
      share_of_all_pct: v.share_of_all_ucs * 100,
    }));
    // HHI on the 0-10000 antitrust scale for inline display.
    vendorHerfindahl = Math.round(vc.herfindahl_index * 10000);

    const fp = getFrontierPenetration();
    frontier = fp.top_agencies.map((r) => ({
      agency_abbreviation: r.agency_abbreviation,
      agency_name: r.agency_name,
      frontier_use_case_count: r.frontier_count,
      total_use_case_count: r.total_count,
      pct_frontier: r.frontier_pct * 100,
    }));

    const rc = getReportingCompleteness();
    reporting = rc.map((r) => ({
      agency_abbreviation: r.agency_abbreviation,
      agency_name: r.agency_name,
      completion_rate_pct: r.overall_completeness * 100,
      fields_evaluated: Object.keys(r.per_field).length,
    }));
  } catch {
    // Defensive — the extras may throw at runtime if they query a not-yet-
    // built table on an older snapshot; degrade to empty sections rather
    // than crash the page.
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
  rubricVersion: string;
  /** @deprecated use fedrampLinkedPct — kept for existing callers. */
  fedrampPct: number;
  fedrampLinkedPct: number;
  fedrampFloorPct: number;
  fedrampLinkRowCount: number;
  internalBuildPct: number;
  purchasedPct: number;
  unreportedPct: number;
  productionPct: number;
  productionAllPct: number;
  complianceGapPct: number;
  complianceGapHighImpactPct: number;
  totalUnits: number;
  totalUseCases: number;
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
    rubricVersion: headline.rubric_version,
    fedrampPct: Math.round(headline.fedramp_linked_pct),
    fedrampLinkedPct: Math.round(headline.fedramp_linked_pct),
    // One decimal everywhere it's shown (home, here, the methodology page) so
    // readers never see two values for one statistic.
    fedrampFloorPct: Number(headline.fedramp_floor_pct.toFixed(1)),
    fedrampLinkRowCount: headline.fedramp_link_row_count,
    internalBuildPct: Number(headline.internal_build_pct.toFixed(1)),
    purchasedPct: Number(headline.purchased_pct.toFixed(1)),
    unreportedPct: Number(headline.unreported_pct.toFixed(1)),
    productionPct: Math.round(headline.production_rate_pct),
    productionAllPct: headline.production_rate_all_pct,
    complianceGapPct: Math.round(headline.hi_no_risk_docs_pct),
    complianceGapHighImpactPct: Math.round(
      headline.hi_no_risk_docs_high_impact_pct,
    ),
    totalUnits: headline.total_units,
    totalUseCases: headline.total_use_cases,
    aiAccess,
  };
}
