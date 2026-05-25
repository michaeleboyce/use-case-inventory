// app/policy/_view-model.ts — server-side data shaping for /policy.

import {
  getAgencyCompliance,
  getAgencyPagesByPolicy,
  getGoverningDocuments,
  getPolicyDocuments,
  getPolicyStats,
} from "@/lib/db/policy";
import type {
  AgencyCompliance,
  AgencyPolicyPages,
  PolicyDocument,
  PolicyStats,
} from "@/lib/types/policy";

export interface PolicyViewModel {
  stats: PolicyStats;
  compliance: AgencyCompliance[];
  pagesByAgency: AgencyPolicyPages[];
  documents: PolicyDocument[];
  governing: PolicyDocument[];
}

export async function buildPolicyViewModel(): Promise<PolicyViewModel> {
  return {
    stats: getPolicyStats(),
    compliance: getAgencyCompliance(),
    pagesByAgency: getAgencyPagesByPolicy(),
    documents: getPolicyDocuments(),
    governing: getGoverningDocuments(),
  };
}
