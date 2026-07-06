"use client";

/**
 * The two clocks. Reach vs. rollout on one year axis.
 *
 * Series 1 (solid ink, stepAfter): cumulative agencies whose earliest ATO on
 * a package carrying a core-AI service in scope has passed — "capability
 * legally in reach," dense and early.
 *
 * Series 2 (dashed vermilion, dotted, stepAfter): cumulative agencies with a
 * dated, web-corroborated IFP evidence row that they actually rolled a
 * general-purpose AI tool out to staff — sparse by construction, and years
 * behind. The dots mark the discrete evidence dates; the dashed connector
 * signals that the line between them is interpolation, not data.
 *
 * Policy events (①②③) and a directive (⑥) render as vertical reference
 * lines; two procurement/authorization windows render as shaded bands (④⑤).
 * Numbering is chronological and shared with the key list below the chart.
 */

import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartFrame } from "@/components/charts/chart-frame";
import type { DivergenceTimelineData } from "../_view-model";

const MONO = "var(--font-mono)";

/** `YYYY-MM-DD` → epoch ms (UTC midnight), the chart's x unit. */
function ms(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getTime();
}

// Circled-number markers, shared between the chart annotations and the key.
// Order is strictly chronological so the two stay legible together.
const EVENTS = [
  { n: "①", date: "2022-11-30", label: "ChatGPT launch (Nov 2022)" },
  { n: "②", date: "2024-03-28", label: "OMB M-24-10 (Mar 2024)" },
  { n: "③", date: "2025-07-23", label: "AI Action Plan LLM mandate (Jul 2025)" },
  { n: "⑥", date: "2026-02-27", label: "Anthropic cease-use directive (Feb 2026)" },
] as const;

const BANDS = [
  {
    n: "④",
    from: "2025-08-07",
    to: "2025-11-19",
    label: "OneGov $1-per-agency deals (Aug–Nov 2025)",
  },
  {
    n: "⑤",
    from: "2026-01-09",
    to: "2026-02-01",
    label: "20x authorizations: ChatGPT, Gemini, Perplexity (Jan–Feb 2026)",
  },
] as const;

// The full chronological key, numbers in order.
const KEY = [
  EVENTS[0],
  EVENTS[1],
  EVENTS[2],
  { n: BANDS[0].n, label: BANDS[0].label },
  { n: BANDS[1].n, label: BANDS[1].label },
  EVENTS[3],
] as const;

const YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];

const SERIES_ATO = "first ATO on a package with a core-AI service in scope";
const SERIES_ANCHOR = "first web-corroborated GenAI rollout evidence (IFP)";

type PlotPoint = {
  t: number;
  cumulative: number;
  date: string;
  abbr: string | null;
  name: string;
  tool?: string | null;
};

function toPlot(
  steps: DivergenceTimelineData["atoSteps"],
): PlotPoint[] {
  return steps.map((s) => ({ ...s, t: ms(s.date) }));
}

