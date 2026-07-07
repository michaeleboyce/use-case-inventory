// lib/db/policy.ts
//
// Queries backing the dashboard's /policy section and the /agencies/[slug]
// policy subsection. All read from the `agency_ai_policy_documents` and
// `agency_ai_policy_compliance` tables (created by ETL migration m012,
// populated by scripts/load_ai_policy_tracker.py).

import { getDb } from "@/lib/db/shared/init";
import type {
  AgencyCompliance,
  AgencyPolicyPages,
  PolicyDocument,
  PolicyStats,
} from "@/lib/types/policy";

const DOC_COLUMNS = `
  id, agency_abbr, agency_name, agency_type, issuing_office, document_type,
  document_title, publication_year, publication_date, pages, issuing_memo,
  superseded, is_public, url, local_path, access_status, date_accessed, notes
`;

type RawDocumentRow = Omit<PolicyDocument, "superseded" | "is_public"> & {
  superseded: number;
  is_public: number;
};

type RawComplianceRow = Omit<AgencyCompliance, "searched"> & {
  searched: number;
};

function hydrateDoc(r: RawDocumentRow): PolicyDocument {
  return { ...r, superseded: r.superseded === 1, is_public: r.is_public === 1 };
}

function hydrateCompliance(r: RawComplianceRow): AgencyCompliance {
  return { ...r, searched: r.searched === 1 };
}

export function getPolicyStats(): PolicyStats {
  const db = getDb();
  // Pages and document counts deliberately exclude White House / OMB rows —
  // governing documents are the federal foundation, not agency policy.
  const agg = db
    .prepare<[], {
      total_pages: number;
      total_documents: number;
      in_force_documents: number;
      in_force_pages: number;
      publishing_agencies: number;
      earliest_year: number;
    }>(
      `SELECT
         COALESCE(SUM(pages), 0) AS total_pages,
         COUNT(*) AS total_documents,
         SUM(CASE WHEN superseded = 0 THEN 1 ELSE 0 END) AS in_force_documents,
         COALESCE(SUM(CASE WHEN superseded = 0 THEN pages ELSE 0 END), 0) AS in_force_pages,
         COUNT(DISTINCT agency_abbr) AS publishing_agencies,
         COALESCE(MIN(publication_year), 0) AS earliest_year
       FROM agency_ai_policy_documents
       WHERE agency_type != 'White House / OMB'`,
    )
    .get()!;

  const compliance = db
    .prepare<[], {
      total_agencies: number;
      strategies_published: number;
      plans_published: number;
      last_refreshed: string | null;
    }>(
      `SELECT
         COUNT(*) AS total_agencies,
         (SELECT COUNT(DISTINCT agency_abbr) FROM agency_ai_policy_documents
           WHERE document_type = 'M-25-21 AI Strategy') AS strategies_published,
         (SELECT COUNT(DISTINCT agency_abbr) FROM agency_ai_policy_documents
           WHERE document_type = 'M-25-21 Compliance Plan') AS plans_published,
         MAX(date_searched) AS last_refreshed
       FROM agency_ai_policy_compliance
       WHERE searched = 1`,
    )
    .get()!;

  return {
    total_pages: agg.total_pages,
    total_documents: agg.total_documents,
    in_force_documents: agg.in_force_documents,
    in_force_pages: agg.in_force_pages,
    publishing_agencies: agg.publishing_agencies,
    earliest_year: agg.earliest_year,
    total_agencies: compliance.total_agencies,
    strategies_published: compliance.strategies_published,
    plans_published: compliance.plans_published,
    last_refreshed: compliance.last_refreshed ?? "",
  };
}

export function getAgencyCompliance(): AgencyCompliance[] {
  const stmt = getDb().prepare<[], RawComplianceRow>(
    `SELECT * FROM agency_ai_policy_compliance
      ORDER BY
        CASE WHEN agency_type = 'Cabinet' THEN 0 ELSE 1 END,
        agency_name COLLATE NOCASE`,
  );
  return stmt.all().map(hydrateCompliance);
}

export function getAgencyPagesByPolicy(): AgencyPolicyPages[] {
  const stmt = getDb().prepare<[], AgencyPolicyPages>(
    `SELECT
       agency_abbr,
       agency_name,
       agency_type,
       COALESCE(SUM(pages), 0) AS pages,
       COUNT(*) AS docs
     FROM agency_ai_policy_documents
     WHERE agency_type != 'White House / OMB'
     GROUP BY agency_abbr, agency_name, agency_type
     ORDER BY pages DESC, agency_abbr ASC`,
  );
  return stmt.all();
}

export interface PolicyDocumentFilters {
  agency_abbr?: string;
  document_type?: string;
  publication_year?: number;
  issuing_memo?: string;
}

export function getPolicyDocuments(
  filters: PolicyDocumentFilters = {},
): PolicyDocument[] {
  const where: string[] = ["agency_type != 'White House / OMB'"];
  const params: (string | number)[] = [];
  if (filters.agency_abbr) {
    where.push("agency_abbr = ?");
    params.push(filters.agency_abbr);
  }
  if (filters.document_type) {
    where.push("document_type = ?");
    params.push(filters.document_type);
  }
  if (filters.publication_year !== undefined) {
    where.push("publication_year = ?");
    params.push(filters.publication_year);
  }
  if (filters.issuing_memo) {
    where.push("issuing_memo = ?");
    params.push(filters.issuing_memo);
  }
  const sql = `
    SELECT ${DOC_COLUMNS} FROM agency_ai_policy_documents
     WHERE ${where.join(" AND ")}
     ORDER BY publication_year DESC, agency_abbr ASC, document_type ASC
  `;
  const stmt = getDb().prepare<typeof params, RawDocumentRow>(sql);
  return stmt.all(...params).map(hydrateDoc);
}

export function getGoverningDocuments(): PolicyDocument[] {
  const stmt = getDb().prepare<[], RawDocumentRow>(
    `SELECT ${DOC_COLUMNS} FROM agency_ai_policy_documents
      WHERE agency_type = 'White House / OMB'
      ORDER BY publication_year ASC, document_title ASC`,
  );
  return stmt.all().map(hydrateDoc);
}

export function getDocumentsForAgency(abbr: string): PolicyDocument[] {
  const stmt = getDb().prepare<[string], RawDocumentRow>(
    `SELECT ${DOC_COLUMNS} FROM agency_ai_policy_documents
      WHERE agency_abbr = ?
      ORDER BY publication_year DESC, document_type ASC`,
  );
  return stmt.all(abbr).map(hydrateDoc);
}
