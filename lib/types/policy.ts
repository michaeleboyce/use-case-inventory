// lib/types/policy.ts
//
// Types backing the dashboard's /policy section. Mirror the columns of
// `agency_ai_policy_documents` and `agency_ai_policy_compliance`, with
// SQLite booleans (0/1) normalized to TypeScript booleans by the query layer.

export type AgencyType = "Cabinet" | "Independent" | "White House / OMB";

export type AccessStatus =
  | "Downloaded"
  | "Link only"
  | "Not public"
  | "Not found";

export type IssuingMemo =
  | "M-24-10"
  | "M-25-21"
  | "M-25-22"
  | "EO"
  | null;

/** A single published AI policy document. */
export interface PolicyDocument {
  id: number;
  agency_abbr: string;
  agency_name: string;
  agency_type: AgencyType;
  issuing_office: string | null;
  document_type: string;
  document_title: string;
  publication_year: number;
  publication_date: string | null; // YYYY-MM-DD
  pages: number | null;
  issuing_memo: IssuingMemo;
  superseded: boolean;
  is_public: boolean;
  url: string;
  local_path: string | null;
  access_status: AccessStatus;
  date_accessed: string;
  notes: string | null;
}

/** Per-agency M-25-21 compliance summary. */
export interface AgencyCompliance {
  agency_abbr: string;
  agency_name: string;
  agency_type: Exclude<AgencyType, "White House / OMB">;
  searched: boolean;
  date_searched: string;
  ai_landing_page_url: string | null;
  ai_strategy_year: number | null;
  compliance_plan_year: number | null;
  genai_policy_year: number | null;
  caio_status: string | null;
  other_policy_count: number;
  total_documents: number;
  gaps: string | null;
  notes: string | null;
}

/** Aggregate counts shown in the /policy header strip. */
export interface PolicyStats {
  total_pages: number;        // agency docs only — excludes White House / OMB
  total_documents: number;    // agency docs only
  total_agencies: number;     // distinct agencies searched (45)
  strategies_published: number; // agencies with a M-25-21 AI Strategy doc
  plans_published: number;      // agencies with a M-25-21 Compliance Plan doc
  last_refreshed: string;       // MAX(date_searched) from compliance table
}

/** Per-agency total pages, for the horizontal bar chart. */
export interface AgencyPolicyPages {
  agency_abbr: string;
  agency_name: string;
  agency_type: "Cabinet" | "Independent";
  pages: number;
  docs: number;
}
