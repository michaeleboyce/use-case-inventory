import {
  LLM_VENDOR_UNSPECIFIED_PREDICATE,
  STAGE_BUCKET_SQL,
} from "../shared/sql-fragments";
import type { UseCaseFilterInput } from "../../types";

/**
 * Compiled WHERE / JOIN fragments for one inventory arm (use_cases or
 * consolidated_use_cases). Each branch is composed independently so the
 * orchestrator in `refined-search.ts` can emit count + window queries that
 * combine the use-case arm and the consolidated arm with disjoint params.
 */
export interface FilterBranch {
  /** WHERE clauses to AND together (already include the row-only predicates;
   *  tag predicates are kept separate so callers can decide whether to apply
   *  the use-case-tag join). */
  rowWhere: string[];
  /** Bound params for `rowWhere`, in order. */
  rowParams: (string | number)[];
  /** Tag predicates (apply to both arms via different join columns). */
  tagWhere: string[];
  /** Bound params for `tagWhere`. */
  tagParams: (string | number)[];
  /** Whether the orchestrator should LEFT JOIN `use_case_tags`. */
  joinTags: boolean;
}

/**
 * Does this filter set touch any column that only exists on `use_cases`?
 *
 * When true, the consolidated arm is silently elided because there's nothing
 * to match against. Mirrors the editorial rule in the explorer: filters like
 * `stage`, `vendor`, `topicAreas` only make sense for individual entries.
 */
export function hasUseCaseOnlyFilter(filters: UseCaseFilterInput): boolean {
  return (
    filters.stage != null ||
    (filters.stageBuckets != null && filters.stageBuckets.length > 0) ||
    filters.aiClassification != null ||
    filters.isHighImpact != null ||
    filters.vendor != null ||
    filters.vendorUnspecified != null ||
    (filters.bureaus != null && filters.bureaus.length > 0) ||
    (filters.topicAreas != null && filters.topicAreas.length > 0) ||
    (filters.isWithhelds != null && filters.isWithhelds.length > 0) ||
    (filters.contractingUsages != null && filters.contractingUsages.length > 0) ||
    filters.hasPii != null ||
    filters.hasCustomCode != null
  );
}

/**
 * Does this filter set require joining `use_case_tags`?
 *
 * Tag-based filters apply equally to both arms (the join column differs but
 * the predicates don't). When false, no LEFT JOIN is emitted at all.
 */
export function needsTagJoin(filters: UseCaseFilterInput): boolean {
  return (
    filters.entryType != null ||
    filters.deploymentScope != null ||
    filters.aiSophistication != null ||
    filters.isCodingTool != null ||
    filters.isGenAI != null ||
    (filters.entryTypes != null && filters.entryTypes.length > 0) ||
    (filters.deploymentScopes != null && filters.deploymentScopes.length > 0) ||
    (filters.aiSophistications != null &&
      filters.aiSophistications.length > 0) ||
    (filters.architectureTypes != null &&
      filters.architectureTypes.length > 0) ||
    (filters.useTypes != null && filters.useTypes.length > 0) ||
    (filters.highImpactDesignations != null &&
      filters.highImpactDesignations.length > 0) ||
    filters.isGeneralLLMAccess != null ||
    filters.isPublicFacing != null ||
    filters.hasATOorFedRAMP != null ||
    filters.hasMeaningfulRiskDocs != null ||
    // vendorUnspecified's predicate reads tag.* columns, so it needs the join.
    filters.vendorUnspecified != null
  );
}

/**
 * Build the tag-predicate buffer shared by both arms. Returns the WHERE
 * fragments (e.g. `tag.entry_type = ?`) plus their bound params. Callers
 * decide whether to actually emit the LEFT JOIN — see `needsTagJoin`.
 */
