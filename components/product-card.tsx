/**
 * Product grid card — editorial.
 *
 * A hairline-ruled block with a thick foreground top-rule, an italic display
 * product name, a monospace vendor byline, optional tone chips, and a
 * bottom row of tabular counters (agencies / entries). No rounded corners,
 * no Card, no filled background.
 */

import Link from "next/link";
import { MonoChip } from "@/components/editorial";
import { formatNumber, humanize } from "@/lib/formatting";
import { productUseCasesUrl } from "@/lib/urls";
import type { ProductWithCounts } from "@/lib/types";

type Props = {
  product: ProductWithCounts;
  parentName?: string | null;
};

export function ProductCard({ product, parentName }: Props) {
  return (
    <div className="group flex h-full flex-col border-t-2 border-foreground bg-transparent pt-4 transition-colors hover:border-[var(--stamp)]">
      <Link
        href={`/products/${product.id}`}
        className="flex items-start justify-between gap-3"
      >
        <div className="min-w-0 flex-1">
          <h3 className="font-display italic text-[1.45rem] leading-[1.05] tracking-[-0.01em] text-foreground transition-colors group-hover:text-[var(--stamp)]">
            {product.canonical_name}
          </h3>
          <div className="mt-1.5 truncate font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            {product.vendor ?? "— unknown vendor"}
          </div>
        </div>
        {product.product_type ? (
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--stamp)]">
            {humanize(product.product_type)}
          </span>
        ) : null}
      </Link>

      {product.is_generative_ai === 1 ||
      product.is_frontier_llm === 1 ||
      product.product_origin === "agency_internal_platform" ||
      parentName ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {product.is_frontier_llm === 1 ? (
            <MonoChip tone="stamp" size="xs">
              Frontier
            </MonoChip>
          ) : null}
          {product.is_generative_ai === 1 ? (
            <MonoChip tone="ink" size="xs">
              GenAI
            </MonoChip>
          ) : null}
          {product.product_origin === "agency_internal_platform" ? (
            <MonoChip
              tone="muted"
              size="xs"
              title="Built and operated by the agency itself, not a commercial vendor product."
            >
              Agency-internal
            </MonoChip>
          ) : null}
          {parentName ? (
            <MonoChip tone="muted" size="xs" title={`Part of: ${parentName}`}>
              ⤷ {parentName}
            </MonoChip>
          ) : null}
        </div>
      ) : null}

      <div className="mt-auto grid grid-cols-2 gap-x-4 border-t border-dotted border-border pt-3 font-mono text-[11px] uppercase tracking-[0.12em]">
        <Link
          href={`/products/${product.id}`}
          className="flex items-baseline justify-between gap-2 transition-colors hover:text-[var(--stamp)]"
        >
          <span className="text-muted-foreground">Agencies</span>
          <span className="tabular-nums text-foreground transition-colors hover:text-[var(--stamp)]">
            {formatNumber(product.agency_count)}
          </span>
        </Link>
        <Link
          href={productUseCasesUrl(product.id)}
          className="flex items-baseline justify-between gap-2 transition-colors hover:text-[var(--stamp)]"
        >
          <span className="text-muted-foreground">Entries</span>
          <span className="tabular-nums text-foreground transition-colors hover:text-[var(--stamp)]">
            {formatNumber(product.use_case_count)}
          </span>
        </Link>
      </div>
    </div>
  );
}
