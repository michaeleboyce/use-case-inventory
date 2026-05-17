import { getDb } from "../shared/init";

/** Discriminator for the supported cross-cut dimensions. Mirrors
 *  CrossCutDimension in lib/urls.ts but extended with `vendor` for the
 *  product-side cross-cut. */
export type CrossCutKey =
  | "entry_type"
  | "sophistication"
  | "scope"
  | "use_type"
  | "high_impact"
  | "topic_area"
  | "vendor"
  | "product_type";

export interface CrossCutValueRow {
  value: string;
  count: number;
  top_agencies: Array<{ id: number; abbreviation: string; count: number }>;
  top_products: Array<{ id: number; canonical_name: string; count: number }>;
}

export interface CrossCutHeatmapCell {
  value: string;
  agency_id: number;
  agency_abbreviation: string;
  count: number;
}

/** Resolve a dimension to (table.column) for the COUNT/GROUP BY. Vendor and
 *  topic_area need different join paths than the use_case_tags dims. */
function _crossCutSql(dim: CrossCutKey): {
  fromJoin: string;
  groupCol: string;
  whereGroupNotEmpty: string;
} {
  if (dim === "topic_area") {
    return {
      fromJoin: "FROM use_cases uc JOIN agencies a ON a.id = uc.agency_id",
      groupCol: "uc.topic_area",
      whereGroupNotEmpty: "uc.topic_area IS NOT NULL AND uc.topic_area <> ''",
    };
  }
  if (dim === "vendor") {
    return {
      fromJoin: `
        FROM use_cases uc
        JOIN agencies a ON a.id = uc.agency_id
        JOIN entry_product_edges epe
          ON epe.entry_kind = 'use_case' AND epe.entry_id = uc.id
        JOIN products p ON p.id = epe.product_id`,
      groupCol: "p.vendor",
      whereGroupNotEmpty: "p.vendor IS NOT NULL AND p.vendor <> ''",
    };
  }
  if (dim === "product_type") {
    return {
      fromJoin: `
        FROM use_cases uc
        JOIN agencies a ON a.id = uc.agency_id
        JOIN entry_product_edges epe
          ON epe.entry_kind = 'use_case' AND epe.entry_id = uc.id
        JOIN products p ON p.id = epe.product_id`,
      groupCol: "p.product_type",
      whereGroupNotEmpty:
        "p.product_type IS NOT NULL AND TRIM(p.product_type) <> '' AND LOWER(TRIM(p.product_type)) <> 'unclassified'",
    };
  }
  const tagCol = {
    entry_type: "tag.entry_type",
    sophistication: "tag.ai_sophistication",
    scope: "tag.deployment_scope",
    use_type: "tag.use_type",
    high_impact: "tag.high_impact_designation",
  }[dim];
  return {
    fromJoin: `
      FROM use_cases uc
      JOIN agencies a ON a.id = uc.agency_id
      JOIN use_case_tags tag ON tag.use_case_id = uc.id`,
    groupCol: tagCol,
    whereGroupNotEmpty: `${tagCol} IS NOT NULL AND ${tagCol} <> ''`,
  };
}

/** Per-value rollup for one cross-cut dimension. For each distinct value:
 *  the use-case count, top 3 agencies by count, and top 3 products by
 *  count among those use cases. */
export function getCrossCutSummary(dim: CrossCutKey): CrossCutValueRow[] {
  const db = getDb();
  const { fromJoin, groupCol, whereGroupNotEmpty } = _crossCutSql(dim);

  const valueRows = db
    .prepare<[], { value: string; count: number }>(
      `SELECT ${groupCol} AS value, COUNT(DISTINCT uc.id) AS count
         ${fromJoin}
        WHERE ${whereGroupNotEmpty}
        GROUP BY ${groupCol}
        ORDER BY count DESC, value COLLATE NOCASE ASC`,
    )
    .all();

  const agencyStmt = db.prepare<
    [string],
    { id: number; abbreviation: string; count: number }
  >(
    `SELECT a.id, a.abbreviation, COUNT(DISTINCT uc.id) AS count
       ${fromJoin}
      WHERE ${groupCol} = ?
      GROUP BY a.id, a.abbreviation
      ORDER BY count DESC
      LIMIT 3`,
  );

  const dimAlreadyHasProductsP = dim === "vendor" || dim === "product_type";
  const productSql = dimAlreadyHasProductsP
    ? `SELECT p.id, p.canonical_name, COUNT(DISTINCT uc.id) AS count
         ${fromJoin}
        WHERE ${groupCol} = ?
        GROUP BY p.id, p.canonical_name
        ORDER BY count DESC
        LIMIT 3`
    : `SELECT gp.id, gp.canonical_name, COUNT(DISTINCT uc.id) AS count
         ${fromJoin}
         JOIN entry_product_edges epe2
           ON epe2.entry_kind = 'use_case' AND epe2.entry_id = uc.id
         JOIN products gp ON gp.id = epe2.product_id
        WHERE ${groupCol} = ?
        GROUP BY gp.id, gp.canonical_name
        ORDER BY count DESC
        LIMIT 3`;
  const productStmt = db.prepare<
    [string],
    { id: number; canonical_name: string; count: number }
  >(productSql);

  return valueRows.map((row) => ({
    value: row.value,
    count: row.count,
    top_agencies: agencyStmt.all(row.value),
    top_products: productStmt.all(row.value),
  }));
}

