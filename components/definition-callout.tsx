import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  MonoChip,
  SOURCE_CHIP,
  SOURCE_TITLE,
  type SectionSource,
} from "@/components/editorial";

/**
 * DefinitionCallout — a "read before the numbers" band.
 *
 * Generalizes the pattern proven on /fedramp/coverage (the "ways to be
 * 'AI'" explainer): a ruled panel that front-loads the definitional facts
 * a reader needs before the figures below make sense — individual vs
 * consolidated, tag provenance, which of two competing metrics a page
 * shows, and so on.
 *
 * Children are the definitional prose (or a grid of definition tiles);
 * `aside` renders small print on the right of the title row.
 */
export function DefinitionCallout({
  title,
  children,
  aside,
  source,
  id,
  className,
}: {
  /** Band heading, e.g. "How to read this inventory". */
  title: string;
  children: ReactNode;
  /** Mono small print on the right of the title row (live counts, links). */
  aside?: ReactNode;
  /** Optional OMB/IFP provenance chip after the title. */
  source?: SectionSource;
  id?: string;
  className?: string;
}) {
  return (
    <aside
      id={id}
      className={cn(
        "scroll-mt-36 border border-border bg-muted/20 p-5",
        className,
      )}
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--stamp)]">
          {title}
          {source ? (
            <span className="ml-2 align-baseline normal-case">
              <MonoChip
                tone={SOURCE_CHIP[source].tone}
                size="xs"
                title={SOURCE_TITLE[source]}
              >
                {SOURCE_CHIP[source].label}
              </MonoChip>
            </span>
          ) : null}
        </p>
        {aside ? (
          <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
            {aside}
          </p>
        ) : null}
      </div>
      <div className="text-[0.9rem] leading-[1.5] text-foreground/85">
        {children}
      </div>
    </aside>
  );
}

/**
 * One definition tile for use inside a DefinitionCallout grid — mirrors
 * the bordered tiles of the coverage page's AiDefinitionBand.
 */
export function DefinitionTile({
  label,
  children,
  emphasis = false,
}: {
  label: string;
  children: ReactNode;
  /** Foreground border + stamp label for the definition readers most miss. */
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        "border p-4",
        emphasis ? "border-foreground" : "border-border",
      )}
    >
      <p
        className={cn(
          "mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em]",
          emphasis ? "text-[var(--stamp)]" : "text-muted-foreground",
        )}
      >
        {label}
      </p>
      <p className="text-[0.9rem] leading-[1.5] text-foreground/85">
        {children}
      </p>
    </div>
  );
}
