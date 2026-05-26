"use client";

/**
 * Sticky `?agency=ABBR` filter chip + select for /fedramp/coverage/*.
 *
 * Renders as a compact row: label, native `<select>` populated with all
 * agencies that have inventory data, optional clear button, and a small
 * "fetching…" indicator while the server re-fetches.
 *
 * Writes the selection via `router.replace` (preserves the other URL
 * params so impact-level chips on /products still work) and wraps in
 * `useTransition` so React can surface a `pending` state. We use that
 * pending state to (a) disable the select while in flight and (b) dim
 * the table beneath via a CSS data-attribute the page can hook into —
 * the dropdown itself can't reach the table, so we communicate via
 * `document.body.dataset.coveragePending` which the table opt-in
 * checks.  (No-op if the table doesn't bother.)
 *
 * The transition typically resolves in well under a frame for cached
 * navigations and ~150-400ms for cold queries; the indicator is meant
 * for the cold-query case so the user doesn't second-guess their click.
 */

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useTransition } from "react";

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
  const [isPending, startTransition] = useTransition();

  // Broadcast pending state via a body data-attribute so the page below
  // can dim its main results without prop-drilling through every server
  // wrapper. Cleared after the transition completes.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (isPending) {
      document.body.dataset.coveragePending = "1";
    } else {
      delete document.body.dataset.coveragePending;
    }
    return () => {
      if (typeof document !== "undefined") {
        delete document.body.dataset.coveragePending;
      }
    };
  }, [isPending]);

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
    <div
      className="flex flex-wrap items-baseline gap-2 border-b border-border pb-3"
      data-pending={isPending ? "1" : undefined}
    >
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
        disabled={isPending}
        className="border border-border bg-background px-2 py-1 font-mono text-[12px] text-foreground hover:border-foreground focus:border-[var(--stamp)] focus:outline-none disabled:cursor-wait disabled:opacity-60"
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
          disabled={isPending}
          className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--stamp)] hover:underline disabled:cursor-wait disabled:opacity-60"
        >
          clear filter
        </button>
      ) : null}
      {isPending ? (
        <span
          role="status"
          aria-live="polite"
          className="ml-1 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--stamp)]"
        >
          <span
            aria-hidden
            className="inline-block size-2 animate-pulse rounded-full bg-[var(--stamp)]"
          />
          fetching…
        </span>
      ) : null}
    </div>
  );
}
