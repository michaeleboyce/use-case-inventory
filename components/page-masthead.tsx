import type { ReactNode } from "react";

/**
 * PageMasthead — the canonical editorial page header.
 *
 * Every top-level page opens with the same anatomy: a left meta rail
 * (stamp-colored kicker, mono context lines, optional filing meta) and a
 * headline column (display h1, optional lede with drop-cap). Before this
 * component existed each page hand-rolled the block with its own h1
 * clamp(); the two `size` presets replace that drift.
 *
 *   hero      — front-door scale (home, essays).
 *   standard  — every other page.
 *
 * The masthead owns the header's internal rhythm and bottom rule; the page
 * container still owns outer padding (`max-w-[1400px] px-4 md:px-8` +
 * vertical padding).
 */

const SIZE_CLASS: Record<"hero" | "standard", string> = {
  hero: "text-[clamp(2.8rem,7.5vw,6.4rem)]",
  standard: "text-[clamp(2.4rem,6vw,5rem)]",
};

export function PageMasthead({
  kicker,
  metaLines = [],
  meta,
  title,
  lede,
  dropCap = false,
  actions,
  size = "standard",
  italicTitle = true,
  id,
}: {
  /** Stamp-colored eyebrow in the left rail, e.g. "§ VI · Policy". */
  kicker: string;
  /** Mono small-caps context lines under the kicker. */
  metaLines?: string[];
  /** Extra left-rail content below the meta lines (filing stats, stamp). */
  meta?: ReactNode;
  title: ReactNode;
  /** Lede paragraph. Pass a string with `dropCap` for the drop-cap treatment. */
  lede?: ReactNode;
  dropCap?: boolean;
  /** Rendered below the lede (export buttons, sub-nav chips). */
  actions?: ReactNode;
  size?: "hero" | "standard";
  italicTitle?: boolean;
  id?: string;
}) {
  const ledeIsString = typeof lede === "string";
  const showDropCap = dropCap && ledeIsString && (lede as string).length > 1;

  return (
    <header
      id={id}
      className="ink-in grid scroll-mt-36 grid-cols-12 gap-x-6 border-b border-border pb-12 md:pb-16"
    >
      <aside className="col-span-12 mb-8 md:col-span-3 md:mb-0">
        <div className="sticky top-32 space-y-4">
          <div>
            <div className="eyebrow mb-1.5 !text-[var(--stamp)]">{kicker}</div>
            {metaLines.map((line) => (
              <div
                key={line}
                className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground"
              >
                {line}
              </div>
            ))}
          </div>
          {meta}
        </div>
      </aside>

      <div className="col-span-12 md:col-span-9">
        <h1
          className={`font-display ${italicTitle ? "italic" : ""} ${SIZE_CLASS[size]} leading-[0.95] tracking-[-0.02em] text-foreground`}
        >
          {title}
        </h1>
        {lede ? (
          <p className="mt-8 max-w-prose text-[1.05rem] leading-[1.55] text-foreground/85">
            {showDropCap ? (
              <>
                <span className="float-left mr-2 font-display italic text-[3.6rem] leading-[0.82] text-foreground">
                  {(lede as string).charAt(0)}
                </span>
                {(lede as string).slice(1)}
              </>
            ) : (
              lede
            )}
          </p>
        ) : null}
        {actions ? <div className="mt-6">{actions}</div> : null}
      </div>
    </header>
  );
}
