import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * EmptyState — the one way a section says "nothing here".
 *
 * Replaces the ad-hoc empties scattered across the app (bare `<li>No
 * data.</li>`, full `<Section title="No data">` blocks, em-dash prose).
 *
 *   boxed — dashed-ruled panel for page/section-level empties.
 *   bare  — inline mono line for list items and table cells.
 */
export function EmptyState({
  title,
  message,
  action,
  variant = "boxed",
  className,
}: {
  title?: string;
  message: ReactNode;
  action?: { href: string; label: string };
  variant?: "boxed" | "bare";
  className?: string;
}) {
  const body = (
    <>
      {title ? (
        <div className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground">
          {title}
        </div>
      ) : null}
      <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        <span aria-hidden>— </span>
        {message}
      </div>
      {action ? (
        <Link
          href={action.href}
          className="mt-3 inline-block font-mono text-[11px] uppercase tracking-[0.14em] text-foreground underline decoration-dotted underline-offset-4 transition-colors hover:text-[var(--stamp)]"
        >
          {action.label} →
        </Link>
      ) : null}
    </>
  );

  if (variant === "bare") {
    return <div className={cn("py-2", className)}>{body}</div>;
  }
  return (
    <div
      className={cn(
        "border border-dashed border-border px-6 py-10 text-center",
        className,
      )}
    >
      {body}
    </div>
  );
}
