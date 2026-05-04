/**
 * Architecture-type donut chart. Thin wrapper around the shared DonutChart
 * that centralizes the color map and humanized labels for the
 * `tag.architecture_type` enum.
 */

"use client";

import { DonutChart, type DonutDatum } from "./donut-chart";

const ARCHITECTURE_COLORS: Record<string, string> = {
  inference_only: "#3b82f6", // blue-500
  rag_pipeline: "#8b5cf6", // violet-500
  fine_tuned: "#f59e0b", // amber-500
  custom_trained: "#10b981", // emerald-500
  agentic_workflow: "#ef4444", // red-500
  unknown: "#94a3b8", // slate-400
};

const ARCHITECTURE_LABELS: Record<string, string> = {
  inference_only: "Inference only",
  rag_pipeline: "RAG pipeline",
  fine_tuned: "Fine-tuned",
  custom_trained: "Custom trained",
  agentic_workflow: "Agentic workflow",
  unknown: "Unknown",
};

export function ArchitectureDonut({ data }: { data: DonutDatum[] }) {
  return (
    <DonutChart
      data={data}
      colorMap={ARCHITECTURE_COLORS}
      labelMap={ARCHITECTURE_LABELS}
      centerSubLabel="use cases"
      height={280}
    />
  );
}

const LLM_VENDOR_COLORS: Record<string, string> = {
  Microsoft: "#2563eb", // blue-600
  OpenAI: "#10b981", // emerald-500
  Anthropic: "#f59e0b", // amber-500
  Google: "#ef4444", // red-500
  Amazon: "#f97316", // orange-500
  Perplexity: "#0ea5e9", // sky-500
  Palantir: "#6366f1", // indigo-500
  ServiceNow: "#22c55e", // green-500
  Databricks: "#eab308", // yellow-500
  "In-house": "#8b5cf6", // violet-500
  "Other named": "#64748b", // slate-500
  // "Vendor unspecified" — agency reports general-LLM access without
  // naming the tool. Distinct from "Other named" (a real vendor, just
  // not in our color map). Render muted so it visually recedes.
  "Vendor unspecified": "#cbd5e1", // slate-300
  Other: "#94a3b8", // slate-400 (legacy fallback)
};

export function LLMVendorDonut({ data }: { data: DonutDatum[] }) {
  return (
    <DonutChart
      data={data}
      colorMap={LLM_VENDOR_COLORS}
      centerSubLabel="general-LLM entries"
      height={280}
    />
  );
}