export function buildTagPredicates(
  filters: UseCaseFilterInput,
): { tagWhere: string[]; tagParams: (string | number)[] } {
  const tagWhere: string[] = [];
  const tagParams: (string | number)[] = [];

  if (filters.entryType) {
    tagWhere.push("tag.entry_type = ?");
    tagParams.push(filters.entryType);
  }
  if (filters.deploymentScope) {
    tagWhere.push("tag.deployment_scope = ?");
    tagParams.push(filters.deploymentScope);
  }
  if (filters.aiSophistication) {
    tagWhere.push("tag.ai_sophistication = ?");
    tagParams.push(filters.aiSophistication);
  }
  if (filters.isCodingTool === true) tagWhere.push("tag.is_coding_tool = 1");
  if (filters.isCodingTool === false)
    tagWhere.push("COALESCE(tag.is_coding_tool,0) = 0");
  if (filters.isGenAI === true) tagWhere.push("tag.is_generative_ai = 1");
  if (filters.isGenAI === false)
    tagWhere.push("COALESCE(tag.is_generative_ai,0) = 0");

  if (filters.entryTypes && filters.entryTypes.length > 0) {
    tagWhere.push(
      `tag.entry_type IN (${filters.entryTypes.map(() => "?").join(",")})`,
    );
    tagParams.push(...filters.entryTypes);
  }
  if (filters.deploymentScopes && filters.deploymentScopes.length > 0) {
    tagWhere.push(
      `tag.deployment_scope IN (${filters.deploymentScopes.map(() => "?").join(",")})`,
    );
    tagParams.push(...filters.deploymentScopes);
  }
  if (filters.aiSophistications && filters.aiSophistications.length > 0) {
    tagWhere.push(
      `tag.ai_sophistication IN (${filters.aiSophistications.map(() => "?").join(",")})`,
    );
    tagParams.push(...filters.aiSophistications);
  }
  if (filters.architectureTypes && filters.architectureTypes.length > 0) {
    tagWhere.push(
      `tag.architecture_type IN (${filters.architectureTypes.map(() => "?").join(",")})`,
    );
    tagParams.push(...filters.architectureTypes);
  }
  if (filters.useTypes && filters.useTypes.length > 0) {
    tagWhere.push(
      `tag.use_type IN (${filters.useTypes.map(() => "?").join(",")})`,
    );
    tagParams.push(...filters.useTypes);
  }
  if (
    filters.highImpactDesignations &&
    filters.highImpactDesignations.length > 0
  ) {
    tagWhere.push(
      `tag.high_impact_designation IN (${filters.highImpactDesignations.map(() => "?").join(",")})`,
    );
    tagParams.push(...filters.highImpactDesignations);
  }
  if (filters.isGeneralLLMAccess === true)
    tagWhere.push("tag.is_general_llm_access = 1");
  if (filters.isPublicFacing === true)
    tagWhere.push("tag.is_public_facing = 1");
  if (filters.hasATOorFedRAMP === true)
    tagWhere.push("tag.has_ato_or_fedramp = 1");
  if (filters.hasMeaningfulRiskDocs === true)
    tagWhere.push("tag.has_meaningful_risk_docs = 1");

  return { tagWhere, tagParams };
}

/**
 * Compile the use_cases (individual-entry) WHERE clauses. Tag predicates are
 * returned separately so the orchestrator can layer them on top with the
 * same shape on the consolidated arm.
 */
