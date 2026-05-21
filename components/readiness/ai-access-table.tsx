import type { AgencyAiAccessCoverage, AgencyAiAccessRow } from "@/lib/types";

/**
 * The citable core of /readiness/access: one row per researched finding —
 * agency, tool, availability tier, the verbatim quote, and an outbound
 * source link. Findings with status "searched_no_source" render an explicit
 * "no public data" state rather than being hidden.
 */
const COVERAGE_CHIP: Record<AgencyAiAccessCoverage, string> = {
  all: "bg-emerald-100 text-emerald-900 border-emerald-300",
  most: "bg-teal-100 text-teal-900 border-teal-300",
  partial: "bg-amber-100 text-amber-900 border-amber-300",
  pilot: "bg-orange-100 text-orange-900 border-orange-300",
  latent: "bg-violet-100 text-violet-900 border-violet-300",
  unknown: "bg-stone-100 text-stone-700 border-stone-300",
  none: "bg-rose-100 text-rose-900 border-rose-300",
};

const COVERAGE_LABEL: Record<AgencyAiAccessCoverage, string> = {
  all: "All staff",
  most: "Most staff",
  partial: "Partial",
  pilot: "Pilot",
  latent: "Latent",
  unknown: "Scope unclear",
  none: "None / paused",
};

const CONFIDENCE_LABEL: Record<string, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

function CoverageChip({ value }: { value: AgencyAiAccessCoverage | null }) {
  const key = value ?? "unknown";
  return (
    <span
      className={`inline-block whitespace-nowrap border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] ${COVERAGE_CHIP[key]}`}
    >
      {COVERAGE_LABEL[key]}
    </span>
  );
}

export function AiAccessTable({ rows }: { rows: AgencyAiAccessRow[] }) {
  return (
    <div className="flex flex-col divide-y divide-stone-200 border border-stone-300">
      {rows.map((r) => {
        const isGap = r.status === "searched_no_source";
        return (
          <article
            key={r.id}
            className="grid grid-cols-1 gap-3 p-4 md:grid-cols-[8rem_1fr]"
          >
            {/* Left rail — agency + coverage */}
            <div className="flex flex-row items-baseline gap-2 md:flex-col md:items-start md:gap-2">
              <span className="font-mono text-sm font-semibold uppercase tracking-[0.06em] text-stone-900">
                {r.agency_abbreviation}
              </span>
              <CoverageChip value={r.coverage_assessment} />
            </div>

            {/* Right column — the finding */}
            <div className="flex flex-col gap-2">
              {r.tool_name ? (
                <span className="font-display italic text-[1.05rem] text-stone-900">
                  {r.tool_name}
                </span>
              ) : null}

              {/* Absolute scale — surfaced prominently: a "partial" tier can
                  still mean a five-figure userbase (DHS ~19,000). */}
              {r.estimated_users ? (
                <div className="flex items-baseline gap-2 border-l-2 border-stone-300 pl-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-stone-400">
                    Scale
                  </span>
                  <span className="font-mono text-xs text-stone-700">
                    {r.estimated_users}
                  </span>
                </div>
              ) : null}

              <p className="text-sm leading-snug text-stone-700">
                {r.finding}
              </p>

              {isGap ? (
                <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-stone-400">
                  No public deployment-scale data — researched, none found
                </p>
              ) : r.exact_quote ? (
                <blockquote className="border-l-2 border-stone-300 bg-stone-50 px-3 py-2 text-sm italic leading-snug text-stone-700">
                  &ldquo;{r.exact_quote}&rdquo;
                </blockquote>
              ) : null}

              {/* Source line */}
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[11px] text-stone-500">
                {r.source_url ? (
                  <a
                    href={r.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-stone-700 underline decoration-dotted underline-offset-2 hover:text-[var(--stamp)]"
                  >
                    {r.source_title ?? r.source_url} &#8599;
                  </a>
                ) : (
                  <span className="text-stone-400">no source</span>
                )}
                {r.source_date ? <span>{r.source_date}</span> : null}
                {r.confidence ? (
                  <span className="uppercase tracking-[0.1em]">
                    {CONFIDENCE_LABEL[r.confidence] ?? r.confidence}
                  </span>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
