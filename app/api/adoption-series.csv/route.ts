/**
 * GET /api/adoption-series.csv
 *
 * Streams every point plotted on /adoption in long format — the external
 * baseline series (lib/data/adoption-series.ts, with full provenance
 * columns) plus the live federal-GenAI cycle counts from the inventory DB.
 * One row per (series, date) observation.
 *
 * No auth — same posture as the rest of the dashboard.
 */

import { NextResponse } from "next/server";
import { getGenAiAdoptionSeries } from "@/lib/db/adoption";
import { assembleAdoptionSeries } from "@/app/adoption/_view-model";
import { csvRow } from "@/lib/csv";

const HEADER = [
  "series_id",
  "series_label",
  "population",
  "metric",
  "unit",
  "driver",
  "clock_start_date",
  "clock_start_label",
  "introduced_date",
  "introduced_label",
  "mandate_date",
  "mandate_label",
  "date",
  "value",
  "approx",
  "source_title",
  "source_url",
  "source_accessed",
];

/** Mandate derivation mirroring the chart (see mandateEvent in
 *  components/charts/adoption-curve-chart.tsx): explicit `mandate` wins;
 *  legacy federal series' `start` IS the mandate when `introduced` is set. */
function mandateOf(s: {
  mandate?: { date: string; label: string };
  driver: string;
  introduced?: { date: string; label: string };
  start: { date: string; label: string };
}): { date: string; label: string } | null {
  if (s.mandate) return s.mandate;
  if (s.driver === "federal mandate" && s.introduced) return s.start;
  return null;
}

export async function GET() {
  const lines: string[] = [csvRow(HEADER)];

  for (const s of assembleAdoptionSeries()) {
    const mandate = mandateOf(s);
    for (const p of s.points) {
      lines.push(
        csvRow([
          s.id,
          s.label,
          s.population,
          s.metric,
          s.unit,
          s.driver,
          s.start.date,
          s.start.label,
          s.introduced?.date ?? "",
          s.introduced?.label ?? "",
          mandate?.date ?? "",
          mandate?.label ?? "",
          p.date,
          p.value,
          p.approx ? "Y" : "N",
          s.source.title,
          s.source.url,
          s.source.accessed,
        ]),
      );
    }
  }

  let genai;
  try {
    genai = getGenAiAdoptionSeries();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown DB error";
    return NextResponse.json(
      { error: `Failed to read GenAI adoption series: ${msg}` },
      { status: 500 },
    );
  }

  const GENAI_META = {
    population: "Federal agencies filing individual AI use cases",
    driver: "federal mandate",
    start_date: "2022-11-30",
    start_label: "ChatGPT public release (LLM-access mandate 2025-07-23)",
    source_title:
      "IFP federal AI use case inventory database (2024 & 2025 cycles)",
    source_url: "https://use-case-inventory.vercel.app/adoption",
  } as const;
  const GENAI_METRICS = [
    ["genai-federal-usecases", "Federal GenAI use cases", "genai_use_cases"],
    ["genai-federal-deployed", "Deployed federal GenAI use cases", "deployed_genai"],
    ["genai-federal-total", "All federal individual AI use cases", "total_use_cases"],
    [
      "genai-federal-enterprise-agencies",
      "Agencies with enterprise-wide GenAI",
      "enterprise_genai_agencies",
    ],
  ] as const;

  for (const [id, label, key] of GENAI_METRICS) {
    for (const cycle of genai) {
      lines.push(
        csvRow([
          id,
          label,
          GENAI_META.population,
          label,
          "count",
          GENAI_META.driver,
          GENAI_META.start_date,
          GENAI_META.start_label,
          "2022-11-30",
          "ChatGPT public release",
          "2025-07-23",
          "AI Action Plan LLM-access mandate",
          `${cycle.inventory_year}-12-31`,
          cycle[key],
          "N",
          GENAI_META.source_title,
          GENAI_META.source_url,
          new Date().toISOString().slice(0, 10),
        ]),
      );
    }
  }

  return new NextResponse(lines.join(""), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="adoption-series.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
