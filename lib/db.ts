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

import { rawDb } from "./db/shared/init";
import { STAGE_BUCKET_SQL } from "./db/shared/sql-fragments";

// Re-export so existing `import { rawDb, STAGE_BUCKET_SQL } from '@/lib/db'`
// callers keep working without changes.
export { rawDb, STAGE_BUCKET_SQL };

// Domain modules (per-domain split in progress; see virtual-sniffing-peacock.md).
export {
  getAllTemplates,
  getTemplateById,
  getEntriesForTemplate,
  type TemplateEntryRow,
} from "./db/templates";
export {
  getGlobalStats,
  getProductCatalogStats,
  getCommandPaletteIndex,
  type CommandPaletteIndex,
} from "./db/stats";
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
  type AgencyCompareData,
} from "./db/agencies";
export {
  getAllProducts,
  getProductById,
  getTopProducts,
  getProductsForAgency,
  getProductOptions,
  getChildProducts,
  getProductsByVendor,
  getProductNamesById,
} from "./db/products";
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
  getLLMVendorVisibilityByAgency,
  getEntryTypeMixByAgency,
  getAnalyticsInsights,
  getMaturityScatterData,
  getEnterpriseLLMAgencies,
  getCrossCutSummary,
  getCrossCutHeatmap,
  getCategoryTopicCrossTab,
  type CrossCutKey,
  type CrossCutValueRow,
  type CrossCutHeatmapCell,
  type CategoryTopicCrossTab,
} from "./db/analytics";
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
  type PeerUseCaseRow,
} from "./db/use-cases";
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
  getLinkQueueGroups,
  getLinkQueueRows,
} from "./db/fedramp";

// All query functions now live under ./db/<domain>.ts and are re-exported
// above. STAGE_BUCKET_SQL, DB_PATH, getDb(), and rawDb() live in
// ./db/shared/{init,sql-fragments}.ts. This barrel will be folded into
// ./db/index.ts (Phase 5 of the split) once all consumers have migrated
// to deep-importing — for now it preserves the @/lib/db import surface.