export function buildUseCaseBranch(filters: UseCaseFilterInput): FilterBranch {
  const rowWhere: string[] = [];
  const rowParams: (string | number)[] = [];

  if (filters.agencyId != null) {
    rowWhere.push("uc.agency_id = ?");
    rowParams.push(filters.agencyId);
  }
  if (filters.agencyAbbr) {
    rowWhere.push("LOWER(a.abbreviation) = LOWER(?)");
    rowParams.push(filters.agencyAbbr);
  }
  if (filters.stage) {
    rowWhere.push("uc.stage_of_development = ?");
    rowParams.push(filters.stage);
  }
  if (filters.stageBuckets && filters.stageBuckets.length > 0) {
    // Normalized OMB M-25-21 buckets. Raw column has 30+ formatting variants
    // (e.g. "a) Pre-deployment – The use case is in a development...",
    // "Pre-deployment", "a) Pre-deployment - ..."). Bucket via substring match.
    const bucketExprs = filters.stageBuckets.map(
      () => `${STAGE_BUCKET_SQL} = ?`,
    );
    rowWhere.push(`(${bucketExprs.join(" OR ")})`);
    for (const b of filters.stageBuckets) rowParams.push(b);
  }
  if (filters.aiClassification) {
    rowWhere.push("uc.ai_classification = ?");
    rowParams.push(filters.aiClassification);
  }
  if (filters.isHighImpact) {
    rowWhere.push("uc.is_high_impact = ?");
    rowParams.push(filters.isHighImpact);
  }
  if (filters.productId != null) {
    rowWhere.push(
      `uc.id IN (
        SELECT entry_id FROM entry_product_edges
         WHERE entry_kind = 'use_case' AND product_id = ?
      )`,
    );
    rowParams.push(filters.productId);
  }
  if (filters.templateId != null) {
    rowWhere.push("uc.template_id = ?");
    rowParams.push(filters.templateId);
  }
  if (filters.vendor) {
    rowWhere.push("LOWER(uc.vendor_name) LIKE LOWER(?)");
    rowParams.push(`%${filters.vendor}%`);
  }
  if (filters.vendorUnspecified === true) {
    // References tag.* and uc.* — needsTagJoin() emits the LEFT JOIN.
    rowWhere.push(`(${LLM_VENDOR_UNSPECIFIED_PREDICATE})`);
  }
  if (filters.search) {
    rowWhere.push(
      "(LOWER(uc.use_case_name) LIKE LOWER(?) OR LOWER(uc.problem_statement) LIKE LOWER(?) OR LOWER(uc.system_outputs) LIKE LOWER(?) OR LOWER(COALESCE(uc.vendor_name,'')) LIKE LOWER(?))",
    );
    const s = `%${filters.search}%`;
    rowParams.push(s, s, s, s);
  }

  // Multi-select filters (Agent 4 additions).
  if (filters.agencyIds && filters.agencyIds.length > 0) {
    rowWhere.push(
      `uc.agency_id IN (${filters.agencyIds.map(() => "?").join(",")})`,
    );
    rowParams.push(...filters.agencyIds);
  }
  if (filters.agencyTypes && filters.agencyTypes.length > 0) {
    rowWhere.push(
      `a.agency_type IN (${filters.agencyTypes.map(() => "?").join(",")})`,
    );
    rowParams.push(...filters.agencyTypes);
  }
  if (filters.productIds && filters.productIds.length > 0) {
    const placeholders = filters.productIds.map(() => "?").join(",");
    rowWhere.push(
      `uc.id IN (
        SELECT entry_id FROM entry_product_edges
         WHERE entry_kind = 'use_case' AND product_id IN (${placeholders})
      )`,
    );
    rowParams.push(...filters.productIds);
  }
  if (filters.templateIds && filters.templateIds.length > 0) {
    rowWhere.push(
      `uc.template_id IN (${filters.templateIds.map(() => "?").join(",")})`,
    );
    rowParams.push(...filters.templateIds);
  }
  if (filters.bureaus && filters.bureaus.length > 0) {
    rowWhere.push(
      `uc.bureau_component IN (${filters.bureaus.map(() => "?").join(",")})`,
    );
    rowParams.push(...filters.bureaus);
  }
  if (filters.maturityTiers && filters.maturityTiers.length > 0) {
    // Maturity tier lives on agency_ai_maturity; filter by joining via agency_id.
    rowWhere.push(
      `uc.agency_id IN (SELECT agency_id FROM agency_ai_maturity WHERE maturity_tier IN (${filters.maturityTiers.map(() => "?").join(",")}))`,
    );
    rowParams.push(...filters.maturityTiers);
  }
  if (filters.topicAreas && filters.topicAreas.length > 0) {
    rowWhere.push(
      `uc.topic_area IN (${filters.topicAreas.map(() => "?").join(",")})`,
    );
    rowParams.push(...filters.topicAreas);
  }
  if (filters.productCategories && filters.productCategories.length > 0) {
    // Filter by IFP-curated products.product_type via the
    // use_case_products edge table. Mirrors the productIds branch above
    // but resolves products by category instead of id.
    const placeholders = filters.productCategories.map(() => "?").join(",");
    rowWhere.push(
      `uc.id IN (
        SELECT ucp.use_case_id
          FROM use_case_products ucp
          JOIN products p ON p.id = ucp.product_id
         WHERE p.product_type IN (${placeholders})
      )`,
    );
    rowParams.push(...filters.productCategories);
  }
  if (filters.isWithhelds && filters.isWithhelds.length > 0) {
    rowWhere.push(
      `uc.is_withheld IN (${filters.isWithhelds.map(() => "?").join(",")})`,
    );
    rowParams.push(...filters.isWithhelds);
  }
  if (filters.contractingUsages && filters.contractingUsages.length > 0) {
    rowWhere.push(
      `uc.development_type IN (${filters.contractingUsages.map(() => "?").join(",")})`,
    );
    rowParams.push(...filters.contractingUsages);
  }
  // has_pii / has_custom_code are filed as messy free-text (Yes / No / FALSE /
  // N/A / "Yes - <reason>"). A yes-only boolean matches the canonical "yes"
  // prefix and the "true" alias, which together cover the agency-affirmed set.
  if (filters.hasPii === true) {
    rowWhere.push(
      "(LOWER(TRIM(uc.has_pii)) LIKE 'yes%' OR LOWER(TRIM(uc.has_pii)) = 'true')",
    );
  }
  if (filters.hasCustomCode === true) {
    rowWhere.push(
      "(LOWER(TRIM(uc.has_custom_code)) LIKE 'yes%' OR LOWER(TRIM(uc.has_custom_code)) = 'true')",
    );
  }

  const { tagWhere, tagParams } = buildTagPredicates(filters);
  return { rowWhere, rowParams, tagWhere, tagParams, joinTags: needsTagJoin(filters) };
}

