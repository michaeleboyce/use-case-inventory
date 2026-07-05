"use client";

import * as React from "react";
import Link from "next/link";
import { MATRIX_PRODUCT_BUCKETS, type AgencyToolMatrixRow } from "@/lib/experience-shared";
import { cn } from "@/lib/utils";

/**
 * Expandable per-agency drill-down rendered below the §04 seat charts. Top
 * N agencies by filed-band seats; each row is a <details> the reader can
 * open to see up to ~6 example use cases that contributed (consolidated
 * Appendix B and individual M-25-21 Filing entries mixed).
 *
 * Click into any entry to land on the use-case detail page. Same data flow
 * as the §03 matrix popover, but always-visible — closer to the seat
 * numbers it explains, so readers don't have to discover the hover.
 */
export function SeatsAgencyDetails({
  rows,
  limit = 12,
}: {
  rows: AgencyToolMatrixRow[];
  limit?: number;
}) {
  const sorted = [...rows]
    .filter((r) => Object.keys(r.cells).length > 0)
    .sort((a, b) => b.estimated_seats_filed - a.estimated_seats_filed)
    .slice(0, limit);

  if (sorted.length === 0) return null;

  return (
    <div className="mt-8 border-t border-border pt-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        Drill in · example use cases per agency
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Click any agency to see up to six example filings that contributed
        to its seat counts. Each entry links to the use-case detail.
      </p>
      <div className="mt-4 divide-y divide-border/50">
        {sorted.map((row) => (
          <AgencyDetails key={row.agency_id} row={row} />
        ))}
      </div>
    </div>
  );
}

function AgencyDetails({ row }: { row: AgencyToolMatrixRow }) {
  const allEntries = collectEntries(row);
  // Up to 6 — prefer consolidated rows by band desc, then unsubsumed
  // use_case filings.
  const examples = allEntries.slice(0, 6);
  const totalEntries = allEntries.length;

  return (
    <details className="group/details py-2">
      <summary className="flex cursor-pointer list-none items-baseline justify-between gap-4 py-1 hover:bg-accent/30">
        <span className="flex items-baseline gap-2">
          <span className="font-mono text-xs font-semibold">
            {row.abbreviation}
          </span>
          <span className="text-xs text-muted-foreground">{row.name}</span>
          <span className="font-mono text-[10px] text-muted-foreground/70">
            ({totalEntries} filing{totalEntries === 1 ? "" : "s"})
          </span>
        </span>
        <span className="flex items-baseline gap-4 font-mono text-xs tabular-nums">
          <span>
            <span className="text-muted-foreground">filed </span>
            {row.estimated_seats_filed > 0
              ? row.estimated_seats_filed.toLocaleString()
              : "—"}
          </span>
          <span>
            <span className="text-muted-foreground">headcount </span>
            {row.estimated_seats_headcount != null
              ? row.estimated_seats_headcount.toLocaleString()
              : "—"}
          </span>
          <span
            aria-hidden
            className="font-mono text-[9px] text-muted-foreground transition-transform group-open/details:rotate-180"
          >
            ▾
          </span>
        </span>
      </summary>
      <div className="ml-4 mt-2 space-y-2">
        {row.headcount_breakdown ? (
          <p className="text-[11px] italic text-muted-foreground">
            Headcount math: {row.headcount_breakdown}.
          </p>
        ) : null}
        {examples.map((e) => (
          <ExampleRow key={`${e.source}-${e.row_id}-${e.bucketKey}`} entry={e} />
        ))}
        {totalEntries > examples.length ? (
          <p className="text-[11px] text-muted-foreground">
            …{totalEntries - examples.length} more not shown.
          </p>
        ) : null}
      </div>
    </details>
  );
}

type FlatEntry = {
  source: "consolidated" | "use_case";
  subsumed: boolean;
  row_id: number;
  slug: string | null;
  title: string;
  commercial_product: string;
  band_label: string | null;
  bucketKey: string;
};

function collectEntries(row: AgencyToolMatrixRow): FlatEntry[] {
  const out: FlatEntry[] = [];
  const seen = new Set<string>();
  for (const bucket of MATRIX_PRODUCT_BUCKETS) {
    const cell = row.cells[bucket.key];
    if (!cell) continue;
    for (const e of cell.entries) {
      const dedupeKey = `${e.source}-${e.row_id}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      out.push({ ...e, bucketKey: bucket.key });
    }
  }
  // consolidated first, then by band desc, unsubsumed before subsumed.
  out.sort((a, b) => {
    if (a.source !== b.source) return a.source === "consolidated" ? -1 : 1;
    if (a.subsumed !== b.subsumed) return a.subsumed ? 1 : -1;
    return bandUpper(b.band_label) - bandUpper(a.band_label);
  });
  return out;
}

function bandUpper(band: string | null): number {
  if (!band) return 0;
  if (band === "50,000+") return 100000;
  if (band === "10,000-50,000") return 50000;
  if (band === "5001-10,000") return 10000;
  if (band === "1001-5000") return 5000;
  if (band === "101-1000") return 1000;
  if (band === "1-100") return 100;
  return 0;
}

function ExampleRow({ entry }: { entry: FlatEntry }) {
  const sourceLabel =
    entry.source === "consolidated" ? "Appendix B" : "Filing";
  const tone =
    entry.source === "consolidated"
      ? "bg-muted text-muted-foreground"
      : "bg-[var(--highlight)]/15 text-foreground border border-[var(--highlight)]/30";

  const content = (
    <>
      <span className="flex items-baseline gap-2">
        <span
          className={cn(
            "inline-block px-1 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]",
            tone,
          )}
        >
          {sourceLabel}
        </span>
        <span
          className={cn(
            "flex-1 text-xs leading-snug",
            entry.subsumed ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {entry.title}
        </span>
        <span className="whitespace-nowrap font-mono text-[10px] text-muted-foreground">
          {entry.band_label ?? "no band"}
        </span>
      </span>
      {entry.commercial_product ? (
        <span className="block pl-[3.5rem] pt-0.5 text-[11px] text-muted-foreground">
          {entry.commercial_product}
        </span>
      ) : null}
    </>
  );

  if (entry.slug) {
    return (
      <Link
        href={`/use-cases/${entry.slug}`}
        className="block px-2 py-1.5 hover:bg-accent focus:bg-accent focus:outline-none"
      >
        {content}
      </Link>
    );
  }
  return <span className="block px-2 py-1.5">{content}</span>;
}
