/**
 * Template (use-case-template) queries.
 *
 * Templates are the OMB Appendix B "common AI use case" rows that agencies
 * file against to indicate they're using a known pattern. They're referenced
 * from BOTH `use_cases` and `consolidated_use_cases` (the consolidated table
 * holds the COTS rows from the OMB consolidated file). Counts and rosters
 * always union both tables.
 */

import { getDb } from "./shared/init";
import type { TemplateDetail, TemplateWithCounts, UseCaseTemplate } from "../types";

export interface TemplateEntryRow {
  use_case_id: number | null;
  use_case_name: string;
  slug: string | null;
  agency_id: number;
  agency_name: string;
  agency_abbreviation: string;
  product_id: number | null;
  product_name: string | null;
  vendor: string | null;
  commercial_examples: string | null;
  estimated_licenses_users: string | null;
}

export function getAllTemplates(): TemplateWithCounts[] {
  // Templates are referenced from both use_cases and consolidated_use_cases;
  // count across both so the list view matches reality.
  const stmt = getDb().prepare<[], TemplateWithCounts>(`
    SELECT t.*,
           COALESCE(counts.use_case_count, 0) AS use_case_count,
           COALESCE(counts.agency_count, 0) AS agency_count
      FROM use_case_templates t
      LEFT JOIN (
        SELECT template_id,
               COUNT(*) AS use_case_count,
               COUNT(DISTINCT agency_id) AS agency_count
          FROM (
            SELECT template_id, agency_id FROM use_cases
              WHERE template_id IS NOT NULL
            UNION ALL
            SELECT template_id, agency_id FROM consolidated_use_cases
              WHERE template_id IS NOT NULL
          )
         GROUP BY template_id
      ) counts ON counts.template_id = t.id
     ORDER BY use_case_count DESC, t.short_name COLLATE NOCASE ASC
  `);
  return stmt.all();
}

export function getTemplateById(id: number): TemplateDetail | null {
  const db = getDb();
  const template = db
    .prepare<[number], UseCaseTemplate>(
      `SELECT * FROM use_case_templates WHERE id = ? LIMIT 1`,
    )
    .get(id);
  if (!template) return null;

  // Templates can be referenced from either `use_cases` or
  // `consolidated_use_cases` (the Appendix B COTS table is the common case).
  // Both must be unioned so the stats on the template detail page reflect
  // actual usage — otherwise template_id references that only exist on the
  // consolidated side are silently dropped.
  const agencies = db
    .prepare<[number, number], { id: number; name: string; abbreviation: string; count: number }>(`
      SELECT a.id, a.name, a.abbreviation, SUM(n) AS count
        FROM (
          SELECT agency_id, COUNT(*) AS n FROM use_cases
            WHERE template_id = ? GROUP BY agency_id
          UNION ALL
          SELECT agency_id, COUNT(*) AS n FROM consolidated_use_cases
            WHERE template_id = ? GROUP BY agency_id
        ) sub
        JOIN agencies a ON a.id = sub.agency_id
       GROUP BY a.id
       ORDER BY count DESC, a.name COLLATE NOCASE ASC
    `)
    .all(id, id);

  const products = db
    .prepare<[number], { id: number; canonical_name: string; vendor: string | null; count: number }>(`
      SELECT p.id, p.canonical_name, p.vendor, COUNT(*) AS count
        FROM entry_product_edges epe
        JOIN inventory_entries ie
          ON ie.entry_kind = epe.entry_kind
         AND ie.entry_id = epe.entry_id
        JOIN products p ON p.id = epe.product_id
       WHERE ie.template_id = ?
       GROUP BY p.id
       ORDER BY count DESC, p.canonical_name COLLATE NOCASE ASC
    `)
    .all(id);

  const use_case_count = (
    db
      .prepare<[number, number], { c: number }>(
        `SELECT
           (SELECT COUNT(*) FROM use_cases WHERE template_id = ?)
           +
           (SELECT COUNT(*) FROM consolidated_use_cases WHERE template_id = ?)
           AS c`,
      )
      .get(id, id) ?? { c: 0 }
  ).c;

  return { ...template, agencies, products, use_case_count };
}

/**
 * Per-entry rows for a template — combines use_cases and any consolidated
 * rows for the same agency/template that don't already appear in use_cases.
 */
export function getEntriesForTemplate(templateId: number): TemplateEntryRow[] {
  const stmt = getDb().prepare<[number, number], TemplateEntryRow>(`
    SELECT uc.id AS use_case_id,
           uc.use_case_name AS use_case_name,
           uc.slug AS slug,
           a.id AS agency_id,
           a.name AS agency_name,
           a.abbreviation AS agency_abbreviation,
           p.id AS product_id,
           p.canonical_name AS product_name,
           p.vendor AS vendor,
           c.commercial_examples AS commercial_examples,
           c.estimated_licenses_users AS estimated_licenses_users
      FROM use_cases uc
      JOIN agencies a ON a.id = uc.agency_id
      LEFT JOIN products p ON p.id = uc.product_id
      LEFT JOIN consolidated_use_cases c
             ON c.agency_id = uc.agency_id
            AND c.template_id = uc.template_id
     WHERE uc.template_id = ?

    UNION ALL

    SELECT NULL AS use_case_id,
           c.ai_use_case AS use_case_name,
           c.slug AS slug,
           a.id AS agency_id,
           a.name AS agency_name,
           a.abbreviation AS agency_abbreviation,
           p.id AS product_id,
           p.canonical_name AS product_name,
           p.vendor AS vendor,
           c.commercial_examples AS commercial_examples,
           c.estimated_licenses_users AS estimated_licenses_users
      FROM consolidated_use_cases c
      JOIN agencies a ON a.id = c.agency_id
      LEFT JOIN products p ON p.id = c.product_id
     WHERE c.template_id = ?
       AND NOT EXISTS (
         SELECT 1 FROM use_cases uc2
          WHERE uc2.template_id = c.template_id
            AND uc2.agency_id = c.agency_id
       )
     ORDER BY agency_name COLLATE NOCASE ASC
  `);
  return stmt.all(templateId, templateId);
}
