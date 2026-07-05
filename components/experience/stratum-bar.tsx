"use client";

import {
  STRATA,
  STRATUM_LABELS,
  type AgencySeatModel,
  type Stratum,
} from "@/lib/experience-shared";

/**
 * Per-agency nested composition of the stratified-overlap seat model — hand
 * built (no recharts) so the geometry maps exactly to the methodology:
 *
 *   • the outer envelope is the agency's AI-eligible workforce (the model's
 *     hard cap — no stratum can reach more people than this);
 *   • each stratum draws a component bar sized by its coverage share
 *     (min(reach, occupation-cap) / eligible), so the reader sees which
 *     role populations drive the union and which saturate their own ceiling;
 *   • a floor / central / ceiling interval rides over the envelope — the
 *     actual people-with-≥1-AI-tool estimate the components combine into.
 *
 * Unmodeled agencies (no workforce denominator) can't be placed on the
 * eligible scale, so we fall back to the raw filed-band range with an
 * explicit "band range only" note rather than inventing a coverage share.
 */

/** Stratum fill map — shared with band-evidence-table.tsx so the two views
 *  stay in lockstep. Keyed loosely because consolidated_band_labels can carry
 *  "excluded_not_seats" alongside the seat strata. */
export const STRATUM_COLORS: Record<string, string> = {
  general: "#b3361f",
  technical: "#1f7a8c",
  legal: "#d99a3e",
  investigative: "#4b5563",
  comms: "#94a3b8",
  clinical: "#7c5cbf",
  excluded_not_seats: "#a1a1aa",
};

const compact = (n: number) =>
  Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);

const exact = (n: number) => n.toLocaleString("en-US");

