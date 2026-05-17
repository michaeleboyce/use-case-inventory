import { getDb } from "../shared/init";
import type { LinkQueueRow } from "../../types";

// -----------------------------------------------------------------------------
// Link curation queue
// -----------------------------------------------------------------------------

function _hydrateQueueRow(row: {
  id: number;
  link_kind: "product" | "agency";
  inventory_id: number;
  source_text: string | null;
  candidate_fedramp_ids: string | null;
  reason: string;
  status: string;
  decision_notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  inventory_name: string | null;
  inventory_group: string | null;
}): LinkQueueRow {
  let candidates: LinkQueueRow["candidates"] = [];
  if (row.candidate_fedramp_ids) {
    try {
      const parsed = JSON.parse(row.candidate_fedramp_ids);
      if (Array.isArray(parsed)) candidates = parsed;
    } catch {
      // Malformed JSON — leave candidates empty rather than crash.
      candidates = [];
    }
  }
  return {
    id: row.id,
    link_kind: row.link_kind,
    inventory_id: row.inventory_id,
    source_text: row.source_text,
    reason: row.reason,
    status: row.status,
    decision_notes: row.decision_notes,
    candidates,
    created_at: row.created_at,
    updated_at: row.updated_at,
    inventory_name: row.inventory_name,
    inventory_group: row.inventory_group,
  };
}

const LINK_QUEUE_SELECT = `
  SELECT q.id,
         q.link_kind,
         q.inventory_id,
         q.source_text,
         q.candidate_fedramp_ids,
         q.reason,
         q.status,
         q.decision_notes,
         q.created_at,
         q.updated_at,
         CASE q.link_kind
           WHEN 'product' THEN p.canonical_name
           WHEN 'agency'  THEN a.name
         END AS inventory_name,
         CASE q.link_kind
           WHEN 'product' THEN p.vendor
           WHEN 'agency'  THEN a.agency_type
         END AS inventory_group
    FROM fedramp_link_queue q
    LEFT JOIN products p ON q.link_kind = 'product' AND p.id = q.inventory_id
    LEFT JOIN agencies a ON q.link_kind = 'agency'  AND a.id = q.inventory_id
`;

/** Group queue rows by vendor (product) / reason / agency. */
export function getLinkQueueGroups(
  groupBy: "vendor" | "reason" | "agency",
): Array<{ key: string; label: string; count: number }> {
  const db = getDb();
  if (groupBy === "vendor") {
    return db
      .prepare<[], { key: string; label: string; count: number }>(`
        SELECT COALESCE(p.vendor, '(no vendor)') AS key,
               COALESCE(p.vendor, '(no vendor)') AS label,
               COUNT(*) AS count
          FROM fedramp_link_queue q
          LEFT JOIN products p ON p.id = q.inventory_id
         WHERE q.link_kind = 'product' AND q.status = 'pending'
         GROUP BY COALESCE(p.vendor, '(no vendor)')
         ORDER BY count DESC, label COLLATE NOCASE ASC
      `)
      .all();
  }
  if (groupBy === "reason") {
    return db
      .prepare<[], { key: string; label: string; count: number }>(`
        SELECT reason AS key,
               reason AS label,
               COUNT(*) AS count
          FROM fedramp_link_queue
         WHERE status = 'pending'
         GROUP BY reason
         ORDER BY count DESC
      `)
      .all();
  }
  // agency
  return db
    .prepare<[], { key: string; label: string; count: number }>(`
      SELECT COALESCE(a.abbreviation, '(no agency)') AS key,
             COALESCE(a.name, '(no agency)') AS label,
             COUNT(*) AS count
        FROM fedramp_link_queue q
        LEFT JOIN agencies a ON a.id = q.inventory_id
       WHERE q.link_kind = 'agency' AND q.status = 'pending'
       GROUP BY COALESCE(a.abbreviation, '(no agency)')
       ORDER BY count DESC, label COLLATE NOCASE ASC
    `)
    .all();
}

/**
 * Queue rows for a single group (used by the curation page and CSV export).
 * `value` is the group key returned by `getLinkQueueGroups`. Pass
 * `filter.group = '*'` and any value to fetch all pending rows.
 */
export function getLinkQueueRows(filter: {
  group: "vendor" | "reason" | "agency" | "*";
  value: string;
}): LinkQueueRow[] {
  const db = getDb();
  type Row = Parameters<typeof _hydrateQueueRow>[0];
  let rows: Row[];
  if (filter.group === "*") {
    rows = db
      .prepare<[], Row>(
        `${LINK_QUEUE_SELECT} WHERE q.status = 'pending' ORDER BY inventory_name COLLATE NOCASE ASC`,
      )
      .all();
  } else if (filter.group === "vendor") {
    rows = db
      .prepare<[string], Row>(
        `${LINK_QUEUE_SELECT}
         WHERE q.link_kind = 'product'
           AND q.status = 'pending'
           AND COALESCE(p.vendor, '(no vendor)') = ?
         ORDER BY inventory_name COLLATE NOCASE ASC`,
      )
      .all(filter.value);
  } else if (filter.group === "reason") {
    rows = db
      .prepare<[string], Row>(
        `${LINK_QUEUE_SELECT}
         WHERE q.status = 'pending' AND q.reason = ?
         ORDER BY inventory_name COLLATE NOCASE ASC`,
      )
      .all(filter.value);
  } else {
    rows = db
      .prepare<[string], Row>(
        `${LINK_QUEUE_SELECT}
         WHERE q.link_kind = 'agency'
           AND q.status = 'pending'
           AND COALESCE(a.abbreviation, '(no agency)') = ?
         ORDER BY inventory_name COLLATE NOCASE ASC`,
      )
      .all(filter.value);
  }
  return rows.map(_hydrateQueueRow);
}
