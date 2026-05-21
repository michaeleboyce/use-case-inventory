import type { AgencyAiAccessCoverage, AgencyAiAccessRow } from "@/lib/types";

/**
 * Six horizontal bands (all → none) rendering AI-tool availability across the
 * CFO Act agencies as a league-table visualization. Each agency is placed in
 * its BEST (most available) tier, so an agency appears once even when it has
 * multiple tool findings. `coverage_assessment` is an AVAILABILITY measure —
 * who can use the tool, not who actively does.
 */
const BANDS: Array<{
  key: AgencyAiAccessCoverage;
  label: string;
  blurb: string;
  accent: string;
}> = [
  {
    key: "all",
    label: "All staff",
    blurb: "Available to the entire agency workforce",
    accent: "bg-emerald-600",
  },
  {
    key: "most",
    label: "Most staff",
    blurb: "Available to a clear majority, rollout still completing",
    accent: "bg-teal-600",
  },
  {
    key: "partial",
    label: "Partial",
    blurb: "A defined subset only — HQ, certain components, or trained users",
    accent: "bg-amber-600",
  },
  {
    key: "pilot",
    label: "Pilot",
    blurb: "A limited test or demonstrator deployment",
    accent: "bg-orange-600",
  },
  {
    key: "latent",
    label: "Latent",
    blurb:
      "Copilot Chat reachable via existing Microsoft 365 licensing — no deliberate rollout",
    accent: "bg-violet-500",
  },
  {
    key: "unknown",
    label: "Scope unclear",
    blurb: "A deployment exists but its availability scope is not public",
    accent: "bg-stone-500",
  },
  {
    key: "none",
    label: "None / paused",
    blurb: "No general-purpose AI tool available to staff",
    accent: "bg-rose-700",
  },
];

const COVERAGE_RANK: Record<string, number> = {
  all: 0,
  most: 1,
  partial: 2,
  pilot: 3,
  latent: 4,
  unknown: 5,
  none: 6,
};

export function AiAccessCoverageBand({ rows }: { rows: AgencyAiAccessRow[] }) {
  // Place each agency in its best (most-available) tier.
  const bestByAgency = new Map<string, number>();
  for (const r of rows) {
    const rank = COVERAGE_RANK[r.coverage_assessment ?? "unknown"] ?? 4;
    const prev = bestByAgency.get(r.agency_abbreviation);
    if (prev === undefined || rank < prev) {
      bestByAgency.set(r.agency_abbreviation, rank);
    }
  }
  const byBand = new Map<AgencyAiAccessCoverage, string[]>();
  for (const [abbr, rank] of bestByAgency) {
    const key = BANDS[rank].key;
    const arr = byBand.get(key) ?? [];
    arr.push(abbr);
    byBand.set(key, arr);
  }

  return (
    <ol className="flex flex-col gap-2">
      {BANDS.map((band) => {
        const agencies = (byBand.get(band.key) ?? []).sort();
        return (
          <li
            key={band.key}
            className="flex items-stretch border border-stone-300 bg-background"
          >
            <div
              aria-hidden
              className={`w-1.5 shrink-0 ${band.accent}`}
            />
            <div className="flex w-36 shrink-0 flex-col justify-center border-r border-stone-300 bg-stone-100 p-3">
              <div className="font-display text-xl italic leading-tight text-stone-900">
                {band.label}
              </div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-stone-400 tabular-nums">
                {agencies.length}{" "}
                {agencies.length === 1 ? "agency" : "agencies"}
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-2 p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-stone-500">
                {band.blurb}
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                {agencies.length === 0 ? (
                  <span className="font-mono text-xs uppercase tracking-[0.14em] text-stone-400">
                    none
                  </span>
                ) : (
                  agencies.map((abbr) => (
                    <span
                      key={abbr}
                      className="border border-stone-200 bg-white px-2 py-1 font-mono text-xs uppercase tracking-[0.06em] text-stone-700"
                    >
                      {abbr}
                    </span>
                  ))
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
