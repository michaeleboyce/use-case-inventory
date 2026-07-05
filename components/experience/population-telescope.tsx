"use client";

/**
 * The population telescope — one unified, interactive picture of the three
 * nested populations behind the seat estimate:
 *
 *   everyone who works at these agencies
 *     ⊃ people whose jobs could use an AI tool (the eligible workforce)
 *         ⊃ people we estimate actually have one (drawn as an honest
 *           at-least → at-most band with the best estimate marked)
 *
 * All three layers share one scale, so the visual containment IS the
 * arithmetic. A selector flips between the government-wide view and any
 * modeled agency; widths animate so the proportions stay comparable.
 */

import * as React from "react";
import Link from "next/link";
import type { AgencySeatModel } from "@/lib/experience-shared";

const STAMP = "#b3361f";
const TEAL = "#1f7a8c";

const exact = (n: number) => n.toLocaleString("en-US");
const compact = (n: number) =>
  Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
const pct = (num: number, den: number) =>
  den > 0 ? `${Math.round((num / den) * 100)}%` : "—";

interface View {
  key: string;
  label: string;
  /** Everyone employed in scope (feds + contractors where bands include them). */
  workforce: number;
  eligible: number;
  floor: number;
  central: number;
  ceiling: number;
  includesContractors: boolean;
  agencyHref: string | null;
}

function workforceOf(a: AgencySeatModel): number {
  const base = a.total_headcount ?? 0;
  return a.denominator_basis === "incl_contractors"
    ? base + (a.contractor_headcount ?? 0)
    : base;
}

function viewFor(a: AgencySeatModel): View {
  return {
    key: String(a.agency_id),
    label: a.abbreviation,
    workforce: workforceOf(a),
    eligible: a.eligible ?? 0,
    floor: a.floor ?? 0,
    central: a.central ?? 0,
    ceiling: a.ceiling ?? 0,
    includesContractors: a.denominator_basis === "incl_contractors",
    agencyHref: `/experience/seats/${a.abbreviation.toLowerCase()}`,
  };
}

