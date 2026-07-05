/**
 * "How to read this inventory" — the front door's definitional band.
 * Front-loads the three facts a first-time reader needs before any of
 * the numbers below make sense: individual vs consolidated entries,
 * OMB-filed vs IFP-derived provenance, and the two agency scoring
 * systems (maturity tiers vs readiness grades).
 */
import Link from "next/link";
import {
  DefinitionCallout,
  DefinitionTile,
} from "@/components/definition-callout";
import { SourceLegend } from "@/components/editorial";
import { formatNumber } from "@/lib/formatting";
import type { HomeViewModel } from "../_view-model";

export function HomeHowToRead({ stats }: { stats: HomeViewModel["stats"] }) {
  return (
    <DefinitionCallout
      title="How to read this inventory — before the numbers"
      aside={
        <Link
          href="/about"
          className="transition-colors hover:text-[var(--stamp)]"
        >
          Methods &amp; Sources →
        </Link>
      }
      className="mt-10"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <DefinitionTile label="Individual vs consolidated entries">
          Agencies filed {formatNumber(stats.total_use_cases)} individual use
          cases plus {formatNumber(stats.total_consolidated)} consolidated
          entries (one row standing for many small deployments). Counts on
          this site say which they include; IFP tags cover individual entries
          only.
        </DefinitionTile>
        <DefinitionTile label="OMB-filed vs IFP-derived" emphasis>
          Some fields come verbatim from the agency&rsquo;s OMB filing; others
          (tags, product links, maturity tiers) were computed by IFP. Every
          section is chipped with its provenance — watch for the OMB / IFP
          markers.
        </DefinitionTile>
        <DefinitionTile label="Two agency scores, on purpose">
          Maturity tiers (Leading → Minimal) are a breadth heuristic over
          what an agency filed. Readiness grades (A–F) score how it filed
          against a published rubric. An agency can be Leading and still
          grade F — the gap is informative, not an error.
        </DefinitionTile>
      </div>
      <SourceLegend className="mt-4" />
    </DefinitionCallout>
  );
}
