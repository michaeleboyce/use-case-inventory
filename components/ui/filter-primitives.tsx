"use client";

/**
 * Shared visual primitives for filter sidebars.
 *
 * Dumb, presentational, stateless. State management (URL params, client
 * filtering, etc.) stays in each filter component because the three filter
 * pages have different execution models (server-driven URL state for use
 * cases, single-URL-param + client filtering for products, pure-client for
 * templates).
 *
 * Currently consumed by `components/use-case/filters/`. Available for any
 * future filter UI that wants the same editorial look — hairline-ruled
 * collapsible sections with mono uppercase eyebrows and compact check rows.
 */

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MonoChip,
  SOURCE_CHIP,
  SOURCE_TITLE,
  type SectionSource,
} from "@/components/editorial";

export function MonoLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </span>
  );
}

export function SourceChip({ source }: { source: SectionSource }) {
  const chip = SOURCE_CHIP[source];
  return (
    <MonoChip tone={chip.tone} size="xs" title={SOURCE_TITLE[source]}>
      {chip.label}
    </MonoChip>
  );
}

export function FilterGroup({
  title,
  children,
  defaultOpen = true,
  source,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  source?: SectionSource;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between gap-2 text-left font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">{title}</span>
          {source ? <SourceChip source={source} /> : null}
        </span>
        <ChevronDown
          className={cn(
            "size-3 shrink-0 transition-transform",
            open ? "rotate-180" : "rotate-0",
          )}
          aria-hidden
        />
      </button>
      {open && <div className="flex flex-col gap-0.5">{children}</div>}
    </div>
  );
}

export function CheckRow({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2 px-1 py-1 text-[13px] transition-colors",
        "hover:text-[var(--stamp)]",
        checked && "text-foreground",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="size-3.5 rounded-none border border-border text-foreground focus:ring-1 focus:ring-ring"
      />
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </label>
  );
}