export function StratumBar({ agency }: { agency: AgencySeatModel }) {
  if (!agency.modeled || agency.eligible == null) {
    return <UnmodeledBand agency={agency} />;
  }

  const eligible = agency.eligible;
  const pct = (v: number | null) =>
    v == null ? 0 : Math.min(100, Math.max(0, (v / eligible) * 100));

  const floor = agency.floor ?? 0;
  const central = agency.central ?? 0;
  const ceiling = agency.ceiling ?? 0;

  // Strata that actually contribute, largest share first.
  const strata = [...agency.strata]
    .filter((s) => s.reach > 0)
    .sort((a, b) => b.share - a.share);

  return (
    <div className="flex flex-col gap-3">
      <Header agency={agency} eligible={eligible} central={central} />

      {/* Envelope = eligible workforce; the interval is the model estimate. */}
      <div>
        <div
          className="relative h-9 w-full border border-border bg-muted/40"
          role="img"
          aria-label={`${exact(central)} of ${exact(eligible)} eligible estimated to hold at least one AI tool`}
        >
          {/* floor..ceiling interval */}
          <div
            className="absolute inset-y-0"
            style={{
              left: `${pct(floor)}%`,
              width: `${Math.max(0, pct(ceiling) - pct(floor))}%`,
              background: "color-mix(in srgb, #b3361f 18%, transparent)",
              borderLeft: "1px solid #b3361f",
              borderRight: "1px solid #b3361f",
            }}
          />
          {/* central dot */}
          <div
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${pct(central)}%` }}
          >
            <span
              className="block size-3 rounded-full ring-2"
              style={{
                background: "#b3361f",
                // surface ring keeps the dot legible over the interval fill
                boxShadow: "0 0 0 2px var(--background)",
              }}
            />
          </div>
        </div>
        {/* interval labels */}
        <div className="mt-1 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
          <span>
            At least{" "}
            <span className="tabular-nums text-foreground">{compact(floor)}</span>
          </span>
          <span>
            Best estimate{" "}
            <span className="tabular-nums font-semibold text-[var(--stamp,#b3361f)]">
              {compact(central)}
            </span>
          </span>
          <span>
            At most{" "}
            <span className="tabular-nums text-foreground">{compact(ceiling)}</span>
          </span>
        </div>
      </div>

      {/* Stratum component bars, on the same eligible scale. */}
      <dl className="flex flex-col gap-2">
        {strata.map((s) => {
          const width = Math.min(100, s.share * 100);
          return (
            <div key={s.stratum} className="grid grid-cols-[7.5rem_1fr] items-center gap-2">
              <dt className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                <span
                  aria-hidden
                  className="inline-block size-2.5 shrink-0 rounded-[2px]"
                  style={{ background: STRATUM_COLORS[s.stratum] ?? "#a1a1aa" }}
                />
                {s.stratum}
              </dt>
              <dd className="min-w-0">
                <div className="relative h-4 w-full bg-muted/30">
                  <div
                    className="absolute inset-y-0 left-0"
                    style={{
                      width: `${width}%`,
                      background: STRATUM_COLORS[s.stratum] ?? "#a1a1aa",
                    }}
                  />
                </div>
                <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-[11px] leading-tight text-muted-foreground">
                  <span className="tabular-nums text-foreground">
                    {(s.share * 100).toFixed(0)}%
                  </span>
                  <span className="truncate">{s.winning_family}</span>
                  {s.saturated ? (
                    <span className="whitespace-nowrap border border-[#b3361f]/40 bg-[#b3361f]/10 px-1 font-mono text-[9px] uppercase tracking-[0.06em] text-[#b3361f]">
                      band ≥ population ceiling
                    </span>
                  ) : null}
                </div>
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

function Header({
  agency,
  eligible,
  central,
}: {
  agency: AgencySeatModel;
  eligible: number;
  central: number;
}) {
  const share = eligible > 0 ? (central / eligible) * 100 : 0;
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-sm font-semibold uppercase tracking-[0.06em] text-foreground">
          {agency.abbreviation}
        </span>
        <span className="text-sm text-muted-foreground">{agency.name}</span>
      </div>
      <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
        <span className="tabular-nums text-foreground">{exact(eligible)}</span> eligible ·{" "}
        <span className="tabular-nums text-foreground">{share.toFixed(0)}%</span> reached
      </div>
    </div>
  );
}

function UnmodeledBand({ agency }: { agency: AgencySeatModel }) {
  const lower = agency.raw_band_lower;
  const upper = agency.raw_band_upper;
  const pct = (v: number) => (upper > 0 ? Math.min(100, (v / upper) * 100) : 0);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-sm font-semibold uppercase tracking-[0.06em] text-foreground">
          {agency.abbreviation}
        </span>
        <span className="text-sm text-muted-foreground">{agency.name}</span>
      </div>
      <div className="relative h-6 w-full border border-dashed border-border bg-muted/30">
        <div
          className="absolute inset-y-0"
          style={{
            left: `${pct(lower)}%`,
            width: `${Math.max(0, pct(upper) - pct(lower))}%`,
            background: "color-mix(in srgb, #94a3b8 30%, transparent)",
          }}
        />
      </div>
      <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
        <span className="tabular-nums text-foreground">{compact(lower)}</span>
        <span className="tabular-nums text-foreground">{compact(upper)}</span>
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground">
        No workforce denominator — band range only. Filed license bands span{" "}
        {exact(lower)}–{exact(upper)}, but without an AI-eligible headcount we
        can&apos;t place this agency on the coverage scale or fold its strata
        into the people-level union.
      </p>
    </div>
  );
}

/** Color key + one-line meaning for each seat stratum. */
export function StratumLegend() {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-xs leading-relaxed text-muted-foreground sm:grid-cols-2">
      {STRATA.map((stratum: Stratum) => (
        <div key={stratum} className="flex gap-2">
          <span
            aria-hidden
            className="mt-1 inline-block size-2.5 shrink-0 rounded-[2px]"
            style={{ background: STRATUM_COLORS[stratum] }}
          />
          <div>
            <dt className="inline font-medium capitalize text-foreground">
              {stratum}.
            </dt>{" "}
            <dd className="inline">{STRATUM_LABELS[stratum]}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}
