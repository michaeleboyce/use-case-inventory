"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * FilterSelect — the editorial labeled select for filter strips.
 *
 * Promoted from the `LabeledSelect` proven in components/agencies-table.tsx:
 * mono small-caps label, underline-only trigger (no box, zero radius),
 * shadcn Select underneath so keyboard/touch behavior is consistent.
 * Use this instead of a native `<select>` in any filter row.
 */
export function FilterSelect({
  label,
  value,
  onChange,
  options,
  minWidth = "140px",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  minWidth?: string;
}) {
  return (
    <label className="inline-flex items-center gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <Select
        value={value}
        onValueChange={(v: string | null) => onChange(v ?? "")}
      >
        <SelectTrigger
          style={{ minWidth }}
          className="h-8 rounded-none border-0 border-b border-border bg-transparent font-mono text-[11px] uppercase tracking-[0.08em] shadow-none focus-visible:border-foreground"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem
              key={o.value}
              value={o.value}
              className="font-mono text-[11px] uppercase tracking-[0.08em]"
            >
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
