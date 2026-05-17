"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function MonoLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </span>
  );
}

export function FilterGroup({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
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
        {title}
        <ChevronDown
          className={cn(
            "size-3 transition-transform",
            open ? "rotate-180" : "rotate-0",
          )}
          aria-hidden
        />
      </button>
      {open && <div className="flex flex-col gap-0.5">{children}</div>}
    </div>
  );
}

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
