"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartFrame } from "@/components/charts/chart-frame";
import { DefinitionToggle } from "./definition-toggle";
import {
  GENAI_DEFINITION_LABELS,
  type GenAiDefinition,
  type GenAiHeadline,
} from "@/lib/experience-shared";

const STAGE_COLORS: Record<string, string> = {
  Deployed: "#b3361f",
  Pilot: "#d99a3e",
  "Pre-deployment": "#94a3b8",
  Retired: "#4b5563",
};

const STAGE_ORDER = ["Deployed", "Pilot", "Pre-deployment", "Retired"] as const;
type Stage = (typeof STAGE_ORDER)[number];

/**
 * Side-by-side bars: one bar per GenAI definition, stacked by deployment
 * stage. Reveals two things at once — how many use cases qualify under each
 * definition, and what share are actually live in production.
 */
export function GenAiByStageChart({ data }: { data: GenAiHeadline[] }) {
  const [def, setDef] = React.useState<GenAiDefinition>("ifp_genai");

  // Long form: one row per (definition, stage). We render every definition
  // as a separate bar so the chart compares OMB to IFP at a glance, with
  // the selected definition highlighted.
  const rows = data.map((h) => ({
    definition: h.definition,
    label: shortLabel(h.definition),
    Deployed: h.deployed,
    Pilot: h.pilot,
    "Pre-deployment": h.pre_deployment,
    Retired: h.retired,
    total: h.total,
  }));

  return (
    <div className="flex flex-col gap-3">
      <DefinitionToggle value={def} onChange={setDef} />
      <p className="text-xs text-muted-foreground">
        Highlighted bar is the selected definition. Other bars stay visible so
        readers can see how the count moves when the definition changes.
        Currently <strong>{GENAI_DEFINITION_LABELS[def]}</strong>:{" "}
        {data.find((d) => d.definition === def)?.total ?? 0} use cases.
      </p>
      <ChartFrame height={360}>
        <BarChart
          data={rows}
          margin={{ top: 8, right: 24, bottom: 36, left: 8 }}
        >
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            stroke="var(--border)"
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            stroke="var(--border)"
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
            labelFormatter={(label) => {
              const r = rows.find((row) => row.label === label);
              if (!r) return String(label);
              return `${GENAI_DEFINITION_LABELS[r.definition]} — ${r.total} total`;
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
          {STAGE_ORDER.map((stage) => (
            <Bar
              key={stage}
              dataKey={stage}
              stackId="a"
              fill={STAGE_COLORS[stage]}
              fillOpacity={undefined}
              shape={(props: unknown) => (
                <DimmedBar
                  {...(props as BarShapeProps)}
                  isActive={
                    (props as BarShapeProps).payload.definition === def
                  }
                  baseFill={STAGE_COLORS[stage]}
                />
              )}
            />
          ))}
        </BarChart>
      </ChartFrame>
    </div>
  );
}

function shortLabel(d: GenAiDefinition): string {
  switch (d) {
    case "omb":
      return "OMB (filed)";
    case "ifp_genai":
      return "IFP GenAI";
    case "ifp_llm_access":
      return "IFP LLM access";
    case "ifp_enterprise":
      return "IFP enterprise";
  }
}

type BarShapeProps = {
  x: number;
  y: number;
  width: number;
  height: number;
  payload: { definition: GenAiDefinition };
  baseFill: string;
  isActive: boolean;
};

function DimmedBar(props: BarShapeProps) {
  const { x, y, width, height, baseFill, isActive } = props;
  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      fill={baseFill}
      opacity={isActive ? 1 : 0.32}
    />
  );
}
