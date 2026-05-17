import Link from "next/link";
import type { ReadinessTierSummaryRow } from "@/lib/readiness";

/**
 * Five horizontal bands (A → F) rendering the readiness tier rollup as a
 * league-table visualization. Empty bands still render with a "0 agencies"
 * placeholder so the visual stays grounded even when (as at v1.0 launch) no
 * agency reaches the Frontier-Ready or Operational tiers.
 *
 * Each agency chip deep-links to /agencies/[slug]#scorecard for the
 * per-agency scorecard rendered by Agent B.
 */
const TIER_ACCENT: Record<string, string> = {
  A: "bg-emerald-600",
  B: "bg-blue-600",
  C: "bg-amber-600",
  D: "bg-orange-600",
  F: "bg-rose-700",
};

export function ReadinessTierBand({
  tiers,
}: {
  tiers: ReadinessTierSummaryRow[];
}) {
  return (
    <ol className="flex flex-col gap-2">
      {tiers.map((tier) => (
        <li
          key={tier.tier}
          className="flex items-stretch border border-stone-300 bg-background"
        >
          {/* Left accent stripe — subtle color signal per tier */}
          <div
            aria-hidden
            className={`w-1.5 shrink-0 ${TIER_ACCENT[tier.tier] ?? "bg-stone-400"}`}
          />
          {/* Tier letter + label column */}
          <div className="flex w-24 shrink-0 flex-col items-center justify-center border-r border-stone-300 bg-stone-100 p-3">
            <div className="font-display text-3xl italic text-stone-900">
              {tier.tier}
            </div>
            <div className="mt-1 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-stone-500">
              {tier.label}
            </div>
            <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-stone-400 tabular-nums">
              {tier.count} {tier.count === 1 ? "agency" : "agencies"}
            </div>
          </div>
          {/* Agency chip row */}
          <div className="flex flex-1 flex-wrap items-center gap-1.5 p-3">
            {tier.count === 0 ? (
              <span className="font-mono text-xs uppercase tracking-[0.14em] text-stone-400">
                0 agencies in this tier
              </span>
            ) : (
              tier.agencies.map((abbr) => (
                <Link
                  key={abbr}
                  href={`/agencies/${abbr.toLowerCase()}#scorecard`}
                  className="border border-stone-200 bg-white px-2 py-1 font-mono text-xs uppercase tracking-[0.06em] text-stone-700 transition-colors hover:border-stone-900 hover:bg-stone-50 hover:text-stone-900"
                >
                  {abbr}
                </Link>
              ))
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