/** value × agency cell counts for the heatmap view. */
export function getCrossCutHeatmap(
  dim: CrossCutKey,
  agencyLimit = 15,
): {
  agencies: Array<{ id: number; abbreviation: string; total: number }>;
  values: string[];
  cells: CrossCutHeatmapCell[];
  valueTotals: Record<string, number>;
} {
  const db = getDb();
  const { fromJoin, groupCol, whereGroupNotEmpty } = _crossCutSql(dim);

  const agencies = db
    .prepare<[number], { id: number; abbreviation: string; total: number }>(
      `SELECT a.id, a.abbreviation, COUNT(DISTINCT uc.id) AS total
         ${fromJoin}
        WHERE ${whereGroupNotEmpty}
        GROUP BY a.id, a.abbreviation
        ORDER BY total DESC
        LIMIT ?`,
    )
    .all(agencyLimit);

  if (agencies.length === 0) {
    return { agencies: [], values: [], cells: [], valueTotals: {} };
  }

  const valueRows = db
    .prepare<[], { value: string; total: number }>(
      `SELECT ${groupCol} AS value, COUNT(DISTINCT uc.id) AS total
         ${fromJoin}
        WHERE ${whereGroupNotEmpty}
        GROUP BY ${groupCol}
        ORDER BY total DESC, value COLLATE NOCASE ASC`,
    )
    .all();
  const values = valueRows.map((r) => r.value);
  const valueTotals: Record<string, number> = {};
  for (const r of valueRows) valueTotals[r.value] = r.total;

  const agencyIds = agencies.map((a) => a.id);
  const placeholders = agencyIds.map(() => "?").join(",");
  const cells = db
    .prepare<
      number[],
      { value: string; agency_id: number; agency_abbreviation: string; count: number }
    >(
      `SELECT ${groupCol} AS value,
              a.id AS agency_id,
              a.abbreviation AS agency_abbreviation,
              COUNT(DISTINCT uc.id) AS count
         ${fromJoin}
        WHERE ${whereGroupNotEmpty}
          AND a.id IN (${placeholders})
        GROUP BY ${groupCol}, a.id, a.abbreviation`,
    )
    .all(...agencyIds);

  return { agencies, values, cells, valueTotals };
}

/* --------------------------------------------------------------------- */
/* Category × Topic cross-tab                                            */
/* --------------------------------------------------------------------- */
/* 2D rollup powering /browse/category-topic — IFP-curated product       */
/* categories on rows × OMB-filed topic areas on columns. Reuses the     */
/* same join path as the product_type cross-cut (use_cases →             */
/* entry_product_edges → products) so cell counts are directly           */
/* comparable to the product_type heatmap.                               */
/* --------------------------------------------------------------------- */

export interface CategoryTopicCrossTab {
  /** Top-N product categories (rows), ordered by total use-case count desc. */
  categories: Array<{ value: string; total: number }>;
  /** Top-N topic areas (columns), ordered by total use-case count desc. */
  topics: Array<{ value: string; total: number }>;
  /** Non-zero (category, topic, count) cells. */
  cells: Array<{ category: string; topic: string; count: number }>;
  /** TRUE per-category totals across ALL topics (incl. off-cap). */
  categoryTotals: Record<string, number>;
  /** TRUE per-topic totals across ALL categories (incl. off-cap). */
  topicTotals: Record<string, number>;
  /** Total distinct categories with at least one use case (incl. off-cap). */
  totalCategoryCount: number;
  /** Total distinct topics with at least one use case (incl. off-cap). */
  totalTopicCount: number;
  /** Distinct use-cases backing the visible cap × cap window. */
  visibleUseCaseCount: number;
  /** Distinct use-cases backing the full corpus (any category × any topic). */
  totalUseCaseCount: number;
}

