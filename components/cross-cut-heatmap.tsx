/**
 * CrossCutHeatmap — value × top-15-agencies grid for /browse/[dimension].
 *
 * Cell glyphs: ■ for ≥10, · for 1–9, blank for 0. Each non-empty cell is
 * an `<a>` to /use-cases filtered to (dim=value, agency_ids=id). For
 * dim=vendor, routes to `/use-cases?vendor=<v>&agency_ids=<id>` (vendor is
 * a single-value string filter on UseCaseFilterInput.vendor).
 *
 * Mobile fallback: a stacked one-block-per-value list — same data, less
 * width pressure. Tailwind responsive classes flip between the two.
 */

import Link from "next/link";
import { tagFilterUrl } from "@/lib/urls";
import type { CrossCutKey } from "@/lib/db";
import {
  SOPHISTICATION_LABELS,
  SCOPE_LABELS,
  ENTRY_TYPE_LABELS,
} from "@/components/editorial";

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

function cellUrl(dim: CrossCutKey, value: string, agencyId: number): string {
  if (dim === "vendor") {
    return `/use-cases?vendor=${encodeURIComponent(value)}&agency_ids=${agencyId}`;
  }
  return tagFilterUrl(dim, value, agencyId);
}

function glyph(count: number): string {
  if (count === 0) return "";
  if (count >= 10) return "■";
  return "·";
}

type Heatmap = {
  agencies: Array<{ id: number; abbreviation: string; total: number }>;
  values: string[];
  cells: Array<{
    value: string;
    agency_id: number;
    agency_abbreviation: string;
    count: number;
  }>;
  /** TRUE per-value totals across ALL agencies (not just the visible
   *  top-N columns). The Σ column displays this, not the sum of visible
   *  cells, so a value concentrated at an agency outside the cap still
   *  shows an accurate row total. */
  valueTotals: Record<string, number>;
};

function rowUrl(dim: CrossCutKey, value: string): string {
  if (dim === "vendor") {
    return `/use-cases?vendor=${encodeURIComponent(value)}`;
  }
  return tagFilterUrl(dim, value);
}

export function CrossCutHeatmap({
  dim,
  data,
}: {
  dim: CrossCutKey;
  data: Heatmap;
}) {
  const { agencies, values, cells, valueTotals } = data;

  if (agencies.length === 0 || values.length === 0) {
    return (
      <p className="font-mono text-sm text-muted-foreground">
        No values found for this dimension.
      </p>
    );
  }

  // Build O(1) lookup: `${value}\x1f${agencyId}` → count.
  const lookup = new Map<string, number>();
  for (const c of cells) {
    lookup.set(`${c.value}\x1f${c.agency_id}`, c.count);
  }

  // Sum visible cells per value — used to detect "off-cap" rows where the
  // true total is positive but no visible cell carries the activity.
  const visibleSum = new Map<string, number>();
  for (const v of values) {
    let sum = 0;
    for (const a of agencies) {
      sum += lookup.get(`${v}\x1f${a.id}`) ?? 0;
    }
    visibleSum.set(v, sum);
  }

  return (
    <>
      {/* ---------- Desktop: full table ---------- */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse font-mono text-[11px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-background border-b-2 border-foreground px-2 py-2 text-left align-bottom font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Value
              </th>
              {agencies.map((a) => (
                <th
                  key={a.id}
                  scope="col"
                  className="border-b-2 border-foreground px-1 py-2 text-center align-bottom font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground"
                  title={`${a.abbreviation} · ${a.total} use cases`}
                >
                  <Link
                    href={`/agencies/${a.abbreviation}`}
                    className="hover:text-[var(--stamp)]"
                  >
                    {a.abbreviation}
                  </Link>
                </th>
              ))}
              <th className="border-b-2 border-foreground px-2 py-2 text-right align-bottom font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Σ
              </th>
            </tr>
          </thead>
          <tbody>
            {values.map((v) => {
              const total = valueTotals[v] ?? 0;
              const visible = visibleSum.get(v) ?? 0;
              const offCap = total > visible;
              return (
                <tr key={v} className="border-b border-dotted border-border">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-background px-2 py-1.5 text-left text-foreground"
                  >
                    <Link
                      href={rowUrl(dim, v)}
                      className="hover:text-[var(--stamp)]"
                      title={`See all ${total} use cases · ${displayLabel(v)}`}
                    >
                      {displayLabel(v)}
                    </Link>
                    {offCap && (
                      <span
                        className="ml-1 align-baseline font-mono text-[9px] text-muted-foreground"
                        title={`${total - visible} of ${total} are at agencies outside the top ${agencies.length} columns. Click the row label to see all of them.`}
                      >
                        †
                      </span>
                    )}
                  </th>
                  {agencies.map((a) => {
                    const count = lookup.get(`${v}\x1f${a.id}`) ?? 0;
                    const g = glyph(count);
                    if (count === 0) {
                      return (
                        <td
                          key={a.id}
                          className="px-1 py-1.5 text-center text-muted-foreground/40"
                          title={`${displayLabel(v)} × ${a.abbreviation}: 0`}
                        >
                          ·
                        </td>
                      );
                    }
                    return (
                      <td
                        key={a.id}
                        className="px-1 py-1.5 text-center"
                        title={`${displayLabel(v)} × ${a.abbreviation}: ${count}`}
                      >
                        <Link
                          href={cellUrl(dim, v, a.id)}
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
          </tbody>
        </table>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Glyphs · ■ = 10+ · · = 1–9 · blank = 0 · click any cell to filter
          /use-cases. † = activity at agencies outside the top {agencies.length}{" "}
          columns; click the row label to see all of them.
        </p>
      </div>

      {/* ---------- Mobile: stacked list ---------- */}
      <ul className="flex flex-col gap-5 md:hidden">
        {values.map((v) => {
          // Top 3 agencies for this value within the top-15 row.
          const ranked = agencies
            .map((a) => ({
              ...a,
              count: lookup.get(`${v}\x1f${a.id}`) ?? 0,
            }))
            .filter((a) => a.count > 0)
            .sort((a, b) => b.count - a.count)
            .slice(0, 3);
          return (
            <li
              key={v}
              className="flex flex-col gap-1.5 border-t border-foreground pt-2"
            >
              <div className="flex items-baseline justify-between gap-3">
                <Link
                  href={rowUrl(dim, v)}
                  className="font-display italic text-[1.1rem] text-foreground hover:text-[var(--stamp)]"
                >
                  {displayLabel(v)}
                </Link>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {valueTotals[v] ?? 0}
                </span>
              </div>
              {ranked.length === 0 ? (
                <span className="font-mono text-xs text-muted-foreground">
                  No top-15 agencies have this value.
                </span>
              ) : (
                <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px]">
                  {ranked.map((a) => (
                    <Link
                      key={a.id}
                      href={cellUrl(dim, v, a.id)}
                      className="text-foreground hover:text-[var(--stamp)]"
                    >
                      {a.abbreviation}{" "}
                      <span className="tabular-nums text-muted-foreground">
                        {a.count}
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
