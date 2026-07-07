/**
 * Cross-product frontier-penetration comparison table for /products.
 *
 * One row per hand-picked frontier product (see
 * `FRONTIER_PENETRATION_PRODUCTS` in lib/db/products.ts). Columns:
 *   - Product (links to its detail page) + vendor
 *   - Agencies (distinct, both entry kinds)
 *   - Attributions (total edges, with the individual / consolidated split)
 *   - Stage of individual entries — a mini stacked bar (consolidated entries
 *     carry no stage, so they are excluded from the mix by construction).
 *
 * Server Component: static data, no interactivity beyond product links.
 */

import Link from "next/link";
import type { FrontierPenetrationRow } from "@/lib/db";
import { formatNumber } from "@/lib/formatting";

/** Stage segments, ordered deployed → piloted → pre-deployment → other.
 *  Deployed reads as "live" in the site's verified-green; the rest step down
 *  through amber and gray so a full green bar means a mostly-live footprint. */
const STAGE_SEGMENTS: Array<{
  key: "deployed" | "piloted" | "preDeployment" | "otherStage";
  label: string;
  color: string;
}> = [
  { key: "deployed", label: "Deployed", color: "var(--verified)" },
  { key: "piloted", label: "Piloted", color: "var(--chart-5)" },
  { key: "preDeployment", label: "Pre-deployment", color: "var(--muted-foreground)" },
  { key: "otherStage", label: "Other / unknown", color: "var(--border)" },
];

function StageBar({ row }: { row: FrontierPenetrationRow }) {
  const total = row.individualEdges;
  if (total === 0) {
    return (
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
        no individual entries
      </span>
    );
  }
  return (
    <div className="flex min-w-[160px] flex-col gap-1">
      <div
        className="flex h-3 w-full overflow-hidden rounded-[2px]"
        role="img"
        aria-label={STAGE_SEGMENTS.map(
          (s) => `${row[s.key]} ${s.label.toLowerCase()}`,
        ).join(", ")}
      >
        {STAGE_SEGMENTS.map((s) => {
          const v = row[s.key];
          if (v <= 0) return null;
          return (
            <span
              key={s.key}
              className="h-full"
              style={{ width: `${(v / total) * 100}%`, background: s.color }}
              title={`${s.label}: ${v}`}
            />
          );
        })}
      </div>
      <div className="font-mono text-[10px] tabular-nums text-muted-foreground">
        <span className="text-[var(--verified)]">{row.deployed} dep.</span>
        {" · "}
        {row.piloted} pilot
        {" · "}
        {row.preDeployment} pre
      </div>
    </div>
  );
}

export function FrontierPenetrationTable({
  rows,
}: {
  rows: FrontierPenetrationRow[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead>
          <tr className="border-b-2 border-foreground font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            <th className="py-2 pr-4 font-medium">Product</th>
            <th className="py-2 pr-4 text-right font-medium">Agencies</th>
            <th className="py-2 pr-4 text-right font-medium">Attributions</th>
            <th className="py-2 pr-4 font-medium">
              Individual-entry stage mix
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.productId}
              className="border-b border-border align-top transition-colors hover:bg-muted/40"
            >
              <td className="py-3 pr-4">
                <Link
                  href={`/products/${row.productId}`}
                  className="group block"
                >
                  <span className="font-display italic text-[1.05rem] leading-tight text-foreground group-hover:text-[var(--stamp)]">
                    {row.canonicalName}
                  </span>
                  {row.vendor && (
                    <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      {row.vendor}
                    </span>
                  )}
                </Link>
              </td>
              <td className="py-3 pr-4 text-right font-mono text-[15px] tabular-nums text-foreground">
                {formatNumber(row.agencies)}
              </td>
              <td className="py-3 pr-4 text-right">
                <span className="font-mono text-[15px] tabular-nums text-foreground">
                  {formatNumber(row.edges)}
                </span>
                <span className="mt-0.5 block font-mono text-[10px] tabular-nums text-muted-foreground">
                  {formatNumber(row.individualEdges)} ind ·{" "}
                  {formatNumber(row.consolidatedEdges)} consol
                </span>
              </td>
              <td className="py-3 pr-4">
                <StageBar row={row} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Stage legend */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
        {STAGE_SEGMENTS.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-[2px]"
              style={{ background: s.color }}
            />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
