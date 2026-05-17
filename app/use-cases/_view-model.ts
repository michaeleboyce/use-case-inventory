/**
 * View-model for /use-cases.
 *
 * Server-side data shaping for the use-case explorer:
 *  - parses search-param-derived filter input,
 *  - fans out the four DB queries (filtered rows, agency / product options,
 *    facets, global stats) in parallel,
 *  - derives pagination + total-in-db numbers used by the editorial header
 *    and toolbar.
 *
 * The page hands it a pre-parsed `filters` object (so URL parsing stays in
 * the page where Next's `searchParams` lives). Keep all DB shape in here.
 */
import {
  getAgencyOptions,
  getProductOptions,
  getUseCaseFacets,
  getUseCasesFiltered,
  getGlobalStats,
} from "@/lib/db";
import type { UseCaseFilterInput } from "@/lib/types";

export const USE_CASES_PAGE_SIZE = 100;

export type UseCasesFilters = UseCaseFilterInput & { page: number };

type FilteredResult = ReturnType<typeof getUseCasesFiltered>;
type AgencyOption = ReturnType<typeof getAgencyOptions>[number];
type ProductOption = ReturnType<typeof getProductOptions>[number];
type FacetBucket = ReturnType<typeof getUseCaseFacets>;
type GlobalStats = ReturnType<typeof getGlobalStats>;

export interface UseCasesViewModel {
  rows: FilteredResult["rows"];
  total: number;
  totalInDb: number;
  page: number;
  totalPages: number;
  firstRow: number;
  lastRow: number;
  agencies: AgencyOption[];
  products: ProductOption[];
  facets: FacetBucket;
  stats: GlobalStats;
}

export async function buildUseCasesViewModel(
  filters: UseCasesFilters,
): Promise<UseCasesViewModel> {
  const page = filters.page;
  const [{ rows, total }, agencies, products, facets, stats] = await Promise.all([
    Promise.resolve(getUseCasesFiltered(filters)),
    Promise.resolve(getAgencyOptions()),
    Promise.resolve(getProductOptions()),
    Promise.resolve(getUseCaseFacets()),
    Promise.resolve(getGlobalStats()),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / USE_CASES_PAGE_SIZE));
  const firstRow = total === 0 ? 0 : (page - 1) * USE_CASES_PAGE_SIZE + 1;
  const lastRow = Math.min(total, page * USE_CASES_PAGE_SIZE);
  const totalInDb = stats.total_use_cases + stats.total_consolidated;

  return {
    rows,
    total,
    totalInDb,
    page,
    totalPages,
    firstRow,
    lastRow,
    agencies,
    products,
    facets,
    stats,
  };
}
