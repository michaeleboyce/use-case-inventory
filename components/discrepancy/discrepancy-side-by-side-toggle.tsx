"use client";

/**
 * Client wrapper for the side-by-side diff table that gates whether
 * non-drifted rows are visible. Renders:
 *   1. The toggle <button>, placed in the table-header area by the parent.
 *   2. A scoped <style> block that hides non-drifted rows (rows the parent
 *      tagged with `data-drift="0"`) when "drift-only" mode is on.
 *
 * Implemented as a CSS class flip rather than re-rendering children so the
 * row markup stays a server-rendered table — no client serialization cost
 * for the diff segments themselves.
 */
import * as React from "react";

type ToggleProps = {
  defaultDriftOnly: boolean;
  nonDriftCount: number;
};

/** Placed inside the table header. Owns the toggle state and emits a
 *  CSS hook on the nearest ancestor that scopes row visibility. */
export function DriftToggleWrapper({ defaultDriftOnly, nonDriftCount }: ToggleProps) {
  const [showAll, setShowAll] = React.useState(!defaultDriftOnly);
  const buttonRef = React.useRef<HTMLButtonElement | null>(null);

  React.useEffect(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const scope = btn.closest(".drift-toggle-scope");
    if (!scope) return;
    if (showAll) {
      scope.classList.remove("drift-only");
    } else {
      scope.classList.add("drift-only");
    }
  }, [showAll]);

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={() => setShowAll((v) => !v)}
      className="text-xs font-mono text-muted-foreground hover:text-foreground"
    >
      {showAll ? "Hide non-drifted fields" : `Show all fields (${nonDriftCount} more)`}
    </button>
  );
}