export function PopulationTelescope({
  agencies,
}: {
  agencies: AgencySeatModel[];
}) {
  const modeled = React.useMemo(
    () => agencies.filter((a) => a.modeled && a.central != null),
    [agencies],
  );
  const allView: View = React.useMemo(
    () => ({
      key: "all",
      label: `All ${modeled.length} agencies`,
      workforce: modeled.reduce((s, a) => s + workforceOf(a), 0),
      eligible: modeled.reduce((s, a) => s + (a.eligible ?? 0), 0),
      floor: modeled.reduce((s, a) => s + (a.floor ?? 0), 0),
      central: modeled.reduce((s, a) => s + (a.central ?? 0), 0),
      ceiling: modeled.reduce((s, a) => s + (a.ceiling ?? 0), 0),
      includesContractors: modeled.some(
        (a) => a.denominator_basis === "incl_contractors",
      ),
      agencyHref: null,
    }),
    [modeled],
  );

  const [selected, setSelected] = React.useState<string>("all");
  const view =
    selected === "all"
      ? allView
      : viewFor(modeled.find((a) => String(a.agency_id) === selected) ?? modeled[0]);

  const pillAgencies = modeled.slice(0, 9);
  const restAgencies = modeled.slice(9);

  const w = (n: number) =>
    view.workforce > 0 ? `${(n / view.workforce) * 100}%` : "0%";

  return (
    <div>
      {/* Scope selector */}
      <div className="flex flex-wrap items-center gap-1.5">
        {[allView.key, ...pillAgencies.map((a) => String(a.agency_id))].map(
          (key) => {
            const label =
              key === "all"
                ? allView.label
                : pillAgencies.find((a) => String(a.agency_id) === key)
                    ?.abbreviation ?? key;
            const active = selected === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                className={`border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors ${
                  active
                    ? "border-[var(--stamp)] bg-[var(--stamp)] text-white"
                    : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            );
          },
        )}
        {restAgencies.length > 0 ? (
          <select
            aria-label="More agencies"
            className="border border-border bg-transparent px-2 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground"
            value={
              restAgencies.some((a) => String(a.agency_id) === selected)
                ? selected
                : ""
            }
            onChange={(e) => e.target.value && setSelected(e.target.value)}
          >
            <option value="">More…</option>
            {restAgencies.map((a) => (
              <option key={a.agency_id} value={String(a.agency_id)}>
                {a.abbreviation}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {/* The three nested layers, one shared scale. */}
      <div className="mt-5 space-y-5">
        {/* Layer 1 — everyone */}
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-foreground">
              Everyone who works at{" "}
              {view.key === "all" ? "these agencies" : view.label}
            </p>
            <p className="font-mono text-sm tabular-nums text-foreground">
              {exact(view.workforce)}
            </p>
          </div>
          <div
            className="mt-1.5 h-9 border border-foreground/60 bg-muted/30"
            title={`${exact(view.workforce)} people${view.includesContractors ? ", including on-site contractors where the agency's filed license counts include them" : ""}`}
          />
          <p className="mt-1 text-xs leading-snug text-muted-foreground">
            {view.includesContractors
              ? "Includes on-site contractors where the agency's own filings count them (DOE's ~94k lab workforce)."
              : "Federal employees, from the researched post-2025 headcount."}{" "}
            DoD (~770k civilians) and USPS sit outside the inventory entirely
            and are not drawn.
          </p>
        </div>

        {/* Layer 2 — eligible */}
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: TEAL }}>
              …whose jobs could use an AI tool
            </p>
            <p className="font-mono text-sm tabular-nums text-foreground">
              {exact(view.eligible)}{" "}
              <span className="text-muted-foreground">
                ({pct(view.eligible, view.workforce)} of everyone)
              </span>
            </p>
          </div>
          <div className="mt-1.5 h-9 border border-border bg-muted/10">
            <div
              className="h-full transition-all duration-500"
              style={{
                width: w(view.eligible),
                backgroundColor: `${TEAL}33`,
                borderRight: `2px solid ${TEAL}`,
              }}
              title={`${exact(view.eligible)} AI-eligible staff — desk and knowledge roles; clinical, field, trade, and frontline roles are excluded`}
            />
          </div>
          <p className="mt-1 text-xs leading-snug text-muted-foreground">
            Desk and knowledge roles. Clinicians on the wards, letter
            carriers, screeners, and field crews are excluded from the base —
            an AI &ldquo;seat&rdquo; means nothing for a job with no desk.
          </p>
        </div>

        {/* Layer 3 — has a tool: uncertainty band + best estimate */}
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: STAMP }}>
              …who we estimate have at least one AI tool
            </p>
            <p className="font-mono text-sm tabular-nums text-foreground">
              {exact(view.central)}{" "}
              <span className="text-muted-foreground">
                ({pct(view.central, view.eligible)} of eligible)
              </span>
            </p>
          </div>
          <div className="relative mt-1.5 h-9 border border-border bg-muted/10">
            {/* at-least → at-most band */}
            <div
              className="absolute inset-y-0 transition-all duration-500"
              style={{
                left: 0,
                width: w(view.ceiling),
                backgroundColor: `${STAMP}1a`,
              }}
            />
            <div
              className="absolute inset-y-0 transition-all duration-500"
              style={{
                left: 0,
                width: w(view.floor),
                backgroundColor: `${STAMP}40`,
              }}
              title={`At least ${exact(view.floor)} — the most conservative reading of the filings`}
            />
            {/* best-estimate marker */}
            <div
              className="absolute inset-y-0 w-0.5 transition-all duration-500"
              style={{ left: w(view.central), backgroundColor: STAMP }}
              title={`Best estimate: ${exact(view.central)}`}
            />
          </div>
          <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs leading-snug text-muted-foreground">
              Darker = at least {compact(view.floor)} (most conservative
              reading); lighter extends to at most {compact(view.ceiling)}{" "}
              (most generous); the line is the best estimate.
            </p>
            {view.agencyHref ? (
              <Link
                href={view.agencyHref}
                className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.14em] text-foreground underline decoration-dotted underline-offset-2 hover:text-[var(--stamp)]"
              >
                How {view.label}&apos;s number was built →
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
