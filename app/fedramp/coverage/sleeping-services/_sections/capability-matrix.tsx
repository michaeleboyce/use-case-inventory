/**
 * V4 — the capability-void matrix: agencies × capability categories,
 * aggregated across all mapped services. Server-rendered; the state-capacity
 * view ("the translation column is nearly empty despite broad reach").
 *
 *   ■  reports something in the class (any labeled product, or a lead row)
 *   ◪  sleeping in the class, but similar capability deployed
 *   □  sleeping AND nothing similar — a capability void
 *   ·  no reach, nothing reported
 */
import type { MatrixRow } from "../_shared";
import { CAPABILITY_LABELS } from "../_shared";
import type { CapabilityCategory } from "@/lib/types";

const GLYPH: Record<MatrixRow["cells"][number], string> = {
  reports: "■",
  sleeping_similar: "◪",
  sleeping_void: "□",
  none: "·",
};

const GLYPH_CLASS: Record<MatrixRow["cells"][number], string> = {
  reports: "text-foreground",
  sleeping_similar: "text-[var(--stamp)]/70",
  sleeping_void: "text-[var(--stamp)] font-bold",
  none: "text-muted-foreground/25",
};

const TITLE: Record<MatrixRow["cells"][number], string> = {
  reports: "Reports capability in this class",
  sleeping_similar: "Sleeping on a mapped service; similar capability deployed",
  sleeping_void: "Sleeping on a mapped service; nothing similar deployed",
  none: "No reach, nothing reported",
};

export function CapabilityMatrix({
  categories,
  rows,
}: {
  categories: CapabilityCategory[];
  rows: MatrixRow[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 bg-background py-2 pr-3 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Agency
            </th>
            {categories.map((c) => (
              <th
                key={c}
                className="px-1 pb-2 text-center align-bottom font-mono text-[9.5px] uppercase tracking-[0.06em] text-muted-foreground"
              >
                <span className="inline-block max-w-[4.6rem] whitespace-normal leading-tight">
                  {CAPABILITY_LABELS[c]}
                </span>
              </th>
            ))}
            <th className="px-2 pb-2 text-right font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Voids
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {rows.map((r) => (
            <tr key={r.agency_abbr} className="hover:bg-muted/20">
              <th className="sticky left-0 bg-background py-1 pr-3 text-left font-mono text-[11px] font-medium text-foreground">
                <span title={r.agency_name}>{r.agency_abbr}</span>
              </th>
              {r.cells.map((cell, i) => (
                <td key={categories[i]} className="px-1 py-1 text-center">
                  <span
                    title={`${r.agency_abbr} × ${CAPABILITY_LABELS[categories[i]]}: ${TITLE[cell]}`}
                    className={`text-[14px] leading-none ${GLYPH_CLASS[cell]}`}
                  >
                    {GLYPH[cell]}
                  </span>
                </td>
              ))}
              <td className="px-2 py-1 text-right font-mono text-[10.5px] tabular-nums text-[var(--stamp)]">
                {r.void_count > 0 ? r.void_count : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
        {(Object.keys(GLYPH) as Array<MatrixRow["cells"][number]>).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className={`text-[13px] ${GLYPH_CLASS[s]}`}>{GLYPH[s]}</span>
            {TITLE[s]}
          </span>
        ))}
      </div>
    </div>
  );
}
