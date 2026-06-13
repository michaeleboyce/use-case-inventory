/**
 * Capability ladder (chat → coding → analytics) and the enterprise-GenAI
 * delivery-tier rollup.
 */

import { getDb } from "../shared/init";
import { STAGE_BUCKET_SQL } from "../shared/sql-fragments";
import type { EnterpriseTierRollupRow } from "../../experience-shared";

export interface CapabilityLadderData {
  chat: {
    llm_access_2025: number;
    enterprise_agencies_2025: string[];
    enterprise_agencies_2024: number;
  };
  coding: {
    individual_2025: number;
    individual_2024: number;
    deployed_2025: number;
    pilot_2025: number;
    pre_deployment_2025: number;
    appendix_b_checkboxes: number;
    top_agencies: Array<{ abbreviation: string; count: number }>;
  };
  analytics: {
    env_known_rows: number;
  };
}

/**
 * The article's three-rung story in one payload: general chat assistants
 * (arrived broadly), coding assistance (present but mostly pre-production),
 * analytics platforms (federated; the inventory barely surfaces them).
 * All counts ride the row-by-row audited tags (audit/retag/* in the ETL
 * repo), not the original keyword heuristics.
 */
export function getCapabilityLadder(): CapabilityLadderData {
  const db = getDb();

  const llmAccess = (
    db
      .prepare<[], { c: number }>(
        `SELECT COUNT(DISTINCT use_case_id) AS c FROM use_case_tags
          WHERE is_general_llm_access = 1 AND use_case_id IS NOT NULL`,
      )
      .get() ?? { c: 0 }
  ).c;

  const enterpriseAgencies = db
    .prepare<[], { abbreviation: string }>(
      `SELECT DISTINCT a.abbreviation
         FROM use_cases uc
         JOIN agencies a ON a.id = uc.agency_id
         JOIN use_case_tags t ON t.use_case_id = uc.id
        WHERE t.is_generative_ai = 1 AND t.is_enterprise_wide = 1
        ORDER BY a.abbreviation`,
    )
    .all()
    .map((r) => r.abbreviation);

  const enterprise2024 = (
    db
      .prepare<[], { c: number }>(
        `SELECT COUNT(DISTINCT u.agency_id) AS c
           FROM use_cases_2024 u
           JOIN use_case_tags_2024_canonical t ON t.use_case_id_2024 = u.id
          WHERE t.is_generative_ai = 1 AND t.is_enterprise_wide = 1`,
      )
      .get() ?? { c: 0 }
  ).c;

  const codingStages = db
    .prepare<[], { bucket: string; c: number }>(
      `SELECT ${STAGE_BUCKET_SQL} AS bucket, COUNT(DISTINCT uc.id) AS c
         FROM use_cases uc
         JOIN use_case_tags t ON t.use_case_id = uc.id
        WHERE t.is_coding_tool = 1
        GROUP BY bucket`,
    )
    .all();
  const stage = (b: string) => codingStages.find((r) => r.bucket === b)?.c ?? 0;

  const coding2024 = (
    db
      .prepare<[], { c: number }>(
        `SELECT COUNT(*) AS c FROM use_case_tags_2024_canonical
          WHERE is_coding_tool = 1`,
      )
      .get() ?? { c: 0 }
  ).c;

  const appendixB = (
    db
      .prepare<[], { c: number }>(
        `SELECT COUNT(DISTINCT consolidated_use_case_id) AS c FROM use_case_tags
          WHERE is_coding_tool = 1 AND consolidated_use_case_id IS NOT NULL`,
      )
      .get() ?? { c: 0 }
  ).c;

  const topAgencies = db
    .prepare<[], { abbreviation: string; count: number }>(
      `SELECT a.abbreviation, COUNT(DISTINCT uc.id) AS count
         FROM use_cases uc
         JOIN agencies a ON a.id = uc.agency_id
         JOIN use_case_tags t ON t.use_case_id = uc.id
        WHERE t.is_coding_tool = 1
        GROUP BY a.abbreviation
        ORDER BY count DESC, a.abbreviation
        LIMIT 8`,
    )
    .all();

  const envKnown = (
    db
      .prepare<[], { c: number }>(
        `SELECT COUNT(DISTINCT use_case_id) AS c FROM use_case_tags
          WHERE use_case_id IS NOT NULL
            AND deployment_environment IS NOT NULL
            AND deployment_environment NOT IN ('', 'unknown')`,
      )
      .get() ?? { c: 0 }
  ).c;

  return {
    chat: {
      llm_access_2025: llmAccess,
      enterprise_agencies_2025: enterpriseAgencies,
      enterprise_agencies_2024: enterprise2024,
    },
    coding: {
      individual_2025:
        codingStages.reduce((acc, r) => acc + r.c, 0),
      individual_2024: coding2024,
      deployed_2025: stage("deployed"),
      pilot_2025: stage("pilot"),
      pre_deployment_2025: stage("pre_deployment"),
      appendix_b_checkboxes: appendixB,
      top_agencies: topAgencies,
    },
    analytics: {
      env_known_rows: envKnown,
    },
  };
}

/**
 * Per-(year, tier) counts of enterprise-wide GenAI use cases, classified by
 * delivery mode (permission / embedded COTS / tenanted / operated build).
 *
 * The rollup table is produced by the ETL repo's
 * `scripts/classify_enterprise_genai_tiers.py` and shipped inside the DB.
 * `make fix` drops it (full rebuild from sources) — so callers must tolerate
 * an empty result, and the page hides the chart rather than erroring.
 */
export function getEnterpriseTierRollup(): EnterpriseTierRollupRow[] {
  const db = getDb();
  const exists = db
    .prepare(
      `SELECT 1 FROM sqlite_master
       WHERE type = 'table' AND name = 'enterprise_genai_tier_rollup'`,
    )
    .get();
  if (!exists) return [];
  return db
    .prepare(
      `SELECT year, tier, n FROM enterprise_genai_tier_rollup
       ORDER BY year, tier`,
    )
    .all() as EnterpriseTierRollupRow[];
}
