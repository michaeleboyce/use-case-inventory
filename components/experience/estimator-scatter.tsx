"use client";

import { useRouter } from "next/navigation";
import {
  CartesianGrid,
  ReferenceLine,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { ChartFrame } from "@/components/charts/chart-frame";

/**
 * Naive filed-band sum (x) × stratified-model central (y), one point per
 * agency, both on log axes. The y=x reference line is the pivot: points above
 * it are agencies whose filings *understate* real reach (the model finds more
 * people than the filed bands imply); points far below are agencies whose
 * filings *overstate* it — the band collapse and multi-tool double counting
 * the model strips out. Those over-counters (naive > 3× model) are the
 * interesting ones, so they get the amber treatment. Click a point to open
 * that agency's seat breakdown.
 */

type EstimatorRow = {
  abbreviation: string;
  name: string;
  naive: number;
  model: number;
  eligible: number;
};

type Point = EstimatorRow & { overstated: boolean };

const TYPICAL = "#b3361f";
const OVERSTATED = "#d99a3e";

const exact = (n: number) => n.toLocaleString("en-US");

export function EstimatorScatter({ rows }: { rows: EstimatorRow[] }) {
  const router = useRouter();

  // Log axes can't take zero/negative values; drop rows that lack a positive
  // value on either axis (they carry no ratio signal anyway).
  const points: Point[] = rows
    .filter((r) => r.naive > 0 && r.model > 0)
    .map((r) => ({ ...r, overstated: r.naive > 3 * r.model }));

  const typical = points.filter((p) => !p.overstated);
  const overstated = points.filter((p) => p.overstated);

  // y=x is a straight diagonal in log-log space; a segment between the global
  // min and max of both axes draws it across the whole plot.
  const all = points.flatMap((p) => [p.naive, p.model]);
  const lo = all.length ? Math.min(...all) : 1;
  const hi = all.length ? Math.max(...all) : 10;

  const onClick = (entry: unknown) => {
    const abbr = (entry as { abbreviation?: string }).abbreviation;
    if (abbr) router.push(`/experience/seats/${abbr.toLowerCase()}`);
  };

  return (
    <div className="flex flex-col gap-3">
      <ChartFrame height={360}>
        <ScatterChart margin={{ top: 12, right: 20, bottom: 44, left: 12 }}>
          <CartesianGrid stroke="var(--border)" />
          <XAxis
            type="number"
            dataKey="naive"
            name="Filed bands"
            scale="log"
            domain={["auto", "auto"]}
            allowDataOverflow
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            stroke="var(--border)"
            tickFormatter={(v) =>
              Intl.NumberFormat("en-US", { notation: "compact" }).format(
                v as number,
              )
            }
            label={{
              value: "Sum of filed license bands (log)",
              position: "insideBottom",
              offset: -10,
              style: { fontSize: 11, fill: "var(--muted-foreground)" },
            }}
          />
          <YAxis
            type="number"
            dataKey="model"
            name="Modeled central"
            scale="log"
            domain={["auto", "auto"]}
            allowDataOverflow
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            stroke="var(--border)"
            tickFormatter={(v) =>
              Intl.NumberFormat("en-US", { notation: "compact" }).format(
                v as number,
              )
            }
            label={{
              value: "Modeled central (log)",
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 11, fill: "var(--muted-foreground)" },
            }}
          />
          <ZAxis range={[70, 70]} />
          <ReferenceLine
            stroke="var(--muted-foreground)"
            strokeDasharray="4 4"
            segment={[
              { x: lo, y: lo },
              { x: hi, y: hi },
            ]}
            ifOverflow="extendDomain"
            label={{
              value: "filed = modeled",
              position: "insideTopRight",
              fill: "var(--muted-foreground)",
              fontSize: 10,
            }}
          />
          <Tooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              if (!active || !payload || payload.length === 0) return null;
              const p = payload[0].payload as Point;
              return (
                <div className="border border-border bg-popover p-2 text-xs text-popover-foreground shadow">
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-muted-foreground">{p.abbreviation}</div>
                  <div className="mt-1 tabular-nums">
                    Filed bands:{" "}
                    <span className="font-medium">{exact(p.naive)}</span>
                  </div>
                  <div className="tabular-nums">
                    Modeled: <span className="font-medium">{exact(p.model)}</span>
                  </div>
                  <div className="tabular-nums text-muted-foreground">
                    Eligible: {exact(p.eligible)}
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    {p.overstated
                      ? "Filings overstate reach"
                      : "Click to open agency"}
                  </div>
                </div>
              );
            }}
          />
          <Scatter
            name="Typical"
            data={typical}
            fill={TYPICAL}
            fillOpacity={0.85}
            cursor="pointer"
            onClick={onClick}
          />
          <Scatter
            name="Filings overstate (>3×)"
            data={overstated}
            fill={OVERSTATED}
            fillOpacity={0.9}
            cursor="pointer"
            onClick={onClick}
          />
        </ScatterChart>
      </ChartFrame>

      <div className="flex flex-wrap gap-4 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block size-2.5 rounded-full"
            style={{ background: TYPICAL }}
          />
          Typical agency
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block size-2.5 rounded-full"
            style={{ background: OVERSTATED }}
          />
          Filings overstate reach (&gt;3× the model)
        </span>
        <span>Above the line: filings understate. Below: filings overstate.</span>
      </div>
    </div>
  );
}
