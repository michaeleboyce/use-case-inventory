import { getDb } from "../shared/init";
import { EXTERNAL_EVIDENCE_SELECT } from "../shared/sql-fragments";
import type { UseCaseExternalEvidence } from "../../types";

// -----------------------------------------------------------------------------
// External evidence (out-of-inventory corroboration)
// -----------------------------------------------------------------------------

function externalEvidenceTableExists(): boolean {
  const row = getDb()
    .prepare<[], { name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'use_case_external_evidence'`,
    )
    .get();
  return !!row;
}

/** External-corroboration rows for one use case. Empty array if the table
 *  hasn't been built yet (e.g. running against a pre-evidence DB snapshot). */
export function getExternalEvidenceForUseCase(
  useCaseId: number,
): UseCaseExternalEvidence[] {
  if (!externalEvidenceTableExists()) return [];
  return getDb()
    .prepare<[number], UseCaseExternalEvidence>(
      `${EXTERNAL_EVIDENCE_SELECT}
       WHERE use_case_id = ?
       ORDER BY CASE status
                  WHEN 'corroborated' THEN 0
                  WHEN 'inventory_only' THEN 1
                  WHEN 'searched_no_source' THEN 2
                ELSE 3 END,
                CASE confidence WHEN 'high' THEN 0 WHEN 'medium' THEN 1
                                WHEN 'low' THEN 2 ELSE 3 END,
                topic`,
    )
    .all(useCaseId);
}

/** External-corroboration rows for one consolidated entry. */
export function getExternalEvidenceForConsolidated(
  consolidatedId: number,
): UseCaseExternalEvidence[] {
  if (!externalEvidenceTableExists()) return [];
  return getDb()
    .prepare<[number], UseCaseExternalEvidence>(
      `${EXTERNAL_EVIDENCE_SELECT}
       WHERE consolidated_use_case_id = ?
       ORDER BY CASE status
                  WHEN 'corroborated' THEN 0
                  WHEN 'inventory_only' THEN 1
                  WHEN 'searched_no_source' THEN 2
                ELSE 3 END,
                CASE confidence WHEN 'high' THEN 0 WHEN 'medium' THEN 1
                                WHEN 'low' THEN 2 ELSE 3 END,
                topic`,
    )
    .all(consolidatedId);
}
