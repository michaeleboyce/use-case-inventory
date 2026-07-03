/**
 * /stories — route-local card primitives.
 *
 * StoryCard renders one agency portrait as a 2024 → 2025 "then/now" pair
 * with an optional coda, an IFP coverage stamp, and a "See the data" chip
 * row. EvidenceTag is the small stamped confidence marker (agency-reported,
 * inventory-only, uncorroborated, …) used inline within card copy.
 */

import type { ReactNode } from "react";
import { MonoChip } from "@/components/editorial";

export function EvidenceTag({
  children,
  title,
}: {
  children: ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className="mx-0.5 inline-block translate-y-[-1px] border border-border px-1 py-px align-middle font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--stamp)]"
    >
      {children}
    </span>
  );
}

export interface StoryChip {
  label: string;
  href: string;
}

export function StoryCard({
  agency,
  persona,
  coverage,
  then2024,
  now2025,
  coda,
  chips,
}: {
  agency: string;
  persona: string;
  /** IFP coverage-of-eligible-staff estimate, preformatted (e.g. "~95%"). */
  coverage?: string;
  then2024: ReactNode;
  now2025: ReactNode;
  coda?: ReactNode;
  chips: StoryChip[];
}) {
  return (
    <article className="mt-6 border border-border bg-card p-5 md:p-6">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-lg font-semibold text-foreground">{agency}</h3>
        <span className="text-sm italic text-muted-foreground">{persona}</span>
        {coverage ? (
          <span
            className="ml-auto font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--stamp)]"
            title="IFP estimate of the share of AI-eligible staff with access to a general-purpose LLM tool. See Readiness → AI Access & Scale for method."
          >
            IFP est. coverage: {coverage} of eligible staff
          </span>
        ) : null}
      </header>

      <div className="mt-4 grid gap-5 md:grid-cols-2">
        <div>
          <div className="border-b border-border pb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            2024
          </div>
          <div className="mt-2 space-y-2 text-[15px] leading-relaxed text-foreground">
            {then2024}
          </div>
        </div>
        <div>
          <div className="border-b border-border pb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            2025
          </div>
          <div className="mt-2 space-y-2 text-[15px] leading-relaxed text-foreground">
            {now2025}
          </div>
        </div>
      </div>

      {coda ? (
        <div className="mt-4 border-l-2 border-[var(--stamp)] pl-3 text-[15px] leading-relaxed text-foreground">
          {coda}
        </div>
      ) : null}

      <footer className="mt-4 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          See the data
        </span>
        {chips.map((chip) => (
          <MonoChip key={chip.href + chip.label} href={chip.href} tone="stamp" size="xs">
            {chip.label}
          </MonoChip>
        ))}
      </footer>
    </article>
  );
}
