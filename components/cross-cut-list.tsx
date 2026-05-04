/**
 * CrossCutList — value cards for /browse/[dimension] in list view.
 *
 * Each card shows: value title, count (tabular-nums), top agencies, top
 * products, and a "View all →" link to the filtered /use-cases page. For
 * vendor (not a CrossCutDimension) we route via the single-value `vendor`
 * filter using buildUseCasesUrl directly.
 */

import Link from "next/link";
import { tagFilterUrl } from "@/lib/urls";
import type { CrossCutKey, CrossCutValueRow } from "@/lib/db";
import {
  MonoChip,
  SOPHISTICATION_LABELS,
  SCOPE_LABELS,
  ENTRY_TYPE_LABELS,
} from "@/components/editorial";
import { formatNumber } from "@/lib/formatting";

const VALUE_LABELS: Record<string, string> = {
  ...ENTRY_TYPE_LABELS,
  ...SOPHISTICATION_LABELS,
  ...SCOPE_LABELS,
};

function titleCase(value: string): string {
  return value
    .split(/[_\s]+/)
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function displayLabel(value: string): string {
  return VALUE_LABELS[value] ?? titleCase(value);
}

function viewAllUrl(dim: CrossCutKey, value: string): string {
  if (dim === "vendor") {
    // Vendor is a single-value string filter on UseCaseFilterInput.vendor,
    // routed through `?vendor=` rather than CrossCutDimension's tag URL helper.
    return `/use-cases?vendor=${encodeURIComponent(value)}`;
  }
  return tagFilterUrl(dim, value);
}

export function CrossCutList({
  dim,
  rows,
}: {
  dim: CrossCutKey;
  rows: CrossCutValueRow[];
}) {
  if (rows.length === 0) {
    return (
      <p className="font-mono text-sm text-muted-foreground">
        No values found for this dimension.
      </p>
    );
  }
  return (
    <ul className="grid gap-x-6 gap-y-6 md:grid-cols-2">
      {rows.map((row) => {
        const href = viewAllUrl(dim, row.value);
        const label = displayLabel(row.value);
        return (
          <li
            key={row.value}
            className="flex flex-col gap-3 border-t-2 border-foreground pt-3"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-display italic text-[1.4rem] leading-tight text-foreground">
                <Link href={href} className="hover:text-[var(--stamp)]">
                  {label}
                </Link>
              </h3>
              <span className="font-mono text-sm tabular-nums text-foreground">
                {formatNumber(row.count)}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Top agencies
              </div>
              {row.top_agencies.length === 0 ? (
                <div className="font-mono text-xs text-muted-foreground">—</div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {row.top_agencies.map((a) => (
                    <MonoChip
                      key={a.id}
                      href={`/agencies/${a.abbreviation}`}
                      title={`${a.abbreviation} · ${formatNumber(a.count)} use cases`}
                      size="xs"
                    >
                      {a.abbreviation}
                      <span className="ml-1 font-normal normal-case tracking-normal text-muted-foreground">
                        {a.count}
                      </span>
                    </MonoChip>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Top products
              </div>
              {row.top_products.length === 0 ? (
                <div className="font-mono text-xs text-muted-foreground">—</div>
              ) : (
                <ul className="flex flex-col gap-0.5 text-sm text-foreground">
                  {row.top_products.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-baseline justify-between gap-3"
                    >
                      <Link
                        href={`/products/${p.id}`}
                        className="truncate hover:text-[var(--stamp)]"
                      >
                        {p.canonical_name}
                      </Link>
                      <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                        {p.count}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <Link
                href={href}
                className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--stamp)] hover:text-foreground"
              >
                View all →
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
