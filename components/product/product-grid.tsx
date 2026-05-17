/**
 * Editorial product grid. Server Component — plain data in.
 *
 * Each tile is a hairline-ruled block with an italic display product name,
 * a mono vendor byline, and a tabular counter row. Mirrors the /products
 * grid style so the /agencies/[abbr] and /products pages feel like the same
 * publication.
 */

import Link from "next/link";
import { formatNumber } from "@/lib/formatting";
import { agencyUseCasesUrl } from "@/lib/urls";

type ProductCard = {
  id: number;
  canonical_name: string;
  vendor: string | null;
  use_case_count: number;
};

type Props = {
  products: ProductCard[];
  /** Label for the count on each card (e.g. "use cases", "entries"). */
  countLabel?: string;
  emptyMessage?: string;
  /**
   * If provided, the count number on each card drill-through links to
   * `/use-cases` filtered by this agency + the product.
   */
  agencyId?: number;
};

export function ProductGrid({
  products,
  countLabel = "use cases",
  emptyMessage = "No products recorded.",
  agencyId,
}: Props) {
  if (products.length === 0) {
    return (
      <p className="font-body text-sm text-muted-foreground">{emptyMessage}</p>
    );
  }

  return (
    <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((p) => (
        <div
          key={p.id}
          className="group flex h-full flex-col border-t-2 border-foreground bg-transparent pt-4 transition-colors hover:border-[var(--stamp)]"
        >
          <Link href={`/products/${p.id}`} className="flex flex-col">
            <h3 className="font-display italic text-[1.35rem] leading-[1.05] tracking-[-0.01em] text-foreground group-hover:text-[var(--stamp)]">
              {p.canonical_name}
            </h3>
            <div className="mt-1.5 truncate font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              {p.vendor ?? "— unknown vendor"}
            </div>
          </Link>

          <div className="mt-auto flex items-baseline justify-between gap-3 border-t border-dotted border-border pt-3 font-mono text-[11px] uppercase tracking-[0.12em]">
            <span className="text-muted-foreground">{countLabel}</span>
            {agencyId != null ? (
              <Link
                href={agencyUseCasesUrl(agencyId, { productIds: [p.id] })}
                title={`See ${p.use_case_count} ${countLabel} at this agency`}
                className="tabular-nums text-foreground transition-colors hover:text-[var(--stamp)]"
              >
                {formatNumber(p.use_case_count)}
              </Link>
            ) : (
              <span className="tabular-nums text-foreground">
                {formatNumber(p.use_case_count)}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
