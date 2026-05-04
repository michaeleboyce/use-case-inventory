/**
 * Tiny query helpers wrapping `better-sqlite3`'s prepare/all/get pattern.
 *
 * Use for the static-SQL one-liner case:
 *
 *     export function getAgencies(): Agency[] {
 *       return query<Agency>(`SELECT * FROM agencies WHERE active = 1`);
 *     }
 *
 * Functions that build SQL dynamically (e.g. `IN (?, ?, ...)` placeholders or
 * a faceted-search WHERE clause) should keep their hand-written
 * `getDb().prepare(builtSql).all(...params)` form — the helper would obscure
 * the SQL construction without saving meaningful boilerplate.
 */

import { getDb } from "./init";

export function query<Row>(sql: string, params: unknown[] = []): Row[] {
  return getDb().prepare<unknown[], Row>(sql).all(...params);
}

export function queryOne<Row>(sql: string, params: unknown[] = []): Row | null {
  return (getDb().prepare<unknown[], Row>(sql).get(...params) as Row | undefined) ?? null;
}

export function count(sql: string, params: unknown[] = []): number {
  return (
    getDb().prepare<unknown[], { c: number }>(sql).get(...params)?.c ?? 0
  );
}
