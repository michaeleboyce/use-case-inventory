// Human labels for enum values. Anything missing falls back to titleCase.
const LABELS: Record<string, string> = {
  CFO_ACT: "CFO Act Agency",
  INDEPENDENT: "Independent Agency",
  LEGISLATIVE: "Legislative Branch",

  custom_system: "Custom system",
  product_deployment: "Product deployment",
  bespoke_application: "Bespoke application",
  generic_use_pattern: "Generic use pattern",
  product_feature: "Product feature",

  enterprise_wide: "Enterprise-wide",
  department: "Department",
  bureau: "Bureau",
  office: "Office",
  team: "Team",
  pilot: "Pilot",
  unknown: "Unknown",

  general_llm: "General LLM",
  coding_assistant: "Coding assistant",
  agentic: "Agentic",
  classical_ml: "Classical ML",
  computer_vision: "Computer vision",
  nlp_specific: "NLP-specific",
  predictive_analytics: "Predictive analytics",

  inference_only: "Inference only",
  rag_pipeline: "RAG pipeline",
  fine_tuned: "Fine-tuned",
  custom_trained: "Custom trained",
  agentic_workflow: "Agentic workflow",

  mission_critical: "Mission-critical",
  administrative: "Administrative",
  it_operations: "IT operations",
  cybersecurity: "Cybersecurity",
  research: "Research",

  high_impact: "High impact",
  presumed_not_high_impact: "Presumed not high impact",
  not_high_impact: "Not high impact",

  // Year-over-year lineage statuses (use_case_year_links.lineage_status)
  continued: "Continued from 2024",
  new_2025: "New in 2025",
  renamed: "Renamed from 2024",
  split: "Split from 2024 entry",
};

export function labelFor(value: string): string {
  if (LABELS[value]) return LABELS[value];
  return value
    .split(/[_\s]+/)
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function parseCsv(v: string | null | undefined): string[] {
  if (!v) return [];
  return v
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function toggleInCsv(
  csv: string | null | undefined,
  value: string,
): string {
  const set = new Set(parseCsv(csv));
  if (set.has(value)) set.delete(value);
  else set.add(value);
  return Array.from(set).join(",");
}
