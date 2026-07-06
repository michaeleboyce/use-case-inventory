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
        -- Templates attach ONLY to consolidated entries (use_cases.
        -- template_id was never populated and is scheduled for drop).
        SELECT template_id,
               COUNT(*) AS use_case_count,
               COUNT(DISTINCT agency_id) AS agency_count
          FROM consolidated_use_cases
         WHERE template_id IS NOT NULL
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

  // Templates attach ONLY to consolidated entries (the Appendix B COTS
  // table); use_cases.template_id was never populated and is scheduled
  // for physical drop.
  const agencies = db
    .prepare<[number], { id: number; name: string; abbreviation: string; count: number }>(`
      SELECT a.id, a.name, a.abbreviation, COUNT(*) AS count
        FROM consolidated_use_cases c
        JOIN agencies a ON a.id = c.agency_id
       WHERE c.template_id = ?
       GROUP BY a.id
       ORDER BY count DESC, a.name COLLATE NOCASE ASC
    `)
    .all(id);

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
      .prepare<[number], { c: number }>(
        `SELECT COUNT(*) AS c FROM consolidated_use_cases WHERE template_id = ?`,
      )
      .get(id) ?? { c: 0 }
  ).c;

  return { ...template, agencies, products, use_case_count };
}

/**
 * Per-entry rows for a template. Templates attach only to consolidated
 * entries (the former use_cases arm matched 0 rows by construction —
 * use_cases.template_id was never populated). Primary product resolved
 * via the m020 entry_primary_products view.
 */
export function getEntriesForTemplate(templateId: number): TemplateEntryRow[] {
  const stmt = getDb().prepare<[number], TemplateEntryRow>(`
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
      LEFT JOIN entry_primary_products epp
             ON epp.entry_kind = 'consolidated' AND epp.entry_id = c.id
      LEFT JOIN products p ON p.id = epp.product_id
     WHERE c.template_id = ?
     ORDER BY agency_name COLLATE NOCASE ASC
  `);
  return stmt.all(templateId);
}
