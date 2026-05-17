import Link from "next/link";

/**
 * Big-number presentation for the Readiness Index headline. Two variants:
 *
 *   "big"     — full hero treatment for /readiness; massive italic numeric,
 *               serif label, mono caption, optional permalink anchor.
 *   "inline"  — compact form for use inside a homepage section without
 *               crowding adjacent content; same data, tighter scale.
 *
 * The component is intentionally presentation-only — callers compute and
 * pass the value (typically from `getHeadlineStats()` in lib/readiness.ts).
 */
export function ReadinessHeadlineStat({
  value,
  unit = "",
  label,
  caption,
  variant = "big",
  href,
}: {
  /** The numeric statistic. Rendered with `tabular-nums`; the caller decides
   *  precision (e.g. pass 92 not 91.7 if you want a whole-number hero). */
  value: number;
  /** Optional unit suffix (typically "%"). Rendered immediately after the
   *  number with no space. */
  unit?: "%" | "";
  /** Plain-language description of what the number means. Required. */
  label: string;
  /** Optional smaller-print explainer rendered below the label. */
  caption?: string;
  variant?: "big" | "inline";
  /** Optional permalink — methodology page anchor, typically. Rendered as
   *  "permalink ↗" affordance to the right of the caption. */
  href?: string;
}) {
  const display = `${value.toLocaleString("en-US", {
    maximumFractionDigits: value % 1 === 0 ? 0 : 1,
  })}${unit}`;

  if (variant === "inline") {
    return (
      <div className="flex items-baseline gap-3">
        <span className="font-display italic text-[2.8rem] leading-[0.95] tracking-[-0.02em] text-foreground tabular-nums">
          {display}
        </span>
        <span className="max-w-prose text-sm leading-snug text-foreground/80">
          {label}
        </span>
        {href ? (
          <Link
            href={href}
            className="ml-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-[var(--stamp)]"
          >
            permalink ↗
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="border-y-2 border-foreground py-6 md:py-10">
      <div className="grid grid-cols-12 gap-x-6">
        <div className="col-span-12 md:col-span-5">
          <span
            className="block font-display italic leading-[0.85] tracking-[-0.03em] text-foreground tabular-nums text-[clamp(4rem,12vw,9rem)]"
            aria-label={`${display} — ${label}`}
          >
            {display}
          </span>
        </div>
        <div className="col-span-12 mt-4 md:col-span-7 md:mt-0 md:self-end">
          <p className="font-display text-[1.4rem] italic leading-tight text-foreground md:text-[1.7rem]">
            {label}
          </p>
          {caption ? (
            <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {caption}
              {href ? (
                <>
                  {" · "}
                  <Link
                    href={href}
                    className="underline decoration-dotted underline-offset-4 hover:text-[var(--stamp)]"
                  >
                    permalink ↗
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