export function DivergenceTimeline({
  data,
  exportMode = false,
}: {
  data: DivergenceTimelineData;
  exportMode?: boolean;
}) {
  const atoData = toPlot(data.atoSteps);
  const anchorData = toPlot(data.anchorSteps);
  const domain: [number, number] = [ms("2019-01-01"), ms(data.snapshotDate)];
  const yearTicks = YEARS.map((y) => Date.UTC(y, 0, 1));

  const chart = (
    <ChartFrame height={380}>
      <ComposedChart margin={{ top: 22, right: 28, bottom: 28, left: 8 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          type="number"
          dataKey="t"
          domain={domain}
          ticks={yearTicks}
          allowDataOverflow
          tickFormatter={(v) => String(new Date(v as number).getUTCFullYear())}
          tick={{ fontSize: 10, fill: "var(--muted-foreground)", fontFamily: MONO }}
          stroke="var(--border)"
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 10, fill: "var(--muted-foreground)", fontFamily: MONO }}
          stroke="var(--border)"
          label={{
            value: "agencies (cumulative)",
            angle: -90,
            position: "insideLeft",
            style: { fontSize: 10, fill: "var(--muted-foreground)", fontFamily: MONO },
          }}
        />

        {/* Procurement / authorization windows — shaded bands ④⑤ */}
        {BANDS.map((b) => (
          <ReferenceArea
            key={b.n}
            x1={ms(b.from)}
            x2={ms(b.to)}
            fill="var(--stamp)"
            fillOpacity={0.06}
            ifOverflow="extendDomain"
            label={{
              value: b.n,
              position: "top",
              fontSize: 10,
              fill: "var(--muted-foreground)",
              fontFamily: MONO,
            }}
          />
        ))}

        {/* Policy events / directive — vertical reference lines ①②③⑥ */}
        {EVENTS.map((e) => (
          <ReferenceLine
            key={e.n}
            x={ms(e.date)}
            stroke="var(--border)"
            strokeDasharray="2 2"
            ifOverflow="extendDomain"
            label={{
              value: e.n,
              position: "top",
              fontSize: 10,
              fill: "var(--muted-foreground)",
              fontFamily: MONO,
            }}
          />
        ))}

        <Line
          data={atoData}
          type="stepAfter"
          dataKey="cumulative"
          name={SERIES_ATO}
          stroke="var(--foreground)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
        {anchorData.length > 0 ? (
          <Line
            data={anchorData}
            type="stepAfter"
            dataKey="cumulative"
            name={SERIES_ANCHOR}
            stroke="var(--stamp)"
            strokeWidth={2}
            strokeDasharray="4 3"
            dot={{ r: 3.5, fill: "var(--stamp)", stroke: "var(--stamp)" }}
            isAnimationActive={false}
          />
        ) : null}

        {exportMode ? null : (
          <Tooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              if (!active || !payload || payload.length === 0) return null;
              const first = payload[0]?.payload as PlotPoint | undefined;
              return (
                <div className="border border-border bg-popover p-2 text-[11px] text-popover-foreground shadow">
                  {first ? (
                    <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      {first.date}
                    </div>
                  ) : null}
                  {payload.map((p, i) => {
                    const pt = p.payload as PlotPoint;
                    const who = pt.abbr ?? pt.name;
                    return (
                      <div key={i} className="mt-1">
                        <div className="text-muted-foreground">{p.name}</div>
                        <div className="tabular-nums">
                          <span className="font-medium">{p.value as number}</span>{" "}
                          agencies
                          {who ? (
                            <>
                              {" · "}
                              <span className="font-mono">{who}</span>
                            </>
                          ) : null}
                          {pt.tool ? (
                            <>
                              {" · "}
                              <span className="font-mono">{pt.tool}</span>
                            </>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            }}
          />
        )}
      </ComposedChart>
    </ChartFrame>
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Manual legend — Recharts default can't render the dotted/dashed cue. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[10.5px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-0 w-6 border-t-2"
            style={{ borderColor: "var(--foreground)" }}
          />
          {SERIES_ATO}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-0 w-6 border-t-2 border-dashed"
            style={{ borderColor: "var(--stamp)" }}
          />
          {SERIES_ANCHOR}
        </span>
      </div>

      {exportMode ? <div style={{ width: 1000 }}>{chart}</div> : chart}

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <ol className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10.5px] text-muted-foreground">
          {KEY.map((k) => (
            <li key={k.n}>
              <span className="text-foreground">{k.n}</span> {k.label}
            </li>
          ))}
        </ol>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          marketplace snapshot {data.snapshotDate}
        </span>
      </div>

      <p className="font-mono text-[10.5px] leading-relaxed text-muted-foreground">
        ATO clock: earliest agency ATO on any package whose scope catalog
        carries a core-AI service — in scope of an authorization the agency
        holds, not enablement. Rollout clock: {data.anchorSteps.length} dated
        IFP evidence rows; sparse by construction.
      </p>
    </div>
  );
}
