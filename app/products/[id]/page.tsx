import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAllProducts,
  getChildProducts,
  getConsolidatedCountForProduct,
  getFedrampAuthorizationsForProducts,
  getFedrampLinksForInventoryProduct,
  getProductById,
  getProductsByVendor,
  getUseCasesForProduct,
} from "@/lib/db";
import { ProductCard } from "@/components/product-card";
import { BackLink } from "@/components/back-link";
import { Section, MonoChip, Eyebrow, SourceLegend } from "@/components/editorial";
import { Badge } from "@/components/ui/badge";
import { FedrampCoverageBadge } from "@/components/FedrampCoverageBadge";
import { formatNumber, humanize, truncate } from "@/lib/formatting";
import {
  agencyUseCasesUrl,
  buildUseCasesUrl,
  productUseCasesUrl,
} from "@/lib/urls";

type ProductPageProps = { params: Promise<{ id: string }> };

export async function generateMetadata(props: ProductPageProps) {
  const { id } = await props.params;
  const idNum = Number(id);
  if (!Number.isFinite(idNum)) return { title: "Product — not found" };
  const product = getProductById(idNum);
  if (!product) return { title: "Product — not found" };
  return {
    title: `${product.canonical_name} — Federal AI Inventory`,
    description: product.description ?? undefined,
  };
}

