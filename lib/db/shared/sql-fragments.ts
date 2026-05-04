/**
 * Shared SQL fragments referenced by multiple domain modules.
 *
 * Each fragment is a `string` (not a tagged template) so it can be
 * interpolated directly into a `prepare(...)` argument. They contain no
 * placeholders — pure SQL text only.
 */

/**
 * Normalize the 30+ free-text variants of `use_cases.stage_of_development`
 * into the 4 canonical OMB M-25-21 buckets:
 *   'pre_deployment' | 'pilot' | 'deployed' | 'retired' | 'unknown'.
 *
 * Usage:
 *   SELECT ${STAGE_BUCKET_SQL} AS stage_bucket FROM use_cases uc ...
 */
export const STAGE_BUCKET_SQL = `
  CASE
    WHEN uc.stage_of_development IS NULL OR TRIM(uc.stage_of_development) = ''
      THEN 'unknown'
    WHEN LOWER(uc.stage_of_development) LIKE '%retired%'
      THEN 'retired'
    WHEN LOWER(uc.stage_of_development) LIKE '%pilot%'
      THEN 'pilot'
    WHEN LOWER(uc.stage_of_development) LIKE '%deployed%'
      THEN 'deployed'
    WHEN LOWER(uc.stage_of_development) LIKE '%pre-deployment%'
      OR LOWER(uc.stage_of_development) LIKE '%pre deployment%'
      OR LOWER(uc.stage_of_development) LIKE '%development or acquisition%'
      THEN 'pre_deployment'
    ELSE 'unknown'
  END
`;

/**
 * Canonical SELECT for joined use-case rows: use_cases + agency + product +
 * template (left-joined). The shape matches the `JoinedUseCaseRow` type in
 * the use-cases domain module.
 */
export const USE_CASE_SELECT = `
  SELECT uc.*,
         a.name AS agency_name,
         a.abbreviation AS agency_abbreviation,
         p.canonical_name AS product_name,
         t.short_name AS template_short_name
    FROM use_cases uc
    JOIN agencies a ON a.id = uc.agency_id
    LEFT JOIN products p ON p.id = uc.product_id
    LEFT JOIN use_case_templates t ON t.id = uc.template_id
`;

/**
 * Canonical SELECT for external-evidence rows. Used by both
 * `getExternalEvidenceForUseCase` and `getExternalEvidenceForConsolidated`.
 */
export const EXTERNAL_EVIDENCE_SELECT = `
  SELECT id, use_case_id, consolidated_use_case_id, topic, status,
         source_url, source_quote, confidence, search_method,
         captured_at, captured_by, notes
    FROM use_case_external_evidence
`;

/**
 * Recursive-CTE fragment that resolves every `products.id` to its effective
 * set of FedRAMP links: direct links plus any links found by walking up
 * `parent_product_id` (capped at 5 hops to guard against accidental cycles).
 *
 * Emits one row per (inventory_product_id, fedramp_id) pair with
 * `inherited_from_parent_id` set to NULL when the link is direct, or the
 * ancestor product id when it came from the parent walk. Use as:
 *
 *   WITH RECURSIVE ${EFFECTIVE_FEDRAMP_LINKS_CTE}
 *   SELECT ... FROM effective_fedramp_links ...
 */
export const EFFECTIVE_FEDRAMP_LINKS_CTE = `
  product_chain(inventory_product_id, ancestor_id, depth) AS (
    SELECT id, id, 0 FROM products
    UNION ALL
    SELECT pc.inventory_product_id, p.parent_product_id, pc.depth + 1
      FROM product_chain pc
      JOIN products p ON p.id = pc.ancestor_id
     WHERE p.parent_product_id IS NOT NULL
       AND pc.depth < 5
  ),
  effective_fedramp_links AS (
    SELECT pc.inventory_product_id,
           l.fedramp_id,
           CASE WHEN pc.depth = 0 THEN NULL ELSE pc.ancestor_id END
             AS inherited_from_parent_id,
           pc.depth AS inherited_depth,
           l.confidence,
           l.source,
           l.score,
           l.notes
      FROM product_chain pc
      JOIN fedramp_product_links l
        ON l.inventory_product_id = pc.ancestor_id
  )
`;
