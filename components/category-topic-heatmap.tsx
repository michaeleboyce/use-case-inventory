/**
 * CategoryTopicHeatmap — 2D cross-tab grid for /browse/category-topic.
 *
 * Rows: IFP-curated product categories (`products.product_type`,
 * 'unclassified' excluded). Columns: OMB-filed topic areas
 * (`use_cases.topic_area`, empty excluded). Cells: distinct use-case
 * counts at that intersection.
 *
 * Both axes are capped at top-N by total. Off-cap activity is summarized
 * below the table via the page-level "Σ off-cap" indicator (this
 * component only deals with the visible window).
 *
 * Cell glyphs match `<CrossCutHeatmap>`: ■ = ≥10, · = 1–9, dimmed · = 0.
 * Non-empty cells link into /use-cases filtered to
 * (product_category=cat, topic_area=topic) via buildUseCasesUrl.
 */

import Link from "next/link";
import { buildUseCasesUrl } from "@/lib/urls";
import type { CategoryTopicCrossTab } from "@/lib/db";

function titleCase(value: string): string {
  return value
    .split(/[_\s]+/)
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function glyph(count: number): string {
  if (count === 0) return "";
  if (count >= 10) return "■";
  return "·";
}

function categoryUrl(category: string): string {
  return buildUseCasesUrl({ productCategories: [category] });
}

function topicUrl(topic: string): string {
  return buildUseCasesUrl({ topicAreas: [topic] });
}

function cellUrl(category: string, topic: string): string {
  return buildUseCasesUrl({
    productCategories: [category],
    topicAreas: [topic],
  });
}

export function CategoryTopicHeatmap({ data }: { data: CategoryTopicCrossTab }) {
  const { categories, topics, cells, categoryTotals, topicTotals } = data;

  if (categories.length === 0 || topics.length === 0) {
    return (
      <p className="font-mono text-sm text-muted-foreground">
        No category × topic intersections found.
      </p>
    );
  }

  // O(1) lookup: `${category}\x1f${topic}` → count.
  const lookup = new Map<string, number>();
  for (const c of cells) {
    lookup.set(`${c.category}\x1f${c.topic}`, c.count);
  }

  // Sum visible cells per row — used to flag rows whose activity sits
  // outside the visible top-N columns (off-cap), mirroring the † marker
  // pattern from <CrossCutHeatmap>.
  const visibleRowSum = new Map<string, number>();
  for (const cat of categories) {
    let sum = 0;
    for (const top of topics) {
      sum += lookup.get(`${cat.value}\x1f${top.value}`) ?? 0;
    }
    visibleRowSum.set(cat.value, sum);
  }

  return (
    <>
      {/* ---------- Desktop: full 2D table ---------- */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse font-mono text-[11px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-background border-b-2 border-foreground px-2 py-2 text-left align-bottom font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Category ↓ · Topic →
              </th>
              {topics.map((t) => (
                <th
                  key={t.value}
                  scope="col"
                  className="border-b-2 border-foreground px-1 py-2 text-center align-bottom font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground"
                  title={`${t.value} · ${t.total} use cases`}
                >
                  <Link
                    href={topicUrl(t.value)}
                    className="block max-w-[7.5rem] truncate hover:text-[var(--stamp)]"
                  >
                    {t.value}
                  </Link>
                </th>
              ))}
              <th className="border-b-2 border-foreground px-2 py-2 text-right align-bottom font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Σ
              </th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => {
              const total = categoryTotals[cat.value] ?? 0;
              const visible = visibleRowSum.get(cat.value) ?? 0;
              const offCap = total > visible;
              return (
                <tr
                  key={cat.value}
                  className="border-b border-dotted border-border"
                >
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-background px-2 py-1.5 text-left text-foreground"
                  >
                    <Link
                      href={categoryUrl(cat.value)}
                      className="hover:text-[var(--stamp)]"
                      title={`See all ${total} use cases · ${titleCase(cat.value)}`}
                    >
                      {titleCase(cat.value)}
                    </Link>
                    {offCap && (
                      <span
                        className="ml-1 align-baseline font-mono text-[9px] text-muted-foreground"
                        title={`${total - visible} of ${total} use cases sit at topics outside the top ${topics.length} columns. Click the row label to see all of them.`}
                      >
                        †
                      </span>
                    )}
                  </th>
                  {topics.map((t) => {
                    const count =
                      lookup.get(`${cat.value}\x1f${t.value}`) ?? 0;
                    const g = glyph(count);
                    if (count === 0) {
                      return (
                        <td
                          key={t.value}
                          className="px-1 py-1.5 text-center text-muted-foreground/40"
                          title={`${titleCase(cat.value)} × ${t.value}: 0`}
                        >
                          ·
                        </td>
                      );
                    }
                    return (
                      <td
                        key={t.value}
                        className="px-1 py-1.5 text-center"
                        title={`${titleCase(cat.value)} × ${t.value}: ${count}`}
                      >
                        <Link
                          href={cellUrl(cat.value, t.value)}
                          className={
                            count >= 10
                              ? "text-[var(--stamp)] hover:text-foreground"
                              : "text-foreground hover:text-[var(--stamp)]"
                          }
                        >
                          {g}
                        </Link>
                      </td>
                    );
                  })}
                  <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                    {total}
                  </td>
                </tr>
              );
            })}
            {/* Footer row: per-topic totals (across all categories,
                including off-cap rows). */}
            <tr className="border-t-2 border-foreground">
              <th
                scope="row"
                className="sticky left-0 z-10 bg-background px-2 py-2 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
              >
                Σ
              </th>
              {topics.map((t) => (
                <td
                  key={t.value}
                  className="px-1 py-2 text-center tabular-nums text-muted-foreground"
                >
                  {topicTotals[t.value] ?? 0}
                </td>
              ))}
              <td className="px-2 py-2" />
            </tr>
          </tbody>
        </table>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Glyphs · ■ = 10+ · · = 1–9 · blank/dim = 0 · click any cell to filter
          /use-cases. † = activity at topics outside the top {topics.length}{" "}
          columns; click the row label to see all of them.
        </p>
      </div>

      {/* ---------- Mobile: stacked list ---------- */}
      <ul className="flex flex-col gap-5 md:hidden">
        {categories.map((cat) => {
          const ranked = topics
            .map((t) => ({
              ...t,
              count: lookup.get(`${cat.value}\x1f${t.value}`) ?? 0,
            }))
            .filter((t) => t.count > 0)
            .sort((a, b) => b.count - a.count)
            .slice(0, 4);
          const total = categoryTotals[cat.value] ?? 0;
          return (
            <li
              key={cat.value}
              className="flex flex-col gap-1.5 border-t border-foreground pt-2"
            >
              <div className="flex items-baseline justify-between gap-3">
                <Link
                  href={categoryUrl(cat.value)}
                  className="font-display italic text-[1.1rem] text-foreground hover:text-[var(--stamp)]"
                >
                  {titleCase(cat.value)}
                </Link>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {total}
                </span>
              </div>
              {ranked.length === 0 ? (
                <span className="font-mono text-xs text-muted-foreground">
                  No top-{topics.length} topics for this category.
                </span>
              ) : (
                <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px]">
                  {ranked.map((t) => (
                    <Link
                      key={t.value}
                      href={cellUrl(cat.value, t.value)}
                      className="text-foreground hover:text-[var(--stamp)]"
                    >
                      {t.value}{" "}
                      <span className="tabular-nums text-muted-foreground">
                        {t.count}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
