"use client";

/**
 * Sticky `?agency=ABBR` filter chip + select for /fedramp/coverage/*.
 *
 * Renders as a compact row with a label, native `<select>` populated with
 * all agencies that have inventory data (passed via props from the server
 * page), and a "clear" affordance when a filter is active. Writes the
 * selection via `router.replace` preserving the other URL params so
 * impact-level chips on /products still work.
 */

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";

export interface CoverageAgencyOption {
  abbreviation: string;
  name: string;
}

export function CoverageAgencyFilter({
  options,
  /** The agency abbreviation currently in `?agency=`, or null. */
  value,
}: {
  options: CoverageAgencyOption[];
  value: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const update = (next: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next == null || next === "") {
      params.delete("agency");
    } else {
      params.set("agency", next);
    }
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  };

  return (
    <div className="flex flex-wrap items-baseline gap-2 border-b border-border pb-3">
      <label
        htmlFor="coverage-agency-filter"
        className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
      >
        Filter by agency
      </label>
      <select
        id="coverage-agency-filter"
        value={value ?? ""}
        onChange={(e) => update(e.target.value || null)}
        className="border border-border bg-background px-2 py-1 font-mono text-[12px] text-foreground hover:border-foreground focus:border-[var(--stamp)] focus:outline-none"
      >
        <option value="">All agencies</option>
        {options.map((o) => (
          <option key={o.abbreviation} value={o.abbreviation}>
            {o.abbreviation} · {o.name}
          </option>
        ))}
      </select>
      {value ? (
        <button
          type="button"
          onClick={() => update(null)}
          className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--stamp)] hover:underline"
        >
          clear filter
        </button>
      ) : null}
    </div>
  );
}
