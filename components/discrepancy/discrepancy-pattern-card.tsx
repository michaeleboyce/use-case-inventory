/**
 * One pattern card on /discrepancies.
 *
 * Renders a detected DiscrepancyPattern as a parchment-tinted forensic
 * card: kind chip, agency abbreviation, serif title, hypothesis, sample
 * audit IDs, and a CTA link to the pre-filtered table view.
 */
import Link from "next/link";
import type { DiscrepancyPattern, DiscrepancyPatternKind } from "@/lib/types";

const KIND_LABEL: Record<DiscrepancyPatternKind, string> = {
  consolidation: "Consolidation",
  bureau_split: "Bureau split",
  omb_duplicate_cluster: "OMB duplicate",
  name_drift_cluster: "Name drift",
};

export function DiscrepancyPatternCard({
  pattern,
}: {
  pattern: DiscrepancyPattern;
}) {
  return (
    <article className="border border-border bg-[var(--highlight)]/10 p-5 flex flex-col gap-3 transition-colors hover:ring-1 hover:ring-[var(--stamp)]">
      <div className="flex items-center justify-between gap-2">
        <span className="bg-foreground text-background px-1.5 py-0.5 text-[10px] uppercase tracking-wider font-mono">
          {KIND_LABEL[pattern.kind]}
        </span>
        <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
          {pattern.agency}
        </span>
      </div>
      <h3 className="font-display text-lg text-foreground leading-snug">
        {pattern.title}
      </h3>
      <p className="text-sm text-foreground leading-snug">
        {pattern.hypothesis}
      </p>
      <p className="font-mono text-xs text-muted-foreground">
        Audit IDs:{" "}
        {pattern.sample_audit_ids.map((id) => `#${id}`).join(", ")}
      </p>
      <Link
        href={pattern.filter_url}
        className="text-sm font-medium text-foreground hover:underline mt-auto"
      >
        Open {pattern.count} rows →
      </Link>
    </article>
  );
}
