/**
 * /fedramp/marketplace/compare — side-by-side comparison of up to four
 * FedRAMP offerings. URL is the source of truth: `?ids=ID1,ID2,…`.
 *
 * The original FedRAMP dashboard ships a client-side picker; this server-
 * rendered port keeps the same URL contract but uses a plain GET <form>
 * with three text inputs (one per slot) so it works without any client JS.
 * If/when interactivity is needed, a `compare-picker.tsx` client component
 * can be slotted in without touching the page contract.
 */

import Link from "next/link";
import { Eyebrow, MonoChip } from "@/components/editorial";
import {
  getFedrampProductById,
  getFedrampProducts,
  getFedrampAuthorizationsForProduct,
} from "@/lib/db";
import { StatusStamp } from "@/components/fedramp/status-stamp";
import { ImpactBadge } from "@/components/fedramp/impact-badge";
import { formatDate, formatNumber } from "@/lib/formatting";
import type { FedrampProduct } from "@/lib/types";

export const metadata = {
  title: "Compare · FedRAMP Marketplace · Federal AI Inventory",
  description:
    "Line up to four FedRAMP cloud-service offerings side by side across status, impact, models, authorization counts, reuse, and assessor.",
};

const MAX_PRODUCTS = 4;

function parseIds(raw: string | string[] | undefined): string[] {
  if (!raw) return [];
  const flat = Array.isArray(raw) ? raw.join(",") : raw;
  return flat
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_PRODUCTS);
}

export default async function MarketplaceComparePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const ids = parseIds(sp.ids);

  // Resolve. Drop any unknown IDs silently — the input form preserves
  // whatever the user typed, so they can fix the typo.
  const resolved = ids
    .map((id) => getFedrampProductById(id))
    .filter((p): p is FedrampProduct => p !== null);

  // For each resolved product, count its authorizations from the long table
  // (vs. the wide-table `authorization_count`, which is the marketplace's
  // own reckoning and may differ).
  const ledger = resolved.map((p) => ({
    product: p,
    auths: getFedrampAuthorizationsForProduct(p.fedramp_id),
  }));

  // For the picker autocomplete affordance, hand a small catalog of known
  // products to a `<datalist>`. Cap at the first 600 alphabetically — the
  // full set is ~640 so this is essentially the whole list.
  const catalog = getFedrampProducts().slice(0, 600);

  return (
    <div>
      <header className="ink-in grid grid-cols-12 gap-x-6 border-b border-border pb-12">
        <aside className="col-span-12 mb-8 md:col-span-3 md:mb-0">
          <div className="space-y-2">
            <Eyebrow color="stamp">§ VI · Compare</Eyebrow>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Cross-section · Up to {MAX_PRODUCTS}
            </div>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {resolved.length === 0
                ? "None selected"
                : `${resolved.length} selected`}
            </div>
            <p className="max-w-xs border-t border-border pt-3 text-sm leading-snug text-muted-foreground">
              Pick up to four FedRAMP offerings and line them up across
              status, impact, models, authorizations, and reuse. The URL
              carries the selection.
            </p>
          </div>
        </aside>

        <div className="col-span-12 md:col-span-9">
          <h1 className="font-display italic text-[clamp(2.4rem,6vw,4.6rem)] leading-[0.95] tracking-[-0.03em] text-foreground">
            Side by side.
          </h1>
          <p className="mt-6 max-w-prose text-[1.02rem] leading-[1.55] text-foreground/85">
            A ledger comparison of FedRAMP cloud-service offerings. Products
            run across the top; attributes run down the left.
          </p>
        </div>
      </header>

      {/* ----------------------------------------------------------------- */}
      {/* Picker                                                             */}
      {/* ----------------------------------------------------------------- */}
      <section className="mt-10">
        <div className="mb-3 flex items-baseline justify-between gap-4 border-b border-border pb-2">
          <Eyebrow>Selection</Eyebrow>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
            {resolved.length}/{MAX_PRODUCTS} products
          </div>
        </div>

        <ComparePicker
          ids={ids}
          catalog={catalog}
        />
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* Comparison ledger                                                  */}
      {/* ----------------------------------------------------------------- */}
      {ledger.length === 0 ? (
        <EmptyState />
      ) : (
        <section className="mt-12">
          <div className="mb-3 flex items-baseline justify-between gap-4 border-b border-border pb-2">
            <Eyebrow>Comparison ledger</Eyebrow>
            <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
              <span className="text-[var(--stamp)]">◆</span> = values differ
            </div>
          </div>
          <CompareTable ledger={ledger} />
        </section>
      )}
    </div>
  );
}

