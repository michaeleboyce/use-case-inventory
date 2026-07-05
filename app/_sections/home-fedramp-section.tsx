/**
 * § VII teaser — the FedRAMP cross-reference. New in the front-door
 * rebuild: the entire /fedramp sub-area (17 routes) previously had no
 * entry point from home.
 */
import Link from "next/link";
import { Section } from "@/components/editorial";
import { StatTile } from "@/components/stat-tile";
import type { AiClassificationCounts } from "@/lib/types/fedramp";

export function HomeFedrampSection({
  kicker,
  counts,
}: {
  kicker: string;
  counts: AiClassificationCounts;
}) {
  const totalAi = counts.core_ai + counts.ai_featured;
  return (
    <Section
      number={kicker}
      title="FedRAMP, cross-referenced"
      lede="The cloud-authorization marketplace, checked against what agencies actually report using."
      source="derived"
    >
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
        <StatTile
          label="AI products on the shelf"
          value={totalAi}
          sublabel="classified AI in the marketplace"
          href="/fedramp"
        />
        <StatTile
          label="Linked to the inventory"
          value={counts.ai_linked}
          sublabel="named by at least one agency"
          accent="verified"
          href="/fedramp/coverage"
        />
        <StatTile
          label="Absent from every inventory"
          value={counts.ai_unlinked}
          sublabel={`${counts.ai_unlinked_authorized} fully authorized`}
          accent="stamp"
          href="/fedramp/coverage/unlinked-ai"
        />
        <StatTile
          label="The marketplace mirror"
          value="→"
          sublabel="products · providers · agencies · 3PAOs"
          href="/fedramp/marketplace"
        />
      </div>
      <p className="mt-4 max-w-prose font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/80">
        &ldquo;AI&rdquo; is counted two different ways here (by linkage vs by
        classification) —{" "}
        <Link
          href="/fedramp/coverage"
          className="underline decoration-dotted underline-offset-2 transition-colors hover:text-[var(--stamp)]"
        >
          read the definitions before comparing numbers
        </Link>
        .
      </p>
    </Section>
  );
}
