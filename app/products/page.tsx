import { Suspense } from "react";
import Link from "next/link";
import { ProductsFilters } from "@/components/product/products-filters";
import { VendorShareChart } from "@/components/charts/vendor-share-chart";
import { CategoryDistributionChart } from "@/components/charts/category-distribution-chart";
import { Section, Figure } from "@/components/editorial";
import { PageMasthead } from "@/components/page-masthead";
import { StatTile } from "@/components/stat-tile";
import { PageSubnav } from "@/components/page-subnav";
import { formatNumber } from "@/lib/formatting";
import { buildUseCasesUrl } from "@/lib/urls";
import { buildProductsViewModel } from "./_view-model";
import { FrontierPenetrationTable } from "./_sections/frontier-penetration-table";

export const metadata = {
  title: "Products — Federal AI Use Case Inventory 2025",
  description:
    "Browse the commercial AI products reported by federal agencies, with vendor market share and per-product adoption.",
};

export default async function ProductsPage() {
  const {
    products,
    catalogStats,
    parentNames,
    vendorShare,
    categoryDistribution,
    frontierPenetration,
    totalAgencyMentions,
    frontierCount,
  } = await buildProductsViewModel();

  return (
    <>
      <PageSubnav
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "vendors", label: "Vendors" },
          { id: "categories", label: "Categories" },
          { id: "penetration", label: "Penetration" },
          { id: "catalogue", label: "Catalogue" },
        ]}
      />
      <div className="mx-auto w-full max-w-[1400px] px-4 py-14 md:px-8 md:py-20">
      {/* ------------------------------------------------------------ */}
      {/* HERO — editorial nameplate                                   */}
      {/* ------------------------------------------------------------ */}
      <PageMasthead
        id="overview"
        kicker="No. 002 · Catalogue"
        metaLines={["Commercial Inventory", "Vendor × Product × Agency"]}
        meta={
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
        }
        italicTitle={false}
        title={
          <>
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
          </>
        }
        lede={
          <>
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
          </>
        }
        actions={
          <div>
            <div className="eyebrow mb-4">By the numbers</div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
              <StatTile
                label="Products"
                value={products.length}
                href="/products"
              />
              <StatTile
                label="Vendors"
                value={catalogStats.distinct_vendors}
              />
              <StatTile
                label="Agency × product"
                value={totalAgencyMentions}
                href={buildUseCasesUrl({})}
              />
              <StatTile
                label="Attributions"
                value={catalogStats.linked_entry_product_edges}
                href={buildUseCasesUrl({})}
              />
            </div>
            <Link
              href="#catalogue"
              className="mt-6 inline-flex items-baseline gap-1 border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-foreground transition-colors hover:border-foreground hover:text-[var(--stamp)]"
            >
              Jump to catalogue ↓
            </Link>
          </div>
        }
      />

      {/* ------------------------------------------------------------ */}
      {/* § I — VENDOR MARKET SHARE                                    */}
      {/* ------------------------------------------------------------ */}
      <div id="vendors" className="scroll-mt-36">
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
      <div id="categories" className="scroll-mt-36">
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
      {/* § III — FRONTIER PENETRATION                                 */}
      {/* ------------------------------------------------------------ */}
      <div id="penetration" className="scroll-mt-36">
      <Section
        number="III"
        title="Frontier reach"
        source="derived"
        lede="How far the marquee frontier LLM products actually spread across agencies — and how much of that footprint is live versus still in pilot or pre-deployment."
      >
        <Figure
          eyebrow="Fig. 3 · Frontier-product penetration"
          caption={
            <>
              An explicit allow-list of ten frontier products (not{" "}
              <span className="text-foreground">products.is_frontier_llm</span>).
              Agencies and attributions count both individual and consolidated
              entries via{" "}
              <span className="text-foreground">entry_product_edges</span>; the
              stage mix reads{" "}
              <span className="text-foreground">use_cases.stage_normalized</span>{" "}
              over individual entries only — consolidated entries carry no stage,
              so they are excluded from the mix. These are{" "}
              <span className="text-foreground">floors, not totals</span>: only
              about 35% of use cases name a linkable product, so unnamed
              deployments are invisible here.
            </>
          }
        >
          <FrontierPenetrationTable rows={frontierPenetration} />
        </Figure>
      </Section>
      </div>

      {/* ------------------------------------------------------------ */}
      {/* § IV — CATALOGUE                                             */}
      {/* ------------------------------------------------------------ */}
      <div id="catalogue" className="scroll-mt-36">
      <Section
        number="IV"
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
    </>
  );
}
