/**
 * SQLite query layer for the Federal AI Use Case Inventory dashboard.
 *
 * All functions run on the server (Server Components) and return typed rows
 * that can be passed directly into React props. The database is opened once
 * in read-only mode and kept warm for the lifetime of the Node process.
 *
 * Usage (in a Server Component):
 *
 *   import { getGlobalStats, getAgencies } from '@/lib/db';
 *   const stats = getGlobalStats();
 *
 * Constraints:
 *   - Every query uses a prepared statement (SQL is static; parameters are bound).
 *   - No function returns `any` — see `@/lib/types` for the row shapes.
 *   - Callers must not mutate the returned objects (better-sqlite3 gives plain
 *     objects, but they should be treated as read-only view-models).
 */

import { rawDb } from "./shared/init";
import { STAGE_BUCKET_SQL } from "./shared/sql-fragments";

// Re-export so existing `import { rawDb, STAGE_BUCKET_SQL } from '@/lib/db'`
// callers keep working without changes.
export { rawDb, STAGE_BUCKET_SQL };

// Domain modules. Keep this barrel stable so route code can import from @/lib/db.
export {
  getAllTemplates,
  getTemplateById,
  getEntriesForTemplate,
  type TemplateEntryRow,
} from "./templates";
export {
  getGlobalStats,
  getProductCatalogStats,
  getCommandPaletteIndex,
} from "./stats";
export {
  getAgencies,
  getAllAgenciesIncludingEmpty,
  getAgencyByAbbr,
  getAgencyById,
  getAgencyMaturity,
  getRecentlyModifiedAgencies,
  getAgencyOptions,
  getAgencyInventoryLinks,
  getAgencyCompareData,
} from "./agencies";
export {
  getAgencyAiAccessEvidence,
  getAiAccessSummary,
  getAgencyAccessTiers,
  type AgencyAccessTier,
} from "./agency-ai-access";
export {
  getAllProducts,
  getProductById,
  getTopProducts,
  getProductsForAgency,
  getProductOptions,
  getChildProducts,
  getProductsByVendor,
  getProductNamesById,
} from "./products";
export {
  getBureauBreakdown,
  getEntryTypeBreakdown,
  getAISophisticationBreakdown,
  getDeploymentScopeBreakdown,
  getCategoryDistributionForAgency,
  getYoYGrowthData,
  getVendorMarketShare,
  getCategoryDistribution,
  getProductAgencyHeatmap,
  getCodingToolAgencies,
  getMaturityTierSummary,
  getAgencyTypeByTier,
  getProductAgencyMatrix,
  getArchitectureDistribution,
  getLLMVendorShare,
  getCuratedVendorFlagShare,
  getLLMVendorVisibilityByAgency,
  getEntryTypeMixByAgency,
  getAnalyticsInsights,
  getMaturityScatterData,
  getEnterpriseLLMAgencies,
  getCrossCutSummary,
  getCrossCutHeatmap,
  getCategoryTopicCrossTab,
} from "./analytics";
export {
  getUseCasesForAgency,
  getUseCasesForOrgSubtree,
  getUseCaseBySlug,
  getUseCaseById,
  getUseCasesFiltered,
  getConsolidatedForAgency,
  getProductsForUseCase,
  getProductsForConsolidatedUseCase,
  getConsolidatedBySlug,
  getUseCaseOrConsolidatedBySlug,
  getRelatedByAgency,
  getRelatedByProduct,
  getRelatedByTemplate,
  getUseCaseFacets,
  getUseCasesForProduct,
  getConsolidatedCountForProduct,
  getLastUpdatedDate,
  getExternalEvidenceForUseCase,
  getExternalEvidenceForConsolidated,
  getPeerUseCases,
} from "./use-cases";
export {
  getFedrampProducts,
  getFedrampProductById,
  getFedrampProductsByVendor,
  getFedrampCsps,
  getFedrampCspBySlug,
  getFedrampProductsByCsp,
  getFedrampAgencies,
  getFedrampAgencyByAbbr,
  getFedrampAssessors,
  getFedrampProductsByAssessor,
  getFedrampAuthorizationsForProduct,
  getFedrampAuthorizationsForProducts,
  getFedrampAuthorizationsForAgency,
  getFedrampSnapshot,
  getFedrampLinksForInventoryProduct,
  getInventoryProductsForFedrampProduct,
  getFedrampProductBusinessFunctions,
  getFedrampProductServiceModels,
  getDistinctBusinessFunctions,
  getDistinctServiceModels,
  getLeveragedSystemsForFedrampProduct,
  getProductsLeveragedBy,
  getAgencyAtoScope,
  getUseCaseFedrampCoverage,
  getCoverageHubStats,
  getCoverageVendorRows,
  getCoverageFitGrid,
  getCoverageAgencyRows,
  getCoverageAgencyDrill,
  getCoverageUnusedProducts,
  getUseCasesForCoverageProduct,
  getAgenciesWithoutUseForFedrampProduct,
  getSleepingAuthorizationsCounts,
  getSleepingAuthorizationRows,
  getSleepingAuthorizationDetail,
  getSleepingByImpactLevel,
  getTopSleepingAgencies,
  getUseCasesForFitCell,
  getUseCasesForCoverageAgencyProduct,
  getLinkQueueGroups,
  getLinkQueueRows,
  hasAiClassification,
  getAiClassificationFor,
  getAiClassificationMap,
  getAiClassificationCounts,
  getAiClassificationByImpactLevel,
  getUnlinkedAiProducts,
  getAgenciesHoldingAto,
  getUnlinkedAiByAgency,
  getUnlinkedAiProductsForAgency,
  getAuthorizedCoreAiSpread,
  getSpreadCounts,
  getFrontierTrioStatus,
  hasServiceClassification,
  getAiServicesInScope,
  getAiServiceShelfCounts,
  getServicesInScopeForProduct,
  getAiServicesInReachForAgency,
  getFrontierReachByAgency,
  hasSleepingServices,
  bucketTiming,
  getSleepingServicePairs,
  getSleepingServicesForAgency,
  getAgencyReportedCategories,
  SLEEPING_INVENTORY_CUTOFF,
} from "./fedramp";
export {
  getGenAiHeadlines,
  getOmbIfpCrosstab,
  getGenAiTimeline,
  getGenAiEarlyTail,
  getAgencyGenAiCounts,
  getSeatExtrapolationByAgency,
  getAgencyToolMatrix,
  getCapabilityLadder,
  getYearCompareGenAi,
  getYearCompareGenAiByAgency,
  getEnterpriseTierRollup,
  GENAI_DEFINITIONS,
  GENAI_DEFINITION_LABELS,
  GENAI_DEFINITION_SHORT,
  GENAI_DEFINITION_SOURCE,
  MATRIX_PRODUCT_BUCKETS,
  getStratifiedSeatInputs,
  getAgencyOccupationCaps,
  computeAgencySeatModel,
  computeSeatModel,
  buildProvenance,
  buildWaterfall,
} from "./experience";
export type {
  GenAiDefinition,
  GenAiHeadline,
  OmbIfpCrosstab,
  GenAiTimelinePoint,
  AgencyGenAiRow,
  SeatExtrapolationRow,
  AgencyToolMatrixRow,
  MatrixCell,
  MatrixProductKey,
  YearCompareGenAi,
  AgencyYearCompareGenAiRow,
  CapabilityLadderData,
  EnterpriseTierRollupRow,
  LabeledBandRow,
  OccupationCapRow,
  SeatModelSourceData,
  ProvenanceRollup,
} from "./experience";
export {
  getYearComparisonAggregates,
  getCycleAgencyCounts,
  getLineageBreakdown,
  getPerAgencyLineage,
  getRetiredBreakdown,
  getLineageSamples,
  getSilentlyDroppedSummary,
  getSilentlyDroppedByStage,
  getSilentlyDroppedByAgency,
  getSilentlyDroppedRows,
  getSilentlyDroppedGenAiRows,
  getTags2024Headlines,
} from "./year-comparison";

// Most query implementations live under ./db/<domain>/ or ./db/<domain>.ts and
// are re-exported above. STAGE_BUCKET_SQL, DB_PATH, getDb(), and rawDb() live
// in ./db/shared/{init,sql-fragments}.ts.
