/**
 * Shared Tailwind class fragments for the monospace chip family
 * (`MonoChip` in components/editorial.tsx, `TermChip`/`TermLinkChip` in
 * components/term-chip.tsx). Kept as raw literals so the Tailwind JIT can
 * see them. Pure module — importable from server and client components.
 */

export const CHIP_BASE =
  "inline-flex items-center border bg-background font-mono font-semibold uppercase tracking-[0.06em] transition-colors";

export type ChipSize = "xs" | "sm" | "md";

export const CHIP_SIZING: Record<ChipSize, string> = {
  xs: "px-1.5 py-0.5 text-[10px]",
  sm: "px-2 py-0.5 text-[11px]",
  md: "px-2.5 py-1 text-[12px]",
};

export type ChipTone = "ink" | "stamp" | "verified" | "muted";

export const CHIP_TONE: Record<ChipTone, string> = {
  ink: "border-border text-foreground hover:border-foreground",
  stamp:
    "border-border text-foreground hover:border-[var(--stamp)] hover:text-[var(--stamp)]",
  verified:
    "border-border text-foreground hover:border-[var(--verified)] hover:text-[var(--verified)]",
  muted: "border-border text-muted-foreground hover:text-foreground",
};

/** The fully-assembled chip class string. */
export function chipClasses(
  tone: ChipTone = "ink",
  size: ChipSize = "sm",
): string {
  return `${CHIP_BASE} ${CHIP_SIZING[size]} ${CHIP_TONE[tone]}`;
}
