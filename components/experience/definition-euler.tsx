"use client";

import type { GenAiHeadline, OmbIfpCrosstab } from "@/lib/experience-shared";

/**
 * An area-proportional Euler diagram replacing the plain OMB×IFP 2×2 table.
 * Two circles — what OMB self-classified as Generative AI vs what IFP's
 * narrative re-tag calls Generative AI — sized so area ∝ count, positioned so
 * the lens area approximates the agreed-GenAI overlap. Inside the IFP circle
 * we nest the two stricter IFP definitions (general LLM access ⊂, then
 * enterprise-wide LLM ⊂ that), because they're progressively tighter subsets.
 * All four 2×2 cell counts stay visible so nothing the table showed is lost.
 */

const OMB_FILL = "#1f7a8c"; // teal
const IFP_FILL = "#b3361f"; // stamp red

const exact = (n: number) => n.toLocaleString("en-US");

/** Circle-circle lens (intersection) area for radii r1,r2 at center gap d. */
function lensArea(r1: number, r2: number, d: number): number {
  if (d >= r1 + r2) return 0;
  if (d <= Math.abs(r1 - r2)) return Math.PI * Math.min(r1, r2) ** 2;
  const a1 = Math.acos((d * d + r1 * r1 - r2 * r2) / (2 * d * r1));
  const a2 = Math.acos((d * d + r2 * r2 - r1 * r1) / (2 * d * r2));
  const tri = 0.5 * Math.sqrt(
    (-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2),
  );
  return r1 * r1 * a1 + r2 * r2 * a2 - tri;
}

/** Binary-search the center gap that makes the lens area hit `target`. */
function solveGap(r1: number, r2: number, target: number): number {
  let loD = Math.abs(r1 - r2); // max overlap
  let hiD = r1 + r2; // zero overlap
  for (let i = 0; i < 40; i++) {
    const mid = (loD + hiD) / 2;
    // lensArea decreases as d grows
    if (lensArea(r1, r2, mid) > target) loD = mid;
    else hiD = mid;
  }
  return (loD + hiD) / 2;
}

