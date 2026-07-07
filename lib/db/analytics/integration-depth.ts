/**
 * Integration-depth analysis — the "how coupled is deployed AI?" figure.
 *
 * Population: the LABELED pilot+deployed set of INDIVIDUAL use cases (the only
 * rows the IFP 2026-07 integration-depth round covers). Depth counts are
 * DISTINCT use_case_ids at stage_normalized ∈ (pilot, deployed) with a non-null
 * `integration_depth`. The GenAI split reads `use_case_tags.is_generative_ai`.
 *
 * The coding-taxonomy panel counts every coding-tagged row's `coding_tool_type`
 * (not stage-restricted), plus how many of each are still pre-deployment — the
 * headline being that all four `coding_agent` filings are pre-deployment (zero
 * live agentic coding tools).
 *
 * See audit/article/fact_sheet.md for the pinned numbers this reproduces.
 */

import { getDb } from "../shared/init";
import {
  CODING_TOOL_TYPE_LABELS,
  INTEGRATION_DEPTH_LABELS,
  INTEGRATION_DEPTH_ORDER,
} from "../../derived-display";

export interface IntegrationDepthDatum {
  key: string;
  label: string;
  /** Distinct pilot+deployed use cases at this depth. */
  total: number;
  /** …of which is_generative_ai = 1. */
  genai: number;
  /** total − genai (classical / non-GenAI). */
  classical: number;
}

export interface CodingToolTypeDatum {
  key: string;
  label: string;
  count: number;
  /** …of which stage_normalized ∈ (pilot, deployed) — i.e. actually fielded. */
  live: number;
  /** …of which stage_normalized = 'pre_deployment'. */
  preDeployment: number;
}

export interface IntegrationDepthAnalysis {
  depths: IntegrationDepthDatum[];
  /** Sum of `total` across depths (pilot+deployed labeled population). */
  totalPD: number;
  /** Sum of `genai` across depths (the 478 GenAI pilot+deployed rows). */
  totalGenAI: number;
  coding: CodingToolTypeDatum[];
  codingTotal: number;
  /** coding_agent count and its pre-deployment count (equal → all pre-dep). */
  codingAgent: { count: number; preDeployment: number };
}

export function getIntegrationDepthAnalysis(): IntegrationDepthAnalysis {
  const db = getDb();

  const depthRows = db
    .prepare<[], { key: string; total: number; genai: number }>(
      `SELECT t.integration_depth AS key,
              COUNT(DISTINCT uc.id) AS total,
              COUNT(DISTINCT CASE WHEN t.is_generative_ai = 1 THEN uc.id END)
                AS genai
         FROM use_cases uc
         JOIN use_case_tags t ON t.use_case_id = uc.id
        WHERE uc.stage_normalized IN ('pilot', 'deployed')
          AND t.integration_depth IS NOT NULL
        GROUP BY t.integration_depth`,
    )
    .all();

  const byKey = new Map(depthRows.map((r) => [r.key, r]));
  // Emit in the canonical shallow → deep order (unclear last); any labeled
  // value not in the order list is appended so nothing silently disappears.
  const orderedKeys = [
    ...INTEGRATION_DEPTH_ORDER.filter((k) => byKey.has(k)),
    ...depthRows
      .map((r) => r.key)
      .filter((k) => !INTEGRATION_DEPTH_ORDER.includes(k)),
  ];
  const depths: IntegrationDepthDatum[] = orderedKeys.map((key) => {
    const r = byKey.get(key)!;
    return {
      key,
      label: INTEGRATION_DEPTH_LABELS[key] ?? key.replace(/_/g, " "),
      total: r.total,
      genai: r.genai,
      classical: r.total - r.genai,
    };
  });

  const totalPD = depths.reduce((a, d) => a + d.total, 0);
  const totalGenAI = depths.reduce((a, d) => a + d.genai, 0);

  const codingRows = db
    .prepare<
      [],
      { key: string; count: number; live: number; pre_deployment: number }
    >(
      `SELECT t.coding_tool_type AS key,
              COUNT(*) AS count,
              SUM(CASE WHEN uc.stage_normalized IN ('pilot', 'deployed') THEN 1 ELSE 0 END)
                AS live,
              SUM(CASE WHEN uc.stage_normalized = 'pre_deployment' THEN 1 ELSE 0 END)
                AS pre_deployment
         FROM use_case_tags t
         LEFT JOIN use_cases uc ON uc.id = t.use_case_id
        WHERE t.coding_tool_type IS NOT NULL
        GROUP BY t.coding_tool_type
        ORDER BY count DESC, t.coding_tool_type COLLATE NOCASE ASC`,
    )
    .all();

  const coding: CodingToolTypeDatum[] = codingRows.map((r) => ({
    key: r.key,
    label: CODING_TOOL_TYPE_LABELS[r.key] ?? r.key.replace(/_/g, " "),
    count: r.count,
    live: r.live,
    preDeployment: r.pre_deployment,
  }));
  const codingTotal = coding.reduce((a, c) => a + c.count, 0);
  const agent = coding.find((c) => c.key === "coding_agent");

  return {
    depths,
    totalPD,
    totalGenAI,
    coding,
    codingTotal,
    codingAgent: {
      count: agent?.count ?? 0,
      preDeployment: agent?.preDeployment ?? 0,
    },
  };
}