/** Cross-tabulate IFP product categories × OMB topic areas. Row/column
 *  caps default to 15 each; off-cap activity is summarized by the page. */
export function getCategoryTopicCrossTab(
  rowLimit = 15,
  colLimit = 15,
): CategoryTopicCrossTab {
  const db = getDb();

  // Shared join + filters: use the same join path as the product_type
  // cross-cut, AND require a non-empty topic_area.
  const fromJoin = `
    FROM use_cases uc
    JOIN entry_product_edges epe
      ON epe.entry_kind = 'use_case' AND epe.entry_id = uc.id
    JOIN products p ON p.id = epe.product_id`;
  const where = `
    p.product_type IS NOT NULL
    AND TRIM(p.product_type) <> ''
    AND LOWER(TRIM(p.product_type)) <> 'unclassified'
    AND uc.topic_area IS NOT NULL
    AND uc.topic_area <> ''`;

  // Per-category totals (across all topics).
  const categoryRows = db
    .prepare<[], { value: string; total: number }>(
      `SELECT p.product_type AS value, COUNT(DISTINCT uc.id) AS total
         ${fromJoin}
        WHERE ${where}
        GROUP BY p.product_type
        ORDER BY total DESC, value COLLATE NOCASE ASC`,
    )
    .all();

  // Per-topic totals (across all categories).
  const topicRows = db
    .prepare<[], { value: string; total: number }>(
      `SELECT uc.topic_area AS value, COUNT(DISTINCT uc.id) AS total
         ${fromJoin}
        WHERE ${where}
        GROUP BY uc.topic_area
        ORDER BY total DESC, value COLLATE NOCASE ASC`,
    )
    .all();

  const categoryTotals: Record<string, number> = {};
  for (const r of categoryRows) categoryTotals[r.value] = r.total;
  const topicTotals: Record<string, number> = {};
  for (const r of topicRows) topicTotals[r.value] = r.total;

  const categories = categoryRows.slice(0, rowLimit);
  const topics = topicRows.slice(0, colLimit);

  // Cell counts restricted to the visible window — keeps the payload
  // small even on dimensions with many off-cap values.
  let cells: Array<{ category: string; topic: string; count: number }> = [];
  if (categories.length > 0 && topics.length > 0) {
    const catNames = categories.map((c) => c.value);
    const topicNames = topics.map((t) => t.value);
    const catPh = catNames.map(() => "?").join(",");
    const topicPh = topicNames.map(() => "?").join(",");
    cells = db
      .prepare<
        string[],
        { category: string; topic: string; count: number }
      >(
        `SELECT p.product_type AS category,
                uc.topic_area AS topic,
                COUNT(DISTINCT uc.id) AS count
           ${fromJoin}
          WHERE ${where}
            AND p.product_type IN (${catPh})
            AND uc.topic_area IN (${topicPh})
          GROUP BY p.product_type, uc.topic_area`,
      )
      .all(...catNames, ...topicNames);
  }

  // Distinct use-case totals — visible window vs. full corpus.
  let visibleUseCaseCount = 0;
  if (categories.length > 0 && topics.length > 0) {
    const catNames = categories.map((c) => c.value);
    const topicNames = topics.map((t) => t.value);
    const catPh = catNames.map(() => "?").join(",");
    const topicPh = topicNames.map(() => "?").join(",");
    const visibleRow = db
      .prepare<string[], { n: number }>(
        `SELECT COUNT(DISTINCT uc.id) AS n
           ${fromJoin}
          WHERE ${where}
            AND p.product_type IN (${catPh})
            AND uc.topic_area IN (${topicPh})`,
      )
      .get(...catNames, ...topicNames);
    visibleUseCaseCount = visibleRow?.n ?? 0;
  }

  const totalRow = db
    .prepare<[], { n: number }>(
      `SELECT COUNT(DISTINCT uc.id) AS n
         ${fromJoin}
        WHERE ${where}`,
    )
    .get();
  const totalUseCaseCount = totalRow?.n ?? 0;

  return {
    categories,
    topics,
    cells,
    categoryTotals,
    topicTotals,
    totalCategoryCount: categoryRows.length,
    totalTopicCount: topicRows.length,
    visibleUseCaseCount,
    totalUseCaseCount,
  };
}