/**
 * Compile the consolidated_use_cases WHERE clauses (a subset of the filter
 * surface — same predicates that map onto `c.*` columns).
 *
 * Reuses the tag predicates produced for the use-case arm so both branches
 * share an identical tag filter (only the join column changes upstream).
 */
export function buildConsolidatedBranch(
  filters: UseCaseFilterInput,
  tagWhere: string[],
  tagParams: (string | number)[],
): FilterBranch {
  const rowWhere: string[] = [];
  const rowParams: (string | number)[] = [];

  if (filters.agencyId != null) {
    rowWhere.push("c.agency_id = ?");
    rowParams.push(filters.agencyId);
  }
  if (filters.agencyAbbr) {
    rowWhere.push("LOWER(a.abbreviation) = LOWER(?)");
    rowParams.push(filters.agencyAbbr);
  }
  if (filters.productId != null) {
    rowWhere.push(
      `c.id IN (
        SELECT entry_id FROM entry_product_edges
         WHERE entry_kind = 'consolidated' AND product_id = ?
      )`,
    );
    rowParams.push(filters.productId);
  }
  if (filters.templateId != null) {
    rowWhere.push("c.template_id = ?");
    rowParams.push(filters.templateId);
  }
  if (filters.search) {
    // Consolidated rows have no problem_statement / system_outputs / vendor_name.
    // Search the available text fields.
    rowWhere.push(
      "(LOWER(c.ai_use_case) LIKE LOWER(?) OR LOWER(COALESCE(c.commercial_product,'')) LIKE LOWER(?) OR LOWER(COALESCE(c.commercial_examples,'')) LIKE LOWER(?) OR LOWER(COALESCE(c.agency_uses,'')) LIKE LOWER(?))",
    );
    const s = `%${filters.search}%`;
    rowParams.push(s, s, s, s);
  }
  if (filters.agencyIds && filters.agencyIds.length > 0) {
    rowWhere.push(
      `c.agency_id IN (${filters.agencyIds.map(() => "?").join(",")})`,
    );
    rowParams.push(...filters.agencyIds);
  }
  if (filters.agencyTypes && filters.agencyTypes.length > 0) {
    rowWhere.push(
      `a.agency_type IN (${filters.agencyTypes.map(() => "?").join(",")})`,
    );
    rowParams.push(...filters.agencyTypes);
  }
  if (filters.productIds && filters.productIds.length > 0) {
    const placeholders = filters.productIds.map(() => "?").join(",");
    rowWhere.push(
      `c.id IN (
        SELECT entry_id FROM entry_product_edges
         WHERE entry_kind = 'consolidated' AND product_id IN (${placeholders})
      )`,
    );
    rowParams.push(...filters.productIds);
  }
  if (filters.templateIds && filters.templateIds.length > 0) {
    rowWhere.push(
      `c.template_id IN (${filters.templateIds.map(() => "?").join(",")})`,
    );
    rowParams.push(...filters.templateIds);
  }
  if (filters.maturityTiers && filters.maturityTiers.length > 0) {
    rowWhere.push(
      `c.agency_id IN (SELECT agency_id FROM agency_ai_maturity WHERE maturity_tier IN (${filters.maturityTiers.map(() => "?").join(",")}))`,
    );
    rowParams.push(...filters.maturityTiers);
  }
  if (filters.productCategories && filters.productCategories.length > 0) {
    const placeholders = filters.productCategories.map(() => "?").join(",");
    rowWhere.push(
      `c.id IN (
        SELECT cucp.consolidated_use_case_id
          FROM consolidated_use_case_products cucp
          JOIN products p ON p.id = cucp.product_id
         WHERE p.product_type IN (${placeholders})
      )`,
    );
    rowParams.push(...filters.productCategories);
  }

  return { rowWhere, rowParams, tagWhere, tagParams, joinTags: needsTagJoin(filters) };
}

/** Render a `FilterBranch` into a single `WHERE …` clause (or empty string). */
export function renderWhereSql(branch: FilterBranch): string {
  const combined = [...branch.rowWhere, ...branch.tagWhere];
  return combined.length ? `WHERE ${combined.join(" AND ")}` : "";
}

/** All bound params for a `FilterBranch`, in the order they appear in the
 *  rendered WHERE clause. */
export function renderParams(branch: FilterBranch): (string | number)[] {
  return [...branch.rowParams, ...branch.tagParams];
}
