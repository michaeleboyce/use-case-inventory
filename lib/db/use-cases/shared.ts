import { getDb } from "../shared/init";
import type { UseCase, UseCaseTag, UseCaseWithTags } from "../../types";

export type JoinedUseCaseRow = UseCase & {
  agency_name: string;
  agency_abbreviation: string;
  product_name: string | null;
  template_short_name: string | null;
};

export function attachTagsToUseCases(rows: JoinedUseCaseRow[]): UseCaseWithTags[] {
  if (rows.length === 0) return [];
  const db = getDb();
  const ids = rows.map((r) => r.id);
  const placeholders = ids.map(() => "?").join(",");
  const tags = db
    .prepare<number[], UseCaseTag>(
      `SELECT * FROM use_case_tags WHERE use_case_id IN (${placeholders})`,
    )
    .all(...ids);
  const byId = new Map<number, UseCaseTag>();
  for (const t of tags) {
    if (t.use_case_id != null) byId.set(t.use_case_id, t);
  }
  return rows.map((r) => ({ ...r, tags: byId.get(r.id) ?? null }));
}
