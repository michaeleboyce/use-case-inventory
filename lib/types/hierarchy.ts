/**
 * Federal organization hierarchy types for the dashboard.
 */

// -----------------------------------------------------------------------------
// Federal organization hierarchy
// -----------------------------------------------------------------------------

export type OrgLevel =
  | "department"
  | "independent"
  | "sub_agency"
  | "office"
  | "component";

export interface FederalOrganization {
  id: number;
  name: string;
  short_name: string | null;
  abbreviation: string | null;
  slug: string;
  parent_id: number | null;
  level: OrgLevel;
  hierarchy_path: string | null;
  depth: number;
  is_cfo_act_agency: number;
  is_cabinet_department: number;
  is_active: number;
  display_order: number | null;
  description: string | null;
  website: string | null;
  legacy_agency_id: number | null;
}

export interface HierarchyBreadcrumb {
  id: number;
  name: string;
  abbreviation: string | null;
  slug: string;
  level: OrgLevel;
}

export interface OrgWithUseCaseCount extends FederalOrganization {
  use_case_count: number;
  descendant_use_case_count: number;
  child_count: number;
}
