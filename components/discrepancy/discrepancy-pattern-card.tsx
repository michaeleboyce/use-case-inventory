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
    <article className="border border-stone-300 bg-[#f6efdf] p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between gap-2">
        <span className="bg-stone-800 text-stone-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wider font-mono">
          {KIND_LABEL[pattern.kind]}
        </span>
        <span className="font-mono text-xs text-stone-600 uppercase tracking-wider">
          {pattern.agency}
        </span>
      </div>
      <h3 className="font-display text-lg text-stone-900 leading-snug">
        {pattern.title}
      </h3>
      <p className="text-sm text-stone-700 leading-snug">
        {pattern.hypothesis}
      </p>
      <p className="font-mono text-xs text-stone-500">
        Audit IDs:{" "}
        {pattern.sample_audit_ids.map((id) => `#${id}`).join(", ")}
      </p>
      <Link
        href={pattern.filter_url}
        className="text-sm font-medium text-stone-900 hover:underline mt-auto"
      >
        Open {pattern.count} rows →
      </Link>
    </article>
  );
}
