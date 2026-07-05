import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/formatting";

/**
 * StatTile — the one KPI/stat primitive.
 *
 * Consolidates the former MetricTile ("rule"), InsightCard ("boxed") and
 * StatCell ("cell") into a single component with a `variant` switch:
 *
 *   rule   — thick top rule, eyebrow label, italic display numeral.
 *            Grid-friendly; the default for hub-page KPI rows.
 *   boxed  — full bordered card with a big numeral, prose headline and
 *            mono subtext. For narrative stat cards (analytics, YoY).
 *   cell   — dense mono-labeled numeral for detail-page stat grids.
 *
 * All variants are link-aware via `href` (stamp hover, no underline).
 */

export type StatTileAccent =
  | "default"
  | "stamp"
  | "verified"
  | "ink"
  | "highlight";

const ACCENT_TEXT: Record<StatTileAccent, string> = {
  default: "text-foreground",
  stamp: "text-[var(--stamp)]",
  verified: "text-[var(--verified)]",
  ink: "text-foreground",
  highlight: "text-foreground bg-[var(--highlight)]/50",
};

export type StatTileProps = {
  /** Eyebrow (rule) or mono (cell) label. Unused by `boxed` (use headline). */
  label?: string;
  value: number | string;
  /** Mono small-print line under the value (rule) or headline (boxed). */
  sublabel?: ReactNode;
  /** Prose line under the value — boxed variant only. */
  headline?: ReactNode;
  /** Mono kicker above the value — boxed variant only. */
  kicker?: string;
  accent?: StatTileAccent;
  href?: string;
  variant?: "rule" | "boxed" | "cell";
  className?: string;
};

export function StatTile({
  label,
  value,
  sublabel,
  headline,
  kicker,
  accent = "default",
  href,
  variant = "rule",
  className,
}: StatTileProps) {
  const display =
    typeof value === "number" ? formatNumber(value) : value || "—";

  if (variant === "boxed") {
    const base = cn(
      "flex h-full flex-col border border-border bg-background p-5",
      href
        ? "transition-colors hover:ring-1 hover:ring-[var(--stamp)] hover:text-[var(--stamp)]"
        : null,
      className,
    );
    const body = (
      <>
        {kicker ? (
          <div
            className={cn(
              "mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.18em]",
              accent === "default" ? "text-foreground" : ACCENT_TEXT[accent],
            )}
          >
            {kicker}
          </div>
        ) : null}
        <div className="border-t-2 border-foreground pt-4">
          <span className="block font-display italic text-[3.2rem] leading-[0.9] tracking-[-0.02em] text-foreground tabular-nums">
            {display}
          </span>
          {headline ? (
            <p className="mt-3 text-[0.95rem] leading-snug text-foreground">
              {headline}
            </p>
          ) : null}
          {sublabel ? (
            <p className="mt-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
              {sublabel}
            </p>
          ) : null}
        </div>
      </>
    );
    if (href) {
      return (
        <Link href={href} className={cn(base, "block")}>
          {body}
        </Link>
      );
    }
    return <figure className={base}>{body}</figure>;
  }

  if (variant === "cell") {
    const inner = (
      <>
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </div>
        <div
          className={cn(
            "mt-1 font-display text-[2.2rem] leading-none tabular-nums transition-colors md:text-[2.8rem]",
            ACCENT_TEXT[accent],
            href ? "group-hover:text-[var(--stamp)]" : null,
          )}
        >
          {display}
        </div>
        {sublabel ? (
          <div className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
            {sublabel}
          </div>
        ) : null}
      </>
    );
    if (href) {
      return (
        <Link href={href} className={cn("group block", className)}>
          {inner}
        </Link>
      );
    }
    return <div className={className}>{inner}</div>;
  }

  // "rule" — the MetricTile look.
  const inner = (
    <>
      <div className="eyebrow truncate">{label}</div>
      <div
        className={cn(
          "font-display text-[2.2rem] leading-[0.95] tracking-[-0.02em] italic transition-colors",
          ACCENT_TEXT[accent],
          href ? "group-hover:text-[var(--stamp)]" : null,
        )}
      >
        <span className="tabular-nums">{display}</span>
      </div>
      {sublabel ? (
        <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
          {sublabel}
        </div>
      ) : null}
    </>
  );
  const ruleClass = cn(
    "flex min-w-0 flex-col gap-1 border-t-2 border-foreground pt-2",
    className,
  );
  if (href) {
    return (
      <Link href={href} className={cn("group", ruleClass)}>
        {inner}
      </Link>
    );
  }
  return <div className={cn("group", ruleClass)}>{inner}</div>;
}