export default async function ProductDetailPage(props: ProductPageProps) {
  const { id } = await props.params;
  const idNum = Number(id);
  if (!Number.isFinite(idNum)) notFound();

  const product = getProductById(idNum);
  if (!product) notFound();

  const useCases = getUseCasesForProduct(idNum);
  const consolidatedCount = getConsolidatedCountForProduct(idNum);
  const children = getChildProducts(idNum);

  let parent: { id: number; canonical_name: string } | null = null;
  if (product.parent_product_id != null) {
    const p = getProductById(product.parent_product_id);
    if (p) parent = { id: p.id, canonical_name: p.canonical_name };
  }

  const related = product.vendor
    ? getProductsByVendor(product.vendor, product.id).slice(0, 8)
    : [];

  const fedrampLinks = getFedrampLinksForInventoryProduct(product.id);
  // Batched lookup avoids the N+1 (one query for all linked FedRAMP products
  // instead of one-per-link). Shape is identical to the per-product helper.
  const authsByFedrampId = getFedrampAuthorizationsForProducts(
    fedrampLinks.map((fp) => fp.fedramp_id),
  );
  const fedrampAuthsByProduct = fedrampLinks.map((fp) => ({
    product: fp,
    authorizations: authsByFedrampId.get(fp.fedramp_id) ?? [],
  }));

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-10 md:px-8 md:py-14">
      {/* Breadcrumb */}
      <nav className="mb-6">
        <BackLink fallbackHref="/products" fallbackLabel="All products" />
      </nav>

      {/* ------------------------------------------------------------ */}
      {/* HERO                                                         */}
      {/* ------------------------------------------------------------ */}
      <header className="ink-in grid grid-cols-12 gap-x-6 border-b border-border pb-12">
        <aside className="col-span-12 mb-8 md:col-span-3 md:mb-0">
          <div className="sticky top-32 space-y-4">
            <div>
              <div className="eyebrow mb-1.5 !text-[var(--stamp)]">
                Product № {String(product.id).padStart(3, "0")}
              </div>
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                {product.vendor ?? "Unknown vendor"}
              </div>
              {product.product_type &&
              product.product_type.trim().toLowerCase() !== "unclassified" ? (
                <Link
                  href={`/products?category=${encodeURIComponent(product.product_type)}`}
                  className="block font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-[var(--stamp)]"
                  title="IFP-curated product category — click to see all products in this category. Not the OMB ai_classification field."
                >
                  {humanize(product.product_type)}
                </Link>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {product.is_frontier_llm === 1 ? (
                <MonoChip tone="stamp" size="xs">
                  Frontier
                </MonoChip>
              ) : null}
              {product.is_generative_ai === 1 ? (
                <MonoChip
                  tone="ink"
                  size="xs"
                  href={buildUseCasesUrl({
                    isGenAI: true,
                    productIds: [product.id],
                  })}
                  title="See generative-AI use cases of this product"
                >
                  GenAI
                </MonoChip>
              ) : null}
              {product.product_origin === "agency_internal_platform" ? (
                <MonoChip
                  tone="muted"
                  size="xs"
                  title="Built and operated by the agency itself, not a commercial vendor product."
                >
                  Agency-internal platform
                </MonoChip>
              ) : null}
              {parent ? (
                <MonoChip
                  tone="muted"
                  size="xs"
                  href={`/products/${parent.id}`}
                  title={`Part of: ${parent.canonical_name}`}
                >
                  ⤷ {parent.canonical_name}
                </MonoChip>
              ) : null}
            </div>
          </div>
        </aside>

        <div className="col-span-12 md:col-span-9">
          <h1 className="font-display italic text-[clamp(2.4rem,6vw,5rem)] leading-[0.98] tracking-[-0.02em] text-foreground">
            {product.canonical_name}
          </h1>

          {product.vendor ? (
            <div className="mt-3 font-mono text-[12px] uppercase tracking-[0.16em] text-muted-foreground">
              by <span className="text-foreground">{product.vendor}</span>
            </div>
          ) : null}

          {product.description ? (
            <p className="mt-8 max-w-prose text-[1.05rem] leading-[1.55] text-foreground/85">
              {product.description}
            </p>
          ) : null}

          {product.notes ? (
            <p className="mt-3 max-w-prose font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
              Notes · {product.notes}
            </p>
          ) : null}

          {/* Stat ledger */}
          <div className="mt-10 grid grid-cols-3 gap-x-6 border-t-2 border-foreground pt-4">
            <StatCell
              label="Agencies"
              value={product.agencies.length}
              href="/agencies"
            />
            <StatCell
              label="Total entries"
              value={product.use_case_count}
              href={productUseCasesUrl(product.id)}
            />
            <StatCell
              label="Consolidated"
              value={consolidatedCount}
              href={productUseCasesUrl(product.id)}
            />
          </div>
        </div>
      </header>

      <SourceLegend />

      {/* ------------------------------------------------------------ */}
      {/* § I — ALIASES + SUBPRODUCTS                                  */}
      {/* ------------------------------------------------------------ */}
      {product.aliases.length > 0 || children.length > 0 ? (
        <Section
          number="I"
          title="Also filed as"
          source="derived"
          lede="Raw names and sub-products folded into this canonical record."
        >
          <div className="space-y-8">
            {product.aliases.length > 0 ? (
              <div>
                <Eyebrow color="stamp">§ Aliases</Eyebrow>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {product.aliases.map((alias) => (
                    <li key={alias}>
                      <MonoChip tone="muted" size="xs">
                        {alias}
                      </MonoChip>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {children.length > 0 ? (
              <div>
                <Eyebrow color="stamp">
                  § Sub-products ({children.length})
                </Eyebrow>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {children.map((c) => (
                    <li key={c.id}>
                      <MonoChip
                        tone="ink"
                        size="sm"
                        href={`/products/${c.id}`}
                      >
                        {c.canonical_name}
                      </MonoChip>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </Section>
      ) : null}

      {/* ------------------------------------------------------------ */}
      {/* § II — AGENCIES USING                                        */}
      {/* ------------------------------------------------------------ */}
      <Section
        number="II"
        title="Who runs it"
        source="derived"
        lede={`${formatNumber(product.agencies.length)} agencies report this product. Ranked by distinct entries.`}
      >
        {product.agencies.length === 0 ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            — No agencies reported this product —
          </p>
        ) : (
          <ul className="divide-y divide-border border-y-2 border-foreground">
            {product.agencies.map((a, i) => (
              <li
                key={a.id}
                className="group grid grid-cols-[2.25rem_4.5rem_1fr_auto] items-baseline gap-x-3 py-3 md:grid-cols-[2.75rem_5rem_1fr_auto] md:gap-x-5"
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <Link
                  href={`/agencies/${a.abbreviation}`}
                  className="font-mono text-sm font-semibold tracking-[0.04em] text-foreground hover:text-[var(--stamp)]"
                >
                  {a.abbreviation}
                </Link>
                <Link
                  href={`/agencies/${a.abbreviation}`}
                  className="truncate font-display text-[1.05rem] italic text-foreground transition-[letter-spacing] group-hover:tracking-[-0.01em]"
                >
                  {a.name}
                </Link>
                <Link
                  href={agencyUseCasesUrl(a.id, { productIds: [product.id] })}
                  className="font-mono text-[11px] uppercase tracking-[0.1em] tabular-nums text-muted-foreground transition-colors hover:text-[var(--stamp)]"
                >
                  {formatNumber(a.count)} entries
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* ------------------------------------------------------------ */}
      {/* § III — LINKED USE CASES                                     */}
      {/* ------------------------------------------------------------ */}
      <Section
        number="III"
        title="Linked entries"
        source="derived"
        lede={`${formatNumber(useCases.length)} individual use cases reference this product.`}
      >
        {useCases.length === 0 ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            — No detailed use cases reference this product —
          </p>
        ) : (
          <>
            <ul className="divide-y divide-border border-y-2 border-foreground">
              {useCases.slice(0, 200).map((uc) => (
                <li
                  key={uc.id}
                  className="grid grid-cols-[4rem_1fr_auto] items-baseline gap-x-4 py-3 md:grid-cols-[4rem_1fr_10rem_auto]"
                >
                  <Link
                    href={`/agencies/${uc.agency_abbreviation}`}
                    className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-foreground hover:text-[var(--stamp)]"
                  >
                    {uc.agency_abbreviation}
                  </Link>
                  <div className="min-w-0">
                    {uc.slug ? (
                      <Link
                        href={`/use-cases/${uc.slug}`}
                        className="font-display text-[1rem] italic leading-snug text-foreground hover:text-[var(--stamp)]"
                      >
                        {truncate(uc.use_case_name, 120)}
                      </Link>
                    ) : (
                      <span className="font-display text-[1rem] italic leading-snug text-foreground">
                        {truncate(uc.use_case_name, 120)}
                      </span>
                    )}
                    {uc.bureau_component ? (
                      <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                        {truncate(uc.bureau_component, 60)}
                      </div>
                    ) : null}
                  </div>
                  <span className="hidden font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground md:inline">
                    {uc.stage_of_development ?? "—"}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {uc.tags?.entry_type
                      ? humanize(uc.tags.entry_type)
                      : "—"}
                  </span>
                </li>
              ))}
            </ul>
            {useCases.length > 200 ? (
              <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Showing first 200 of {formatNumber(useCases.length)} entries.
              </p>
            ) : null}
          </>
        )}
      </Section>

      {/* ------------------------------------------------------------ */}
      {/* § IV — RELATED                                               */}
      {/* ------------------------------------------------------------ */}
      {related.length > 0 ? (
        <Section
          number="IV"
          title={`More from ${product.vendor}`}
          source="derived"
          lede="Other products by the same vendor filed in this year's inventory."
        >
          <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </Section>
      ) : null}

      {/* ------------------------------------------------------------ */}
      {/* § V — FEDRAMP AUTHORIZATION                                  */}
      {/* ------------------------------------------------------------ */}
      <Section
        number="V"
        title="FedRAMP authorization"
        source="derived"
        lede={
          fedrampAuthsByProduct.length > 0
            ? `${fedrampAuthsByProduct.length === 1 ? "Mapped to" : `${fedrampAuthsByProduct.length} matches in`} the FedRAMP marketplace.`
            : "Cross-reference with the FedRAMP marketplace."
        }
      >
        {fedrampAuthsByProduct.length === 0 ? (
          <div className="space-y-3">
            <FedrampCoverageBadge state="no_fedramp" />
            <p className="max-w-prose text-[13.5px] leading-relaxed text-muted-foreground">
              No FedRAMP marketplace listing has been mapped to this canonical
              product. That may mean the product is not FedRAMP-authorized, or
              that a candidate is sitting in the link-curation queue awaiting
              review.
            </p>
          </div>
        ) : (
          <div className="space-y-10 border-t-2 border-foreground pt-6">
            {fedrampAuthsByProduct.map(({ product: fp, authorizations }) => {
              const topAuths = authorizations.slice(0, 8);
              const moreAuths = authorizations.length - topAuths.length;
              const inheritedFromParentName = (
                fp as unknown as { inherited_from_parent_name?: string | null }
              ).inherited_from_parent_name ?? null;
              return (
                <article key={fp.fedramp_id} className="space-y-4">
                  <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                    <div className="min-w-0">
                      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                        {fp.csp}
                      </div>
                      <h3 className="font-display italic text-[1.5rem] leading-tight tracking-[-0.01em] text-foreground">
                        {fp.cso}
                      </h3>
                    </div>
                    <Link
                      href={`/fedramp/marketplace/products/${fp.fedramp_id}`}
                      className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-foreground hover:text-[var(--stamp)]"
                    >
                      View on FedRAMP marketplace →
                    </Link>
                  </header>

                  <div className="flex flex-wrap items-center gap-2">
                    {inheritedFromParentName ? (
                      <Badge
                        variant="outline"
                        className="border-[var(--stamp)] text-[var(--stamp)]"
                        title="This FedRAMP authorization is not attached directly to this product; it is inherited from the parent platform via Phase-5 hierarchy."
                      >
                        Inherited from {inheritedFromParentName}
                      </Badge>
                    ) : null}
                    {fp.impact_level ? (
                      <Badge variant="outline">
                        Impact: {fp.impact_level}
                      </Badge>
                    ) : null}
                    {fp.status ? (
                      <Badge variant="outline">
                        {humanize(fp.status)}
                      </Badge>
                    ) : null}
                    <Badge variant="outline">
                      {formatNumber(authorizations.length)} authorizing{" "}
                      {authorizations.length === 1 ? "agency" : "agencies"}
                    </Badge>
                    {fp.auth_type ? (
                      <Badge variant="outline">{fp.auth_type}</Badge>
                    ) : null}
                  </div>

                  {topAuths.length > 0 ? (
                    <div>
                      <Eyebrow color="stamp">§ Authorizing agencies</Eyebrow>
                      <ul className="mt-3 flex flex-wrap gap-1.5">
                        {topAuths.map((a) => (
                          <li key={a.id}>
                            <MonoChip
                              tone="muted"
                              size="xs"
                              title={
                                a.ato_issuance_date
                                  ? `ATO issued ${a.ato_issuance_date}`
                                  : undefined
                              }
                            >
                              {a.parent_agency ?? a.sub_agency ?? "—"}
                            </MonoChip>
                          </li>
                        ))}
                        {moreAuths > 0 ? (
                          <li>
                            <MonoChip
                              tone="muted"
                              size="xs"
                              href={`/fedramp/marketplace/products/${fp.fedramp_id}`}
                            >
                              + {formatNumber(moreAuths)} more
                            </MonoChip>
                          </li>
                        ) : null}
                      </ul>
                    </div>
                  ) : (
                    <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      — No authorization records on file —
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </Section>

      {/* ------------------------------------------------------------ */}
      {/* Footer caption                                               */}
      {/* ------------------------------------------------------------ */}
      <footer className="mt-20 border-t-2 border-foreground pt-4 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <span>
            Product record ·{" "}
            <span className="text-foreground">
              {product.canonical_name}
            </span>
          </span>
          <span>
            {formatNumber(product.agencies.length)} agencies ·{" "}
            {formatNumber(product.use_case_count)} entries
          </span>
        </div>
      </footer>
    </div>
  );
}

function StatCell({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href?: string;
}) {
  const inner = (
    <>
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1 font-display text-[2.2rem] leading-none tabular-nums text-foreground transition-colors md:text-[2.8rem] ${
          href ? "group-hover:text-[var(--stamp)]" : ""
        }`}
      >
        {formatNumber(value)}
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className="group block">
        {inner}
      </Link>
    );
  }
  return <div>{inner}</div>;
}

// Pre-render known product IDs at build time.
export function generateStaticParams() {
  return getAllProducts().map((p) => ({ id: String(p.id) }));
}
