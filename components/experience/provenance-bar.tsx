"use client";

import type { ProvenanceSlice } from "@/lib/experience-shared";

/**
 * What the headline rests on. Three 100%-stacked bars split the modeled seat
 * mass three ways — by what each band actually counts (employees, devices,
 * cases…), by the labeler's confidence, and by whether the row was
 * hand-audited. The point the third bar makes: every band ≥ 10,000 was audited
 * by hand, so the mass that moves the total most is the mass we checked most.
 */

/** Structural mirror of lib/db/experience/provenance.ts's ProvenanceRollup —
 *  defined here so this client component never imports the better-sqlite3
 *  module. Server pages pass the real rollup; the shapes match. */
export interface ProvenanceRollup {
  by_unit: ProvenanceSlice[];
  by_confidence: ProvenanceSlice[];
  by_audited: ProvenanceSlice[];
}

// Categorical fills in fixed order — assigned by slice position, never cycled.
const PALETTE = ["#b3361f", "#1f7a8c", "#d99a3e", "#94a3b8", "#4b5563", "#7c5cbf"];

const compact = (n: number) =>
  Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);

export function ProvenanceBar({ provenance }: { provenance: ProvenanceRollup }) {
  return (
    <div className="flex flex-col gap-5">
      <StackedRow title="By what the band counts" slices={provenance.by_unit} />
      <StackedRow title="By labeler confidence" slices={provenance.by_confidence} />
      <StackedRow title="By audit status" slices={provenance.by_audited} />
      <p className="text-[11px] leading-snug text-muted-foreground">
        Every filed band of 10,000 or more is 100% hand-audited — the largest
        contributions to the total are the ones we checked one by one, not
        sampled.
      </p>
    </div>
  );
}

function StackedRow({
  title,
  slices,
}: {
  title: string;
  slices: ProvenanceSlice[];
}) {
  const total = slices.reduce((sum, s) => sum + s.seats_mass, 0) || 1;
  const withPct = slices.map((s, i) => ({
    ...s,
    pct: (s.seats_mass / total) * 100,
    color: PALETTE[i % PALETTE.length],
  }));

  return (
    <div className="flex flex-col gap-1.5">
      <h4 className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </h4>
      {/* 100%-stacked bar; 2px surface gaps separate the segments. */}
      <div className="flex h-6 w-full gap-[2px]">
        {withPct.map((s) => (
          <div
            key={s.key}
            className="relative flex items-center justify-center overflow-hidden"
            style={{ width: `${s.pct}%`, background: s.color }}
            title={`${s.label}: ${s.seats_mass.toLocaleString("en-US")} (${s.pct.toFixed(0)}%)`}
          >
            {s.pct >= 10 ? (
              <span className="px-1 text-[10px] font-semibold tabular-nums text-white">
                {s.pct.toFixed(0)}%
              </span>
            ) : null}
          </div>
        ))}
      </div>
      {/* Legend carries every slice's label + absolute mass + share. */}
      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {withPct.map((s) => (
          <div key={s.key} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block size-2.5 shrink-0 rounded-[2px]"
              style={{ background: s.color }}
            />
            <dt className="text-foreground">{s.label}</dt>
            <dd className="tabular-nums">
              {compact(s.seats_mass)} · {s.pct.toFixed(0)}%
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
