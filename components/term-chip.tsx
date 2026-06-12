"use client";

/**
 * TermChip — a MonoChip-style badge that reveals its definition in place.
 *
 * Hover (desktop) or tap (touch) opens a small popover with the term's
 * definition, an OMB/IFP provenance marker, and an optional "see all
 * uses →" link. Use wherever a tag value, tier, or status chip appears
 * outside the use-case detail page, so readers can learn what a term
 * means without leaving the page they're on.
 *
 * Definitions come from `lib/definitions.ts` — pass a `TermDefinition`
 * (e.g. `MATURITY_TIER_DEFS[tier]`, `LINEAGE_STATUS_DEFS[status]`, or
 * `termDefinition(dimension, value)`).
 */

import Link from "next/link";
import type { ReactNode } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  CHIP_BASE,
  CHIP_SIZING,
  CHIP_TONE,
  type ChipSize,
  type ChipTone,
} from "@/lib/chip-styles";
import type { TermDefinition } from "@/lib/definitions";

export function TermChip({
  children,
  term,
  href,
  hrefLabel = "See all uses →",
  tone = "ink",
  size = "xs",
  className,
  variant = "chip",
}: {
  /** Chip display text. */
  children: ReactNode;
  term: TermDefinition;
  /** Optional "see all uses" target (a filtered explorer URL). */
  href?: string;
  hrefLabel?: string;
  tone?: ChipTone;
  size?: ChipSize;
  /** REPLACES the tone classes (border/text/bg) when provided — use for
   *  custom-colored badges like the readiness tier bands. */
  className?: string;
  /** "chip" (default) renders the MonoChip-style badge; "text" renders
   *  the children unboxed with a dotted definition underline — use inside
   *  eyebrows / stat-card labels where a bordered chip would clash. */
  variant?: "chip" | "text";
}) {
  const provenanceLabel = term.source === "omb" ? "OMB-filed" : "IFP-derived";
  const toneClasses = className || CHIP_TONE[tone];
  const triggerClasses =
    variant === "text"
      ? `inline-flex cursor-help items-center underline decoration-muted-foreground/50 decoration-dotted underline-offset-4 ${className ?? ""}`
      : `${CHIP_BASE} cursor-help ${CHIP_SIZING[size]} ${toneClasses}`;
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={250}
        className={triggerClasses}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent
        className="w-80 max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[0.85rem] leading-snug text-popover-foreground">
          {term.definition}
        </p>
        <div className="flex items-baseline justify-between gap-3 border-t border-border pt-1.5">
          <span
            className={`font-mono text-[9px] uppercase tracking-[0.12em] ${
              term.source === "derived"
                ? "text-[var(--stamp)]"
                : "text-muted-foreground"
            }`}
          >
            {provenanceLabel}
          </span>
          {href ? (
            <Link
              href={href}
              className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground underline-offset-2 hover:text-[var(--stamp)] hover:underline"
            >
              {hrefLabel}
            </Link>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * TermLinkChip — a chip that NAVIGATES on click (like TagChip) and reveals
 * its definition on hover. Used by `TagChip` when `defined` is set; the
 * popover carries the definition + provenance, the chip itself stays a
 * normal link to the filtered explorer.
 */
export function TermLinkChip({
  children,
  term,
  href,
  title,
  tone = "ink",
  size = "xs",
}: {
  children: ReactNode;
  term: TermDefinition;
  href: string;
  title?: string;
  tone?: ChipTone;
  size?: ChipSize;
}) {
  const provenanceLabel = term.source === "omb" ? "OMB-filed" : "IFP-derived";
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={250}
        nativeButton={false}
        render={
          <Link
            href={href}
            title={title}
            className={`${CHIP_BASE} ${CHIP_SIZING[size]} ${CHIP_TONE[tone]}`}
          />
        }
      >
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-80 max-w-[90vw]">
        <p className="text-[0.85rem] leading-snug text-popover-foreground">
          {term.definition}
        </p>
        <div className="flex items-baseline justify-between gap-3 border-t border-border pt-1.5">
          <span
            className={`font-mono text-[9px] uppercase tracking-[0.12em] ${
              term.source === "derived"
                ? "text-[var(--stamp)]"
                : "text-muted-foreground"
            }`}
          >
            {provenanceLabel}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            Click chip to browse →
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
