import { Suspense } from "react";
import Link from "next/link";
import {
  getAllProducts,
  getCategoryDistribution,
  getProductCatalogStats,
  getProductNamesById,
  getVendorMarketShare,
} from "@/lib/db";
import { ProductsFilters } from "@/components/products-filters";
import { VendorShareChart } from "@/components/charts/vendor-share-chart";
import { CategoryDistributionChart } from "@/components/charts/category-distribution-chart";
import { Section, Figure } from "@/components/editorial";
import { PageSubnav } from "@/components/page-subnav";
import { formatNumber } from "@/lib/formatting";
import { buildUseCasesUrl } from "@/lib/urls";

export const metadata = {
  title: "Products — Federal AI Use Case Inventory 2025",
  description:
    "Browse the commercial AI products reported by federal agencies, with vendor market share and per-product adoption.",
};

export default function ProductsPage() {
  const products = getAllProducts();
  const catalogStats = getProductCatalogStats();
  const parentNames = getProductNamesById();
  const vendorShare = getVendorMarketShare();
  const categoryDistribution = getCategoryDistribution();

  const totalAgencyMentions = products.reduce(
    (acc, p) => acc + (p.agency_count ?? 0),
    0,
  );
  const frontierCount = products.filter((p) => p.is_frontier_llm === 1).length;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-14 md:px-8 md:py-20">
      <PageSubnav
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "vendors", label: "Vendors" },
          { id: "categories", label: "Categories" },
          { id: "catalogue", label: "Catalogue" },
        ]}
      />
      {/* ------------------------------------------------------------ */}
      {/* HERO — editorial nameplate                                   */}
      {/* ------------------------------------------------------------ */}
      <header
        id="overview"
        className="ink-in grid scroll-mt-32 grid-cols-12 gap-x-6 border-b border-border pb-12 md:pb-16"
      >
        <aside className="col-span-12 mb-8 md:col-span-3 md:mb-0">
          <div className="sticky top-32 space-y-4">
            <div>
              <div className="eyebrow mb-1.5 !text-[var(--stamp)]">
                No. 002 · Catalogue
              </div>
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Commercial Inventory
              </div>
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Vendor × Product × Agency
              </div>
            </div>

            <div className="hidden space-y-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground md:block">
              <div className="border-t border-border pt-3">
                <div className="mb-0.5 text-[9px] text-muted-foreground/70">
                  Canonical
                </div>
                <Link
                  href="/products"
                  className="text-foreground transition-colors hover:text-[var(--stamp)]"
                >
                  {formatNumber(products.length)} products
                </Link>
              </div>
              <div>
                <div className="mb-0.5 text-[9px] text-muted-foreground/70">
                  Vendors
                </div>
                <div className="text-foreground">
                  {formatNumber(catalogStats.distinct_vendors)}
                </div>
              </div>
              <div>
                <div className="mb-0.5 text-[9px] text-muted-foreground/70">
                  Linked attributions
                </div>
                <div className="text-foreground">
                  {formatNumber(catalogStats.linked_entry_product_edges)}
                </div>
              </div>
              <div>
                <div className="mb-0.5 text-[9px] text-muted-foreground/70">
                  Frontier LLMs
                </div>
                <div className="text-foreground">
                  {formatNumber(frontierCount)}
                </div>
              </div>
            </div>
          </div>
        </aside>

        <div className="col-span-12 md:col-span-9">
          <h1 className="font-display text-[clamp(2.6rem,7vw,6rem)] leading-[0.95] tracking-[-0.03em] text-foreground">
            All AI{" "}
            <em className="inline font-normal italic">products</em>{" "}
            across
            <br />
            American government,
            <br />
            <span className="relative inline-block">
              <span
                aria-hidden
                className="absolute inset-x-[-0.08em] bottom-[0.16em] h-[0.38em] bg-[var(--highlight)]/90"
              />
              <span className="relative">normalised&nbsp;and&nbsp;deduped.</span>
            </span>
          </h1>

          <div className="mt-10 grid grid-cols-12 gap-x-6 gap-y-6">
            <p className="col-span-12 max-w-prose text-[1.05rem] leading-[1.55] text-foreground/85 md:col-span-7">
              <span className="float-left mr-2 font-display italic text-[3.6rem] leading-[0.82] text-foreground">
                F
              </span>
              ederal agencies name the commercial tools they run in hundreds of
              slightly different ways — &ldquo;M365 Copilot,&rdquo;
              &ldquo;Microsoft 365 Copilot,&rdquo; &ldquo;Copilot for M365.&rdquo;
              This catalogue tracks{" "}
              <span className="font-medium text-foreground">
                {formatNumber(catalogStats.linked_entry_product_edges)} product
                attributions
              </span>{" "}
              across {formatNumber(catalogStats.linked_entries)} inventory
              entries and {formatNumber(products.length)} canonical products.
              Agency-internal platforms are labeled separately from commercial
              tools, and {formatNumber(catalogStats.pending_product_reviews)}
              rows remain in the product review queue. Filter below by vendor
              or by{" "}
              <span
                title="IFP-curated category (general_llm, security_tool, productivity, etc.). Distinct from OMB's ai_classification field, which is recorded per use case."
                className="cursor-help underline decoration-dotted underline-offset-2"
              >
                category
              </span>
              ; click any card to open agency-level adoption.
            </p>

            <div className="col-span-12 md:col-span-4 md:col-start-9 md:self-end">
              <div className="editorial-rule-left space-y-3">
                <div className="eyebrow">By the numbers</div>
                <dl className="space-y-2 font-mono text-sm">
                  <Link
                    href="/products"
                    className="flex items-baseline justify-between gap-3 border-b border-dotted border-border pb-1.5 transition-colors hover:text-[var(--stamp)]"
                  >
                    <dt className="text-muted-foreground">Products</dt>
                    <dd className="tabular-nums text-foreground transition-colors hover:text-[var(--stamp)]">
                      {formatNumber(products.length)}
                    </dd>
                  </Link>
                  <div className="flex items-baseline justify-between gap-3 border-b border-dotted border-border pb-1.5">
                    <dt className="text-muted-foreground">Vendors</dt>
                    <dd className="tabular-nums text-foreground">
                      {formatNumber(catalogStats.distinct_vendors)}
                    </dd>
                  </div>
                  <Link
                    href={buildUseCasesUrl({})}
                    className="flex items-baseline justify-between gap-3 border-b border-dotted border-border pb-1.5 transition-colors hover:text-[var(--stamp)]"
                  >
                    <dt className="text-muted-foreground">
                      Agency × product
                    </dt>
                    <dd className="tabular-nums text-foreground transition-colors hover:text-[var(--stamp)]">
                      {formatNumber(totalAgencyMentions)}
                    </dd>
                  </Link>
                  <Link
                    href={buildUseCasesUrl({})}
                    className="flex items-baseline justify-between gap-3 transition-colors hover:text-[var(--stamp)]"
                  >
                    <dt className="text-muted-foreground">Attributions</dt>
                    <dd className="tabular-nums text-foreground transition-colors hover:text-[var(--stamp)]">
                      {formatNumber(catalogStats.linked_entry_product_edges)}
                    </dd>
                  </Link>
                </dl>
                <Link
                  href="#catalogue"
                  className="mt-4 inline-flex items-baseline gap-1 border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-foreground transition-colors hover:border-foreground hover:text-[var(--stamp)]"
                >
                  Jump to catalogue ↓
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------ */}
      {/* § I — VENDOR MARKET SHARE                                    */}
      {/* ------------------------------------------------------------ */}
      <div id="vendors" className="scroll-mt-32">
      <Section
        number="I"
        title="Who sells"
        lede="The vendors named most often, ranked twice: by distinct agencies and by total entries."
      >
        <Figure
          eyebrow="Fig. 1 · Vendor market share"
          caption={
            <>
              Source: <span className="text-foreground">products</span> joined
              with <span className="text-foreground">use_cases</span>; top 12
              vendors per metric.
            </>
          }
        >
          <VendorShareChart data={vendorShare} />
        </Figure>
      </Section>
      </div>

      {/* ------------------------------------------------------------ */}
      {/* § II — CATEGORY DISTRIBUTION                                 */}
      {/* ------------------------------------------------------------ */}
      <div id="categories" className="scroll-mt-32">
      <Section
        number="II"
        title="By category"
        lede="The same products grouped by IFP-curated category — distinct from OMB's ai_classification field, which lives on individual use cases."
      >
        <Figure
          eyebrow="Fig. 2 · Category distribution"
          caption={
            <>
              Source: <span className="text-foreground">products</span>.
              <span className="text-foreground">product_type</span> joined
              with <span className="text-foreground">use_case_products</span>;
              top 14 categories per metric. Bars link to{" "}
              <span className="text-foreground">/products?category=X</span>.
              See{" "}
              <Link
                href="/browse/category"
                className="text-foreground underline decoration-dotted underline-offset-2 hover:text-[var(--stamp)]"
              >
                /browse/category
              </Link>{" "}
              for the agency × category heatmap.
            </>
          }
        >
          <CategoryDistributionChart data={categoryDistribution} />
        </Figure>
      </Section>
      </div>

      {/* ------------------------------------------------------------ */}
      {/* § III — CATALOGUE                                            */}
      {/* ------------------------------------------------------------ */}
      <div id="catalogue" className="scroll-mt-32">
      <Section
        number="III"
        title="The catalogue"
        lede="Every canonical product, searchable by name, vendor, type, and capability."
      >
        {/* Suspense boundary required because ProductsFilters reads
            useSearchParams() (for `?category=X` deep linking) and this
            page is statically prerendered. Without it, Next bails on
            client-side rendering for the whole page. */}
        <Suspense fallback={null}>
          <ProductsFilters products={products} parentNames={parentNames} />
        </Suspense>
      </Section>
      </div>

      {/* ------------------------------------------------------------ */}
      {/* Footer caption                                               */}
      {/* ------------------------------------------------------------ */}
      <footer className="mt-20 border-t-2 border-foreground pt-4 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <span>
            Filed · Federal AI Use Case Inventory ·{" "}
            <span className="text-foreground">2025 cycle</span>
          </span>
          <span>
            {formatNumber(products.length)} products ·{" "}
            {formatNumber(catalogStats.distinct_vendors)} vendors
          </span>
        </div>
      </footer>
    </div>
  );
}
