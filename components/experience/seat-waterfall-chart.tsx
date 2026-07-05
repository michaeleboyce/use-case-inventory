"use client";

import { Bar, BarChart, Cell, LabelList, Tooltip, XAxis, YAxis } from "recharts";
import { ChartFrame } from "@/components/charts/chart-frame";
import type { WaterfallStep } from "@/lib/experience-shared";

/**
 * THE methodology chart. It starts from the naive band-midpoint sum (what the
 * page used to publish as "seats") and walks down, one labeled correction at a
 * time, to the model's defensible central estimate. Each floating bar is a
 * deduction; the notes below ARE the methodology — every step corresponds to
 * one stateable rule, and the running totals reconcile exactly.
 */

const KIND_COLORS: Record<WaterfallStep["kind"], string> = {
  start: "#4b5563", // gray — the uncorrected starting mass
  deduction: "#d99a3e", // amber — a correction removed
  result: "#b3361f", // stamp red — the modeled estimate
};

const compact = (n: number) =>
  Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);

const exact = (n: number) => n.toLocaleString("en-US");

interface Row {
  key: string;
  label: string;
  /** transparent pedestal that floats the colored segment */
  base: number;
  /** colored segment height = |delta| for deductions, value for start/result */
  band: number;
  value: number;
  delta: number;
  kind: WaterfallStep["kind"];
  note: string;
}

function toRow(step: WaterfallStep): Row {
  if (step.kind === "deduction") {
    const prev = step.value - step.delta; // delta is negative → prev > value
    return {
      key: step.key,
      label: step.label,
      base: Math.min(step.value, prev),
      band: Math.abs(step.delta),
      value: step.value,
      delta: step.delta,
      kind: step.kind,
      note: step.note,
    };
  }
  return {
    key: step.key,
    label: step.label,
    base: 0,
    band: step.value,
    value: step.value,
    delta: step.delta,
    kind: step.kind,
    note: step.note,
  };
}

export function SeatWaterfallChart({ steps }: { steps: WaterfallStep[] }) {
  const rows = steps.map(toRow);

  const renderTopLabel = (props: {
    x?: string | number;
    y?: string | number;
    width?: string | number;
    index?: number;
  }) => {
    const i = props.index ?? -1;
    const step = rows[i];
    if (!step) return null;
    const x = Number(props.x) + Number(props.width) / 2;
    const y = Number(props.y) - 6;
    const text =
      step.kind === "deduction"
        ? `−${compact(Math.abs(step.delta))}`
        : compact(step.value);
    return (
      <text
        x={x}
        y={y}
        textAnchor="middle"
        fontSize={11}
        fontWeight={600}
        fill="var(--foreground)"
      >
        {text}
      </text>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <ChartFrame height={360}>
        <BarChart data={rows} margin={{ top: 24, right: 16, bottom: 84, left: 8 }}>
          <XAxis
            dataKey="label"
            interval={0}
            tickLine={false}
            stroke="var(--border)"
            tick={<WrapTick />}
            height={80}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            stroke="var(--border)"
            tickFormatter={(v) => compact(v as number)}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.4 }}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--popover-foreground)",
            }}
            content={({ active, payload }) => {
              if (!active || !payload || payload.length === 0) return null;
              const r = payload[0].payload as Row;
              return (
                <div className="max-w-xs border border-border bg-popover p-2.5 text-xs text-popover-foreground shadow">
                  <div className="font-semibold">{r.label}</div>
                  <div className="mt-1 tabular-nums">
                    Running total:{" "}
                    <span className="font-medium">{exact(r.value)}</span>
                  </div>
                  {r.kind === "deduction" ? (
                    <div className="tabular-nums text-muted-foreground">
                      Removed: {exact(Math.abs(r.delta))}
                    </div>
                  ) : null}
                  <p className="mt-1.5 leading-snug text-muted-foreground">
                    {r.note}
                  </p>
                </div>
              );
            }}
          />
          {/* transparent pedestal floats the colored segment */}
          <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
          <Bar dataKey="band" stackId="w" isAnimationActive={false} maxBarSize={72}>
            {rows.map((r) => (
              <Cell key={r.key} fill={KIND_COLORS[r.kind]} />
            ))}
            <LabelList content={renderTopLabel} />
          </Bar>
        </BarChart>
      </ChartFrame>

      {/* The notes ARE the methodology. */}
      <ol className="flex flex-col gap-2.5 border-t border-border pt-3 text-sm">
        {rows.map((r, i) => (
          <li key={r.key} className="grid grid-cols-[1.5rem_1fr] gap-2">
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {i + 1}.
            </span>
            <div>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span
                  aria-hidden
                  className="inline-block size-2.5 shrink-0 translate-y-[1px] rounded-[2px]"
                  style={{ background: KIND_COLORS[r.kind] }}
                />
                <span className="font-medium text-foreground">{r.label}</span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {r.kind === "deduction"
                    ? `−${exact(Math.abs(r.delta))} → ${exact(r.value)}`
                    : exact(r.value)}
                </span>
              </div>
              <p className="mt-0.5 leading-snug text-muted-foreground">{r.note}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Word-wrapping x-axis tick — step labels are full sentences, so we break
 *  them onto up to three ~16-char lines rather than clip or overlap. */
function WrapTick(props: {
  x?: number;
  y?: number;
  payload?: { value?: string | number };
}) {
  const { x = 0, y = 0, payload } = props;
  const label = String(payload?.value ?? "");
  const lines = wrap(label, 16, 3);
  return (
    <text
      x={x}
      y={y + 12}
      textAnchor="middle"
      fontSize={10}
      fill="var(--muted-foreground)"
    >
      {lines.map((ln, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : 12}>
          {ln}
        </tspan>
      ))}
    </text>
  );
}

function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = w;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1]}…`;
    return kept;
  }
  return lines;
}
