/**
 * View-model for /products.
 *
 * Bundles the five DB calls the product catalogue page makes (catalogue,
 * stats, parent-name lookup, vendor share, category distribution) and
 * derives the headline aggregates (total agency × product mentions, count
 * of frontier-LLM products) used in the hero/footer.
 */
import {
  getAllProducts,
  getCategoryDistribution,
  getOrphanProductCount,
  getProductCatalogStats,
  getProductNamesById,
  getVendorMarketShare,
} from "@/lib/db";

type AllProducts = ReturnType<typeof getAllProducts>;
type CatalogStats = ReturnType<typeof getProductCatalogStats>;
type ParentNames = ReturnType<typeof getProductNamesById>;
type VendorShare = ReturnType<typeof getVendorMarketShare>;
type CategoryDistribution = ReturnType<typeof getCategoryDistribution>;

export interface ProductsViewModel {
  products: AllProducts;
  catalogStats: CatalogStats;
  parentNames: ParentNames;
  vendorShare: VendorShare;
  categoryDistribution: CategoryDistribution;
  totalAgencyMentions: number;
  frontierCount: number;
  orphanCount: number;
  includeOrphans: boolean;
}

export async function buildProductsViewModel(
  opts: { includeOrphans?: boolean } = {},
): Promise<ProductsViewModel> {
  const includeOrphans = opts.includeOrphans ?? false;
  const products = getAllProducts({ includeOrphans });
  const catalogStats = getProductCatalogStats();
  const parentNames = getProductNamesById();
  const vendorShare = getVendorMarketShare();
  const categoryDistribution = getCategoryDistribution();
  const orphanCount = getOrphanProductCount();

  const totalAgencyMentions = products.reduce(
    (acc, p) => acc + (p.agency_count ?? 0),
    0,
  );
  const frontierCount = products.filter((p) => p.is_frontier_llm === 1).length;

  return {
    products,
    catalogStats,
    parentNames,
    vendorShare,
    categoryDistribution,
    totalAgencyMentions,
    frontierCount,
    orphanCount,
    includeOrphans,
  };
}
