/**
 * /fedramp/marketplace/csps — directory of every cloud service provider with
 * one or more FedRAMP offerings. Server Component; sort/search are URL-driven.
 */

import { Suspense } from "react";
import Link from "next/link";
import { Section, Eyebrow, MonoChip } from "@/components/editorial";
import { getFedrampCsps } from "@/lib/db";
import { formatNumber } from "@/lib/formatting";

export const metadata = {
  title: "Providers · FedRAMP Marketplace · Federal AI Inventory",
  description:
    "Every cloud service provider behind a FedRAMP-listed offering, with offering counts and total authorizations.",
};

const PAGE_SIZE = 50;
type Sort = "offerings" | "alpha" | "authorized" | "authorizations";
const SORT_OPTIONS: Array<{ key: Sort; label: string }> = [
  { key: "offerings", label: "Offerings" },
  { key: "authorized", label: "Authorized" },
  { key: "authorizations", label: "Total ATOs" },
  { key: "alpha", label: "A → Z" },
];
function isSort(s: string | null | undefined): s is Sort {
  return (
    s === "offerings" ||
    s === "alpha" ||
    s === "authorized" ||
    s === "authorizations"
  );
}

export default async function MarketplaceCspsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().toLowerCase();
  const sortParam = typeof sp.sort === "string" ? sp.sort : undefined;
  const sort: Sort = isSort(sortParam) ? sortParam : "offerings";
  const pageParam = typeof sp.page === "string" ? Number(sp.page) : 1;
  const page =
    Number.isFinite(pageParam) && pageParam > 0
      ? Math.floor(pageParam)
      : 1;

  const all = getFedrampCsps();
  let rows = all;
  if (q.length > 0) {
    rows = rows.filter(
      (c) =>
        c.csp.toLowerCase().includes(q) ||
        c.csp_slug.toLowerCase().includes(q),
    );
  }

  const sorted = [...rows].sort((a, b) => {
    switch (sort) {
      case "alpha":
        return a.csp.localeCompare(b.csp);
      case "authorized":
        return (
          b.authorized_count - a.authorized_count ||
          b.offering_count - a.offering_count
        );
      case "authorizations":
        return b.total_authorizations - a.total_authorizations;
      case "offerings":
      default:
        return (
          b.offering_count - a.offering_count || a.csp.localeCompare(b.csp)
        );
    }
  });

  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const endIdx = Math.min(startIdx + PAGE_SIZE, total);
  const pageRows = sorted.slice(startIdx, endIdx);

  return (
    <div>
      <header className="ink-in grid grid-cols-12 gap-x-6 border-b border-border pb-12">
        <aside className="col-span-12 mb-8 md:col-span-3 md:mb-0">
          <div className="space-y-2">
            <Eyebrow color="stamp">§ II · Providers</Eyebrow>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              <span className="tabular-nums text-foreground">
                {formatNumber(all.length)}
              </span>{" "}
              cloud service providers
            </div>
            {q.length > 0 ? (
              <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
                <span className="tabular-nums text-foreground">
                  {formatNumber(total)}
                </span>{" "}
                matches “{q}”
              </div>
            ) : null}
          </div>
        </aside>
        <div className="col-span-12 md:col-span-9">
          <h1 className="font-display italic text-[2.4rem] leading-[1] tracking-[-0.02em] text-foreground md:text-[3.6rem]">
            Cloud Service Providers
          </h1>
          <p className="mt-6 max-w-[60ch] text-base leading-relaxed text-foreground/85 md:text-[1.05rem]">
            Every CSP behind a listed FedRAMP cloud-service offering. Many
            providers list a single offering; a handful (Amazon, Microsoft,
            IBM, Oracle, Adobe) carry many.
          </p>

          <Suspense fallback={null}>
            <form
              action="/fedramp/marketplace/csps"
              method="get"
              className="mt-8 flex items-end gap-3 border-t border-border pt-4"
            >
              <div className="flex-1">
                <label
                  htmlFor="q"
                  className="block font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
                >
                  Filter
                </label>
                <input
                  id="q"
                  type="search"
                  name="q"
                  defaultValue={q}
                  placeholder="Filter by provider name or slug…"
                  className="mt-1 w-full border-b border-border bg-transparent px-1 py-1.5 font-body text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-foreground focus:outline-none"
                />
              </div>
              <input type="hidden" name="sort" value={sort} />
              <button
                type="submit"
                className="border border-foreground bg-background px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-foreground hover:bg-foreground hover:text-background"
              >
                Apply
              </button>
            </form>
          </Suspense>
        </div>
      </header>

      <Section number="I" title="Directory" lede="Sorted by offering count by default.">
        <div className="space-y-4">
          <SortTabs current={sort} q={q} />

          <div className="flex items-baseline justify-between gap-4 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
            <span>
              <span className="tabular-nums text-foreground">
                {formatNumber(total === 0 ? 0 : startIdx + 1)}
              </span>
              {"–"}
              <span className="tabular-nums text-foreground">
                {formatNumber(endIdx)}
              </span>{" "}
              of{" "}
              <span className="tabular-nums text-foreground">
                {formatNumber(total)}
              </span>
            </span>
            <span>
              Page{" "}
              <span className="tabular-nums text-foreground">{safePage}</span>{" "}
              of{" "}
              <span className="tabular-nums text-foreground">{pageCount}</span>
            </span>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse text-sm tabular-nums">
              <thead>
                <tr className="border-b-2 border-foreground text-left">
                  <Th className="w-[40%]">Provider</Th>
                  <Th className="text-right">Offerings</Th>
                  <Th className="text-right">Authorized</Th>
                  <Th className="text-right">Total ATOs</Th>
                  <Th className="text-right">Reuses</Th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-2 py-6 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground"
                    >
                      No providers match {q ? `“${q}”` : "the current filter"}.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((r) => (
                    <tr
                      key={r.csp_slug}
                      className="border-b border-dotted border-border hover:bg-foreground/[0.025]"
                    >
                      <td className="px-2 py-2 align-top">
                        <MonoChip
                          href={`/fedramp/marketplace/csps/${r.csp_slug}`}
                          tone="ink"
                          size="sm"
                          title={r.csp}
                        >
                          {r.csp}
                        </MonoChip>
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-[12px] font-semibold">
                        {formatNumber(r.offering_count)}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-[12px] text-[var(--verified)]">
                        {formatNumber(r.authorized_count)}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-[12px]">
                        {formatNumber(r.total_authorizations)}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-[12px] text-foreground/80">
                        {formatNumber(r.total_reuses)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination page={safePage} pageCount={pageCount} q={q} sort={sort} />
        </div>
      </Section>
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={`px-2 pb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground ${className}`}
    >
      {children}
    </th>
  );
}

function SortTabs({ current, q }: { current: Sort; q: string }) {
  const baseQs = q.length > 0 ? `q=${encodeURIComponent(q)}&` : "";
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border pb-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Sort
      </span>
      {SORT_OPTIONS.map((opt) => {
        const active = opt.key === current;
        return (
          <a
            key={opt.key}
            href={`?${baseQs}sort=${opt.key}`}
            className={`font-mono text-[11px] uppercase tracking-[0.14em] transition-colors ${
              active
                ? "text-foreground border-b-2 border-[var(--stamp)] -mb-[3px] pb-1"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt.label}
          </a>
        );
      })}
    </div>
  );
}

function Pagination({
  page,
  pageCount,
  q,
  sort,
}: {
  page: number;
  pageCount: number;
  q: string;
  sort: Sort;
}) {
  if (pageCount <= 1) return null;
  const baseParams = new URLSearchParams();
  if (q.length > 0) baseParams.set("q", q);
  baseParams.set("sort", sort);

  const link = (p: number) => {
    const params = new URLSearchParams(baseParams);
    params.set("page", String(p));
    return `?${params.toString()}`;
  };

  const prev = page > 1 ? page - 1 : null;
  const next = page < pageCount ? page + 1 : null;

  const window = new Set<number>([1, pageCount, page, page - 1, page + 1]);
  const pages = Array.from(window)
    .filter((p) => p >= 1 && p <= pageCount)
    .sort((a, b) => a - b);

  return (
    <nav
      aria-label="Pagination"
      className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3"
    >
      {prev ? (
        <Link
          href={link(prev)}
          className="font-mono text-[11px] uppercase tracking-[0.14em] text-foreground hover:text-[var(--stamp)]"
        >
          ← Prev
        </Link>
      ) : (
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground/50">
          ← Prev
        </span>
      )}
      <ul className="flex flex-wrap items-center gap-1.5">
        {pages.map((p, idx) => {
          const prevP = pages[idx - 1];
          const gap = prevP != null && p - prevP > 1;
          return (
            <li key={p} className="flex items-center gap-1.5">
              {gap ? (
                <span className="font-mono text-[11px] text-muted-foreground/60">…</span>
              ) : null}
              <Link
                href={link(p)}
                aria-current={p === page ? "page" : undefined}
                className={`min-w-[2ch] border border-transparent px-1.5 py-0.5 text-center font-mono text-[11px] tabular-nums uppercase tracking-[0.1em] transition-colors ${
                  p === page
                    ? "border-foreground bg-foreground text-background"
                    : "text-foreground hover:border-foreground"
                }`}
              >
                {p}
              </Link>
            </li>
          );
        })}
      </ul>
      {next ? (
        <Link
          href={link(next)}
          className="font-mono text-[11px] uppercase tracking-[0.14em] text-foreground hover:text-[var(--stamp)]"
        >
          Next →
        </Link>
      ) : (
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground/50">
          Next →
        </span>
      )}
    </nav>
  );
}
