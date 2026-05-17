"use client";

/**
 * Use-case-filter-specific controls.
 *
 * Shared visual primitives (`MonoLabel`, `FilterGroup`, `CheckRow`) live in
 * `@/components/ui/filter-primitives` and are re-exported from here so
 * existing call sites in this directory keep a stable import path.
 *
 * `EntryKindToggle` is use-case specific (individual / consolidated / all
 * map to the OMB-rollup distinction in the use_cases table) and stays
 * local.
 */

import { cn } from "@/lib/utils";

export {
  CheckRow,
  FilterGroup,
  MonoLabel,
} from "@/components/ui/filter-primitives";

export function EntryKindToggle({
  value,
  onChange,
}: {
  value: "individual" | "consolidated" | "all";
  onChange: (v: "individual" | "consolidated" | "all") => void;
}) {
  const opts: Array<{
    v: "individual" | "consolidated" | "all";
    label: string;
  }> = [
    { v: "individual", label: "Individual" },
    { v: "consolidated", label: "Consolidated" },
    { v: "all", label: "All" },
  ];
  return (
    <div className="inline-flex w-full divide-x divide-border border border-border">
      {opts.map((o) => {
        const active = o.v === value;
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            aria-pressed={active}
            className={cn(
              "flex-1 px-2 py-1 text-center font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
              active
                ? "bg-foreground text-background"
                : "bg-transparent text-muted-foreground hover:text-[var(--stamp)]",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
