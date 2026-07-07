/**
 * Bureau-divergence figure: one dot per scored bureau, filled (stamp) when that
 * bureau independently clears the enterprise-LLM bar, hollow when scored but
 * without it. The unit-chart form makes "8 of 8" vs "0 of 14" vs the bimodal
 * "2 of 18" legible at a glance — and shows that enterprise access is decided
 * bureau-by-bureau, below the department.
 *
 * Rows are sorted by enterprise-LLM share (then bureaus scored), so the
 * federated-high parents (HHS, ED) sit at the top and the uniform-zero parents
 * (DOJ, DOI, …) at the bottom — the department-level bimodality is itself the
 * point. Pure presentational Server Component (capture-stable).
 */

import type { BureauDivergenceRow } from "@/lib/db";

const STAMP = "var(--stamp)";

function LevelTag({ level }: { level: string }) {
  // Only flag parents that aren't top-level departments, so the reader knows
  // NASA is an independent agency and CMS/FDA are themselves opdivs whose own
  // offices are being counted.
  if (level === "department") return null;
  const label = level === "sub_agency" ? "opdiv" : level;
  return (
    <span className="block font-mono text-[8.5px] uppercase tracking-[0.1em] text-muted-foreground/80">
      {label}
    </span>
  );
}

function DotStrip({ scored, filled }: { scored: number; filled: number }) {
  return (
    <div
      className="flex flex-wrap items-center gap-1"
      role="img"
      aria-label={`${filled} of ${scored} scored bureaus have enterprise LLM`}
    >
      {Array.from({ length: scored }).map((_, i) => {
        const on = i < filled;
        return (
          <span
            key={i}
            aria-hidden
            className="inline-block h-3 w-3 rounded-[2px]"
            style={
              on
                ? { background: STAMP }
                : {
                    background: "transparent",
                    boxShadow: "inset 0 0 0 1.5px var(--border)",
                  }
            }
          />
        );
      })}
    </div>
  );
}

export function BureauDivergenceChart({
  rows,
}: {
  rows: BureauDivergenceRow[];
}) {
  return (
    <div className="flex flex-col gap-5">
      <ul className="flex flex-col divide-y divide-border">
        {rows.map((r) => (
          <li
            key={`${r.parentAbbr}-${r.parentName}`}
            className="grid grid-cols-[92px_minmax(0,1fr)_150px] items-start gap-3 py-2.5"
          >
            <div className="pt-0.5">
              <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.04em] text-foreground">
                {r.parentAbbr}
              </span>
              <LevelTag level={r.parentLevel} />
            </div>

            <div className="pt-0.5">
              <DotStrip scored={r.scored} filled={r.withEnterpriseLLM} />
            </div>

            <div className="text-right">
              <span className="font-mono text-[13px] tabular-nums text-foreground">
                <span style={{ color: r.withEnterpriseLLM > 0 ? STAMP : undefined }}>
                  {r.withEnterpriseLLM}
                </span>
                <span className="text-muted-foreground">/{r.scored}</span>
              </span>
              <span className="ml-1 font-mono text-[10px] tabular-nums text-muted-foreground">
                · {r.withCoding} cod
              </span>
              {r.enterpriseLLMBureaus.length > 0 && (
                <span className="mt-0.5 block truncate font-mono text-[9.5px] uppercase tracking-[0.06em] text-muted-foreground">
                  {r.enterpriseLLMBureaus.join(", ")}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-3 w-3 rounded-[2px]"
            style={{ background: STAMP }}
          />
          Bureau with enterprise LLM
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-3 w-3 rounded-[2px]"
            style={{ boxShadow: "inset 0 0 0 1.5px var(--border)" }}
          />
          Scored, no enterprise LLM
        </span>
        <span className="normal-case tracking-normal">
          Each square = one scored bureau · “cod” = bureaus with coding
          assistants.
        </span>
      </div>
    </div>
  );
}
