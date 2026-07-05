"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { ChartFrame } from "@/components/charts/chart-frame";
import { DefinitionToggle } from "./definition-toggle";
import {
  GENAI_DEFINITION_LABELS,
  type GenAiDefinition,
  type GenAiTimelinePoint,
} from "@/lib/experience-shared";

const ACTION_PLAN_YEAR = "2025";

const DECLARED_COLOR = "#b3361f"; // the chart's original series red
const BEYOND_COLOR = "#94a3b8"; // slate-400 — the site's "uncertain" ink (cf. Fig. 06 unknown)

type TimelineView = "total" | "provenance";

/**
 * Stacked annual count of deployed GenAI go-live dates, with a vertical
 * reference line at the year Trump's AI Action Plan dropped (Jul 23, 2025).
 * The point of the chart is to show the curve was already bending pre-Plan.
 *
 * The "Tag provenance" view splits each year's bar into use cases the
 * agency ITSELF filed as Generative/Agentic AI versus ones only IFP's
 * tagging considers generative — which is most of the pre-2023 tail
 * (retrofitted GenAI on older systems, pre-LLM generative tech, and
 * keyword-derived tags beyond the agency's declaration). Not meaningful
 * for the OMB definition, where "declared" is the whole bar.
 */
export function GenAiTimelineChart({
  data,
}: {
  data: GenAiTimelinePoint[];
}) {
  const [def, setDef] = React.useState<GenAiDefinition>("ifp_genai");
  const [view, setView] = React.useState<TimelineView>("total");

  // Provenance is a no-op split for the OMB definition (declared == total).
  const effectiveView: TimelineView = def === "omb" ? "total" : view;

  // Filter unknown bucket out by default — agencies vary in how they fill
  // operational_date, and "unknown" carries no temporal signal.
  const rows = data
    .filter((d) => d.year !== "unknown" && Number(d.year) >= 2019)
    .map((d) => ({
      year: d.year,
      count: d.counts[def],
      declared: Math.min(d.declared[def], d.counts[def]),
      beyond: Math.max(d.counts[def] - d.declared[def], 0),
    }));

  const total = rows.reduce((a, r) => a + r.count, 0);
  const unknown = data.find((d) => d.year === "unknown")?.counts[def] ?? 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <DefinitionToggle value={def} onChange={setDef} />
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-mono uppercase tracking-[0.14em] text-muted-foreground">
            View:
          </span>
          <Button
            variant={effectiveView === "total" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("total")}
            className="font-mono text-[11px]"
          >
            Total
          </Button>
          <Button
            variant={effectiveView === "provenance" ? "default" : "outline"}
            size="sm"
            disabled={def === "omb"}
            onClick={() => setView("provenance")}
            title={
              def === "omb"
                ? "The OMB definition is agency-declared by construction — there is no split to show."
                : "Split each bar into agency-declared GenAI/Agentic vs IFP-tagged beyond the agency's declaration."
            }
            className="font-mono text-[11px]"
          >
            Tag provenance
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Deployed-GenAI use cases bucketed by the year of their{" "}
        <code className="font-mono">operational_date</code> — the{" "}
        <em>system&apos;s</em> go-live, so a pre-2023 bar can be an older
        system that added GenAI later, or pre-LLM generative tech (report
        generation, speech synthesis, translation). Vertical dashed line
        marks 2025, the year of the AI Action Plan (Jul 23, 2025). {total}{" "}
        use cases have a parseable year under{" "}
        <strong>{GENAI_DEFINITION_LABELS[def]}</strong>; {unknown} additional
        rows have an unparseable or missing operational date.
        {effectiveView === "provenance" ? (
          <>
            {" "}
            The muted portion is entries the agency itself did NOT file as
            Generative/Agentic AI — it dominates the early tail.
          </>
        ) : null}
      </p>
      {effectiveView === "provenance" ? (
        <div className="flex flex-wrap items-center gap-4 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-[2px]"
              style={{ background: DECLARED_COLOR }}
            />
            Agency-declared GenAI/Agentic
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-[2px]"
              style={{ background: BEYOND_COLOR }}
            />
            IFP tag beyond agency declaration
          </span>
        </div>
      ) : null}
      <ChartFrame height={320}>
        <BarChart data={rows} margin={{ top: 8, right: 24, bottom: 36, left: 8 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            stroke="var(--border)"
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            stroke="var(--border)"
            allowDecimals={false}
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
          />
          <ReferenceLine
            x={ACTION_PLAN_YEAR}
            stroke="var(--stamp)"
            strokeDasharray="4 4"
            label={{
              value: "AI Action Plan",
              position: "top",
              fill: "var(--stamp)",
              fontSize: 11,
            }}
          />
          {effectiveView === "provenance" ? (
            <>
              <Bar
                dataKey="declared"
                name="Agency-declared GenAI/Agentic"
                stackId="prov"
                fill={DECLARED_COLOR}
                stroke="var(--background)"
                strokeWidth={1}
              />
              <Bar
                dataKey="beyond"
                name="IFP tag beyond agency declaration"
                stackId="prov"
                fill={BEYOND_COLOR}
                stroke="var(--background)"
                strokeWidth={1}
              />
            </>
          ) : (
            <Bar dataKey="count" name="Deployed GenAI" fill={DECLARED_COLOR} />
          )}
        </BarChart>
      </ChartFrame>
    </div>
  );
}
