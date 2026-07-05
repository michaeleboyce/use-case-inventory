import Link from "next/link";
import { DefinitionCallout } from "@/components/definition-callout";

/**
 * The canonical two-sentence reconciliation of the site's two agency
 * scoring systems. Placed wherever maturity tiers and readiness grades
 * appear near each other (/agencies, /readiness, agency detail) so the
 * apparent contradiction — an agency can be Leading AND grade F — reads
 * as a finding, not an error. Full prose: /about#maturity-vs-readiness.
 */
export function MaturityVsReadinessNote({
  className = "mt-8",
}: {
  className?: string;
}) {
  return (
    <DefinitionCallout
      title="Two agency scores, on purpose"
      aside={
        <Link
          href="/about#maturity-vs-readiness"
          className="transition-colors hover:text-[var(--stamp)]"
        >
          Full reconciliation →
        </Link>
      }
      source="derived"
      className={className}
    >
      <p className="max-w-prose">
        Maturity tiers (Leading → Minimal) describe{" "}
        <em>what an agency filed</em> — a breadth heuristic over its
        inventory. Readiness grades (A–F) score <em>how it filed</em> against
        a published rubric. An agency can be Leading and still grade F; the
        gap is the distance between adopting AI and being institutionally
        ready to run it.
      </p>
    </DefinitionCallout>
  );
}
