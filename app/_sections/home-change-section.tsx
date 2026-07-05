/**
 * § V teaser — what changed between the 2024 and 2025 cycles. New in the
 * front-door rebuild: the year-over-year story previously had no entry
 * point from home at all.
 */
import Link from "next/link";
import { Section } from "@/components/editorial";
import { StatTile } from "@/components/stat-tile";
import { formatNumber, formatYoY } from "@/lib/formatting";
import type { YoyHeadline } from "../_view-model";

export function HomeChangeSection({
  kicker,
  yoy,
}: {
  kicker: string;
  yoy: YoyHeadline;
}) {
  return (
    <Section
      number={kicker}
      title="What changed"
      lede="The 2024 → 2025 cycle in three numbers — and the entries that vanished without a trace."
      source="omb-derived"
    >
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
        <StatTile
          label="Use cases filed"
          value={`${formatNumber(yoy.count2024)} → ${formatNumber(yoy.count2025)}`}
          sublabel="2024 → 2025 cycles"
          href="/compare-years"
        />
        <StatTile
          label="Net change"
          value={
            yoy.pctChange != null
              ? formatYoY(yoy.pctChange)
              : formatNumber(yoy.delta)
          }
          sublabel={`${yoy.delta >= 0 ? "+" : ""}${formatNumber(yoy.delta)} entries`}
          accent="stamp"
          href="/compare-years"
        />
        <StatTile
          label="Silently dropped GenAI"
          value={yoy.droppedGenAiDistinct}
          sublabel="live 2024 capabilities, no 2025 trace"
          accent="highlight"
          href="/compare-years/silently-dropped"
        />
        <StatTile
          label="Full analytics"
          value="→"
          sublabel="adoption, market share, reach"
          href="/analytics"
        />
      </div>
      <p className="mt-4 max-w-prose font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/80">
        Cycle taxonomies differ — see the{" "}
        <Link
          href="/compare-years"
          className="underline decoration-dotted underline-offset-2 transition-colors hover:text-[var(--stamp)]"
        >
          comparison methodology and caveats
        </Link>
        .
      </p>
    </Section>
  );
}
