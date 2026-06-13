/**
 * Headline GenAI counts and the OMB ↔ IFP classification crosstab.
 */

import { getDb } from "../shared/init";
import { STAGE_BUCKET_SQL } from "../shared/sql-fragments";
import {
  GENAI_DEFINITIONS,
  type GenAiHeadline,
  type OmbIfpCrosstab,
} from "../../experience-shared";
import { genaiPredicate } from "./shared";

export function getGenAiHeadlines(): GenAiHeadline[] {
  return GENAI_DEFINITIONS.map((def) => {
    const row = getDb()
      .prepare<
        [],
        {
          total: number;
          deployed: number;
          pilot: number;
          pre_deployment: number;
          retired: number;
        }
      >(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN ${STAGE_BUCKET_SQL} = 'deployed' THEN 1 ELSE 0 END) AS deployed,
          SUM(CASE WHEN ${STAGE_BUCKET_SQL} = 'pilot' THEN 1 ELSE 0 END) AS pilot,
          SUM(CASE WHEN ${STAGE_BUCKET_SQL} = 'pre_deployment' THEN 1 ELSE 0 END) AS pre_deployment,
          SUM(CASE WHEN ${STAGE_BUCKET_SQL} = 'retired' THEN 1 ELSE 0 END) AS retired
        FROM use_cases uc
        LEFT JOIN use_case_tags t ON t.use_case_id = uc.id
        WHERE ${genaiPredicate(def)}
      `)
      .get();
    return {
      definition: def,
      total: row?.total ?? 0,
      deployed: row?.deployed ?? 0,
      pilot: row?.pilot ?? 0,
      pre_deployment: row?.pre_deployment ?? 0,
      retired: row?.retired ?? 0,
    };
  });
}

export function getOmbIfpCrosstab(): OmbIfpCrosstab {
  // COALESCE the ai_classification so NULL rows fall into the "not GenAI"
  // branch rather than evaluating to NULL on both LIKE and NOT LIKE.
  const row = getDb()
    .prepare<[], OmbIfpCrosstab>(`
      SELECT
        SUM(CASE WHEN COALESCE(uc.ai_classification,'') LIKE '%Generative%' AND t.is_generative_ai = 1 THEN 1 ELSE 0 END) AS omb_genai_ifp_genai,
        SUM(CASE WHEN COALESCE(uc.ai_classification,'') LIKE '%Generative%' AND COALESCE(t.is_generative_ai,0) = 0 THEN 1 ELSE 0 END) AS omb_genai_ifp_not,
        SUM(CASE WHEN COALESCE(uc.ai_classification,'') NOT LIKE '%Generative%' AND t.is_generative_ai = 1 THEN 1 ELSE 0 END) AS omb_not_ifp_genai,
        SUM(CASE WHEN COALESCE(uc.ai_classification,'') NOT LIKE '%Generative%' AND COALESCE(t.is_generative_ai,0) = 0 THEN 1 ELSE 0 END) AS omb_not_ifp_not
      FROM use_cases uc
      LEFT JOIN use_case_tags t ON t.use_case_id = uc.id
    `)
    .get();
  return (
    row ?? {
      omb_genai_ifp_genai: 0,
      omb_genai_ifp_not: 0,
      omb_not_ifp_genai: 0,
      omb_not_ifp_not: 0,
    }
  );
}