function ComparePicker({
  ids,
  catalog,
}: {
  ids: string[];
  catalog: FedrampProduct[];
}) {
  // Up to MAX_PRODUCTS slots. Empty entries get an empty input.
  const slots = Array.from({ length: MAX_PRODUCTS }, (_, i) => ids[i] ?? "");
  return (
    <form
      action="/fedramp/marketplace/compare"
      method="get"
      className="grid gap-3 md:grid-cols-[repeat(4,1fr)_auto]"
    >
      <datalist id="fedramp-product-catalog">
        {catalog.map((p) => (
          <option
            key={p.fedramp_id}
            value={p.fedramp_id}
            label={`${p.cso} — ${p.csp}`}
          />
        ))}
      </datalist>
      {slots.map((value, idx) => (
        <div key={idx}>
          <label
            htmlFor={`slot-${idx}`}
            className="block font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
          >
            Slot {idx + 1}
          </label>
          <input
            id={`slot-${idx}`}
            name="ids"
            list="fedramp-product-catalog"
            defaultValue={value}
            placeholder="FedRAMP ID"
            className="mt-1 w-full border-b border-border bg-transparent px-1 py-1.5 font-mono text-[12px] text-foreground placeholder:text-muted-foreground/60 focus:border-foreground focus:outline-none"
          />
        </div>
      ))}
      <button
        type="submit"
        className="self-end border border-foreground bg-background px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-foreground hover:bg-foreground hover:text-background"
      >
        Compare
      </button>
    </form>
  );
}

function EmptyState() {
  return (
    <div className="mt-12 border-t-2 border-foreground pt-8">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
        <p className="font-display italic text-[1.4rem] leading-snug text-foreground">
          Pick up to four FedRAMP offerings above to line them up side by side.
        </p>
        <p className="max-w-md text-sm leading-snug text-muted-foreground">
          You&rsquo;ll see status, impact level, models, authorization type
          and date, assessor, total authorizations, and reuse counts in a
          single grid.
        </p>
      </div>
    </div>
  );
}

function CompareTable({
  ledger,
}: {
  ledger: Array<{
    product: FedrampProduct;
    auths: ReturnType<typeof getFedrampAuthorizationsForProduct>;
  }>;
}) {
  const products = ledger.map((l) => l.product);

  const rows: Array<{
    label: string;
    values: Array<React.ReactNode>;
    rawValues: Array<string | number | null>;
  }> = [
    {
      label: "Provider",
      values: products.map((p) => (
        <Link
          key={p.fedramp_id}
          href={`/fedramp/marketplace/csps/${p.csp_slug}`}
          className="font-mono text-[11px] uppercase tracking-[0.06em] text-foreground hover:text-[var(--stamp)]"
        >
          {p.csp}
        </Link>
      )),
      rawValues: products.map((p) => p.csp),
    },
    {
      label: "Status",
      values: products.map((p) => <StatusStamp key={p.fedramp_id} status={p.status} size="xs" />),
      rawValues: products.map((p) => p.status),
    },
    {
      label: "Impact level",
      values: products.map((p) => <ImpactBadge key={p.fedramp_id} impact={p.impact_level} />),
      rawValues: products.map((p) => p.impact_level),
    },
    {
      label: "Auth type",
      values: products.map((p) => p.auth_type ?? "—"),
      rawValues: products.map((p) => p.auth_type),
    },
    {
      label: "Auth date",
      values: products.map((p) => formatDate(p.auth_date)),
      rawValues: products.map((p) => p.auth_date),
    },
    {
      label: "Auth category",
      values: products.map((p) => p.auth_category ?? "—"),
      rawValues: products.map((p) => p.auth_category),
    },
    {
      label: "Deployment",
      values: products.map((p) => p.deployment_model ?? "—"),
      rawValues: products.map((p) => p.deployment_model),
    },
    {
      label: "Authorizations (wide)",
      values: products.map((p) => formatNumber(p.authorization_count ?? 0)),
      rawValues: products.map((p) => p.authorization_count),
    },
    {
      label: "Authorizations (long)",
      values: ledger.map((l) => formatNumber(l.auths.length)),
      rawValues: ledger.map((l) => l.auths.length),
    },
    {
      label: "Reuse count",
      values: products.map((p) => formatNumber(p.reuse_count ?? 0)),
      rawValues: products.map((p) => p.reuse_count),
    },
    {
      label: "3PAO",
      values: products.map((p) => p.independent_assessor ?? "—"),
      rawValues: products.map((p) => p.independent_assessor),
    },
    {
      label: "Annual assessment",
      values: products.map((p) => formatDate(p.annual_assessment_date)),
      rawValues: products.map((p) => p.annual_assessment_date),
    },
  ];

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-foreground text-left">
            <Th>Attribute</Th>
            {products.map((p) => (
              <Th key={p.fedramp_id}>
                <Link
                  href={`/fedramp/marketplace/products/${p.fedramp_id}`}
                  className="font-display italic text-[1rem] leading-tight text-foreground hover:text-[var(--stamp)]"
                >
                  {p.cso}
                </Link>
                <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                  {p.fedramp_id}
                </div>
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const distinct =
              new Set(row.rawValues.map((v) => (v == null ? "" : String(v))))
                .size > 1;
            return (
              <tr
                key={row.label}
                className="border-b border-dotted border-border align-baseline"
              >
                <td className="px-2 py-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
                  {distinct ? (
                    <span className="text-[var(--stamp)]">◆ </span>
                  ) : null}
                  {row.label}
                </td>
                {row.values.map((v, i) => (
                  <td
                    key={i}
                    className="px-2 py-2 font-mono text-[12px] tabular-nums text-foreground/90"
                  >
                    {v}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className="px-2 pb-1.5 text-left font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
    >
      {children}
    </th>
  );
}