export function DefinitionEuler({
  crosstab,
  headlines,
}: {
  crosstab: OmbIfpCrosstab;
  headlines: GenAiHeadline[];
}) {
  const ombTotal = crosstab.omb_genai_ifp_genai + crosstab.omb_genai_ifp_not;
  const ifpTotal = crosstab.omb_genai_ifp_genai + crosstab.omb_not_ifp_genai;
  const overlap = crosstab.omb_genai_ifp_genai;

  const llmAccess =
    headlines.find((h) => h.definition === "ifp_llm_access")?.total ?? 0;
  const enterprise =
    headlines.find((h) => h.definition === "ifp_enterprise")?.total ?? 0;

  // Geometry. Area ∝ count: r = k·√count. Pick k so the larger circle fits.
  const W = 520;
  const H = 300;
  const maxR = 96;
  const maxCount = Math.max(ombTotal, ifpTotal, 1);
  const k = maxR / Math.sqrt(maxCount);
  const rOmb = k * Math.sqrt(Math.max(ombTotal, 1));
  const rIfp = k * Math.sqrt(Math.max(ifpTotal, 1));

  const areaPerCount = (Math.PI * rOmb * rOmb) / Math.max(ombTotal, 1);
  const gap = solveGap(rOmb, rIfp, overlap * areaPerCount);

  // Lay the pair out horizontally centered.
  const cy = H / 2;
  const spanW = rOmb + gap + rIfp;
  const startX = (W - spanW) / 2;
  const cxOmb = startX + rOmb;
  const cxIfp = cxOmb + gap;

  // Region label anchors: OMB-only left of the lens, IFP-only right, overlap
  // roughly at the mid-gap.
  const lensX = (cxOmb + cxIfp) / 2;

  return (
    <figure className="flex flex-col gap-3">
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`OMB classified ${exact(ombTotal)} use cases as Generative AI; IFP tagged ${exact(ifpTotal)}; ${exact(overlap)} agree.`}
          className="mx-auto block h-auto w-full max-w-[560px]"
        >
          <circle
            cx={cxOmb}
            cy={cy}
            r={rOmb}
            fill={OMB_FILL}
            fillOpacity={0.22}
            stroke={OMB_FILL}
            strokeWidth={1.5}
          />
          <circle
            cx={cxIfp}
            cy={cy}
            r={rIfp}
            fill={IFP_FILL}
            fillOpacity={0.22}
            stroke={IFP_FILL}
            strokeWidth={1.5}
          />

          {/* Nested stricter IFP subsets, drawn as concentric arcs inside the
              IFP circle (lower portion) so the ⊂ relationship reads visually. */}
          {ifpTotal > 0 ? (
            <>
              <circle
                cx={cxIfp}
                cy={cy + rIfp * 0.28}
                r={k * Math.sqrt(Math.max(llmAccess, 1)) * 0.62}
                fill={IFP_FILL}
                fillOpacity={0.28}
                stroke={IFP_FILL}
                strokeWidth={1}
              />
              <circle
                cx={cxIfp}
                cy={cy + rIfp * 0.28}
                r={k * Math.sqrt(Math.max(enterprise, 1)) * 0.62}
                fill={IFP_FILL}
                fillOpacity={0.4}
                stroke={IFP_FILL}
                strokeWidth={1}
              />
            </>
          ) : null}

          {/* Circle titles */}
          <text
            x={cxOmb - rOmb * 0.35}
            y={cy - rOmb - 8}
            textAnchor="middle"
            fontSize={11}
            fontWeight={600}
            fill="var(--foreground)"
          >
            OMB · Generative AI
          </text>
          <text
            x={cxIfp + rIfp * 0.35}
            y={cy - rIfp - 8}
            textAnchor="middle"
            fontSize={11}
            fontWeight={600}
            fill="var(--foreground)"
          >
            IFP · Generative AI
          </text>

          {/* Region counts */}
          <RegionCount
            x={cxOmb - rOmb * 0.45}
            y={cy}
            n={crosstab.omb_genai_ifp_not}
            sub="OMB only"
          />
          <RegionCount x={lensX} y={cy - 6} n={overlap} sub="agree" />
          <RegionCount
            x={cxIfp + rIfp * 0.4}
            y={cy - rIfp * 0.35}
            n={crosstab.omb_not_ifp_genai}
            sub="IFP only"
          />
        </svg>
      </div>

      {/* Nested-subset chips inside the IFP definition. */}
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="font-mono uppercase tracking-[0.1em] text-muted-foreground">
          Within IFP GenAI:
        </span>
        <span
          className="inline-flex items-baseline gap-1.5 border px-2 py-0.5"
          style={{ borderColor: `${IFP_FILL}66` }}
        >
          <span className="tabular-nums font-semibold text-foreground">
            {exact(llmAccess)}
          </span>
          <span className="text-muted-foreground">general LLM access</span>
        </span>
        <span aria-hidden className="text-muted-foreground">
          ⊃
        </span>
        <span
          className="inline-flex items-baseline gap-1.5 px-2 py-0.5 text-white"
          style={{ background: IFP_FILL }}
        >
          <span className="tabular-nums font-semibold">{exact(enterprise)}</span>
          <span>enterprise-wide LLM</span>
        </span>
      </div>

      {/* The four 2×2 cells, kept explicit so nothing the table showed is lost. */}
      <dl className="grid grid-cols-2 gap-px overflow-hidden border border-border bg-border text-xs sm:grid-cols-4">
        <Cell label="OMB GenAI ∩ IFP GenAI" n={crosstab.omb_genai_ifp_genai} />
        <Cell label="OMB GenAI, IFP not" n={crosstab.omb_genai_ifp_not} />
        <Cell label="IFP GenAI, OMB not" n={crosstab.omb_not_ifp_genai} />
        <Cell label="Neither" n={crosstab.omb_not_ifp_not} />
      </dl>
    </figure>
  );
}

function RegionCount({
  x,
  y,
  n,
  sub,
}: {
  x: number;
  y: number;
  n: number;
  sub: string;
}) {
  return (
    <>
      <text
        x={x}
        y={y}
        textAnchor="middle"
        fontSize={16}
        fontWeight={700}
        fill="var(--foreground)"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {exact(n)}
      </text>
      <text
        x={x}
        y={y + 13}
        textAnchor="middle"
        fontSize={9}
        fill="var(--muted-foreground)"
      >
        {sub}
      </text>
    </>
  );
}

function Cell({ label, n }: { label: string; n: number }) {
  return (
    <div className="flex flex-col gap-0.5 bg-background p-2.5">
      <span className="font-mono text-[9px] uppercase leading-tight tracking-[0.08em] text-muted-foreground">
        {label}
      </span>
      <span className="tabular-nums text-lg font-semibold text-foreground">
        {exact(n)}
      </span>
    </div>
  );
}
