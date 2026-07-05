import { Citation } from "@/components/citation";
import type { AgencyAiAccessCoverage, AgencyAiAccessRow } from "@/lib/types";

/**
 * The citable core of /readiness/access: one row per researched finding —
 * agency, tool, availability tier, the verbatim quote, and an outbound
 * source link. Findings with status "searched_no_source" render an explicit
 * "no public data" state rather than being hidden.
 */
const COVERAGE_CHIP: Record<AgencyAiAccessCoverage, string> = {
  all: "bg-[var(--verified)]/15 text-[var(--verified)] border-[var(--verified)]/40",
  most: "bg-[var(--verified)]/8 text-[var(--verified)] border-[var(--verified)]/25",
  partial: "bg-[var(--highlight)]/25 text-foreground border-[var(--highlight)]/50",
  pilot: "bg-[var(--highlight)]/15 text-foreground border-[var(--highlight)]/35",
  latent: "bg-muted text-muted-foreground border-border",
  unknown: "bg-muted text-muted-foreground border-border",
  none: "bg-[var(--stamp)]/15 text-[var(--stamp)] border-[var(--stamp)]/40",
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
    <div className="flex flex-col divide-y divide-border border border-border">
      {rows.map((r) => {
        const isGap = r.status === "searched_no_source";
        return (
          <article
            key={r.id}
            className="grid grid-cols-1 gap-3 p-4 md:grid-cols-[8rem_1fr]"
          >
            {/* Left rail — agency + coverage */}
            <div className="flex flex-row items-baseline gap-2 md:flex-col md:items-start md:gap-2">
              <span className="font-mono text-sm font-semibold uppercase tracking-[0.06em] text-foreground">
                {r.agency_abbreviation}
              </span>
              <CoverageChip value={r.coverage_assessment} />
            </div>

            {/* Right column — the finding */}
            <div className="flex flex-col gap-2">
              {r.tool_name ? (
                <span className="font-display italic text-[1.05rem] text-foreground">
                  {r.tool_name}
                </span>
              ) : null}

              {/* Absolute scale — surfaced prominently: a "partial" tier can
                  still mean a five-figure userbase (DHS ~19,000). */}
              {r.estimated_users ? (
                <div className="flex items-baseline gap-2 border-l-2 border-border pl-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/60">
                    Scale
                  </span>
                  <span className="font-mono text-xs text-foreground">
                    {r.estimated_users}
                  </span>
                </div>
              ) : null}

              <p className="text-sm leading-snug text-foreground">
                {r.finding}
              </p>

              {isGap ? (
                <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground/60">
                  No public deployment-scale data — researched, none found
                </p>
              ) : r.exact_quote ? (
                <blockquote className="border-l-2 border-border bg-muted/20 px-3 py-2 text-sm italic leading-snug text-foreground">
                  &ldquo;{r.exact_quote}&rdquo;
                </blockquote>
              ) : null}

              {/* Source line */}
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground">
                {r.source_url ? (
                  <Citation
                    url={r.source_url}
                    title={r.source_title}
                    date={r.source_date}
                    accessed={r.captured_at}
                  />
                ) : (
                  <span className="text-muted-foreground/60">no source</span>
                )}
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
