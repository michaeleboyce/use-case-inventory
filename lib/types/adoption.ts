// lib/types/adoption.ts
//
// Types backing the /adoption technology-adoption-comparison page: the
// checked-in external baseline series (lib/data/adoption-series.ts) and the
// live GenAI series computed from the inventory DB (lib/db/adoption.ts).

/** One observation in an adoption series. */
export interface AdoptionPoint {
  /** ISO date (YYYY-MM-DD). Annual survey points use July 1 of the survey year. */
  date: string;
  value: number;
  /** True when the source gives only an approximate figure or date. */
  approx?: boolean;
}

/**
 * A single technology-adoption time series with full provenance. Every
 * series states its POPULATION and exact METRIC — household, workforce, and
 * federal-enterprise series measure different things and must never be
 * presented as interchangeable (the chart labels lean on these fields).
 */
export interface AdoptionSeries {
  id: string;
  label: string;
  /** Who the percentage/count is measured over. */
  population: string;
  /** Exactly what is being counted — the precise source definition. */
  metric: string;
  unit: "percent" | "count";
  /** Federal series: the policy mandate that starts the clock. Organic series: first availability. */
  start: { date: string; label: string };
  /** When the underlying technology became available, where that predates
   *  the clock start — surfaces the mandate LAG (e.g. HTTPS was in
   *  commercial use ~21 years before M-15-13). Omit when the clock start
   *  IS the introduction (organic series, the LLM pair). */
  introduced?: { date: string; label: string };
  /** Whether adoption was policy-mandated or organic — a key article distinction. */
  driver: "federal mandate" | "organic";
  source: { title: string; url: string; accessed: string; note?: string };
  points: AdoptionPoint[];
}

/** Live per-cycle GenAI adoption stats from the inventory DB. */
export interface GenAiCycleStats {
  inventory_year: number;
  total_use_cases: number;
  genai_use_cases: number;
  deployed_genai: number;
  enterprise_genai_agencies: number;
}
