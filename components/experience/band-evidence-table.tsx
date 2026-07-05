"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ExpandableTable } from "@/components/expandable-table";
import {
  UNIT_COUNTED_LABELS,
  type LabelConfidence,
  type UnitCounted,
} from "@/lib/experience-shared";
import { STRATUM_COLORS } from "./stratum-bar";

/**
 * The audit trail behind the seat model — one expandable row per labeled band.
 * Collapsed row: the use case, its filed band, what the band counts, the
 * population it applies to, its seat stratum, the labeler's confidence, and
 * whether it was hand-audited. Expanded: the full title, the labeler's
 * reasoning, the contributing product families, and the audit status. This is
 * the evidence table the headline points back to, so every value is on the
 * page (never gated behind a tooltip) and the whole set is searchable.
 *
 * Structurally mirrors lib/db/experience's LabeledBandRow so server pages can
 * pass those rows straight through without this client component importing the
 * better-sqlite3 module. Exported under both names for the importing pages.
 */
export interface BandEvidenceRow {
  agency_id: number;
  abbreviation: string;
  agency_name: string;
  slug: string;
  title: string;
  band_label: string;
  band_lower: number;
  band_mid: number;
  band_upper: number;
  unit_counted: UnitCounted;
  population: string;
  org_scope: string;
  stratum: string;
  confidence: LabelConfidence;
  reasoning: string | null;
  audited: number;
  families: string | null;
}

export type LabeledBandRow = BandEvidenceRow;

const CONFIDENCE_LABEL: Record<string, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

function StratumChip({ stratum }: { stratum: string }) {
  const color = STRATUM_COLORS[stratum] ?? "#a1a1aa";
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.06em]"
      style={{ color }}
    >
      <span
        aria-hidden
        className="inline-block size-2 rounded-[2px]"
        style={{ background: color }}
      />
      {stratum}
    </span>
  );
}

function UnitChip({ unit }: { unit: UnitCounted }) {
  return (
    <span className="whitespace-nowrap border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
      {UNIT_COUNTED_LABELS[unit] ?? unit}
    </span>
  );
}

const columns: ColumnDef<BandEvidenceRow, unknown>[] = [
  {
    id: "title",
    accessorKey: "title",
    header: "Use case",
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="block max-w-[24rem] truncate font-medium text-foreground">
          {row.original.title}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
          {row.original.abbreviation}
        </span>
      </div>
    ),
  },
  {
    id: "band",
    accessorKey: "band_mid",
    header: "Band",
    cell: ({ row }) => (
      <span className="whitespace-nowrap font-mono text-xs text-foreground">
        {row.original.band_label}
      </span>
    ),
  },
  {
    id: "unit",
    accessorKey: "unit_counted",
    header: "Counts",
    cell: ({ row }) => <UnitChip unit={row.original.unit_counted} />,
  },
  {
    id: "population",
    accessorKey: "population",
    header: "Population",
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">
        {row.original.population}
      </span>
    ),
  },
  {
    id: "stratum",
    accessorKey: "stratum",
    header: "Stratum",
    cell: ({ row }) => <StratumChip stratum={row.original.stratum} />,
  },
  {
    id: "confidence",
    accessorKey: "confidence",
    header: "Conf.",
    cell: ({ row }) => (
      <span className="font-mono text-[11px] text-muted-foreground">
        {CONFIDENCE_LABEL[row.original.confidence] ?? row.original.confidence}
      </span>
    ),
  },
  {
    id: "audited",
    accessorKey: "audited",
    header: "Audited",
    cell: ({ row }) =>
      row.original.audited ? (
        <span className="text-[var(--verified,#1f7a8c)]" aria-label="hand-audited">
          ✓
        </span>
      ) : (
        <span className="text-muted-foreground" aria-label="not audited">
          —
        </span>
      ),
  },
];

function renderExpanded(row: BandEvidenceRow) {
  const families = (row.families ?? "")
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);
  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {row.agency_name} · {row.abbreviation}
        </div>
        <p className="mt-0.5 text-sm font-medium text-foreground">{row.title}</p>
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
        <Field label="Filed band">
          {row.band_label} ({row.band_lower.toLocaleString("en-US")}–
          {row.band_upper.toLocaleString("en-US")}, midpoint{" "}
          {row.band_mid.toLocaleString("en-US")})
        </Field>
        <Field label="Org scope">{row.org_scope}</Field>
        <Field label="What it counts">
          {UNIT_COUNTED_LABELS[row.unit_counted] ?? row.unit_counted}
        </Field>
        <Field label="Population">{row.population}</Field>
      </dl>

      {row.reasoning ? (
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Labeler reasoning
          </div>
          <p className="mt-1 text-sm leading-snug text-foreground">
            {row.reasoning}
          </p>
        </div>
      ) : null}

      {families.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Families
          </span>
          {families.map((f) => (
            <span
              key={f}
              className="border border-border bg-muted/40 px-1.5 py-0.5 text-[11px] text-foreground"
            >
              {f}
            </span>
          ))}
        </div>
      ) : null}

      <div className="font-mono text-[11px] text-muted-foreground">
        {row.audited
          ? "Hand-audited by a reviewer."
          : "LLM-labeled; not individually audited (below the 10k audit threshold)."}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </dt>
      <dd className="text-foreground">{children}</dd>
    </div>
  );
}

export function BandEvidenceTable({ rows }: { rows: BandEvidenceRow[] }) {
  return (
    <ExpandableTable<BandEvidenceRow>
      rows={rows}
      columns={columns}
      getRowKey={(r) => `${r.agency_id}:${r.slug}`}
      renderExpanded={renderExpanded}
      numericColumnIds={["band", "audited"]}
      align="top"
      searchable={{
        placeholder: "Filter by use case, agency, stratum…",
        matches: (r, q) =>
          r.title.toLowerCase().includes(q) ||
          r.abbreviation.toLowerCase().includes(q) ||
          r.agency_name.toLowerCase().includes(q) ||
          r.stratum.toLowerCase().includes(q) ||
          (r.families ?? "").toLowerCase().includes(q),
      }}
      pageSize={25}
      tableClassName="min-w-[880px]"
      initialSorting={[{ id: "band", desc: true }]}
      emptyMessage="No labeled bands."
    />
  );
}
