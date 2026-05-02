/**
 * GET /api/fedramp-products.csv
 *
 * Streams every FedRAMP product (the full marketplace, not just AI-linked
 * ones) as a CSV download. Mirrors the source FedRAMP dashboard's
 * `/api/fedramp-products.csv` endpoint so external tooling that consumed
 * that endpoint continues to work after the port.
 *
 * Columns (in order):
 *   fedramp_id, cso, csp, csp_slug, status, impact_level,
 *   service_models, deployment_model, auth_type, auth_date,
 *   authorization_count, reuse_count, independent_assessor,
 *   partnering_agency, small_business, uei, website
 *
 * `service_models` is sourced from `fedramp_products.service_desc` (the
 * FedRAMP marketplace's service-description / SaaS-IaaS-PaaS string).
 *
 * No auth — same posture as the rest of the dashboard.
 */

import { NextResponse } from "next/server";
import { getFedrampProducts } from "@/lib/db";
import { csvRow } from "@/lib/csv";

const HEADER = [
  "fedramp_id",
  "cso",
  "csp",
  "csp_slug",
  "status",
  "impact_level",
  "service_models",
  "deployment_model",
  "auth_type",
  "auth_date",
  "authorization_count",
  "reuse_count",
  "independent_assessor",
  "partnering_agency",
  "small_business",
  "uei",
  "website",
];

export async function GET() {
  let products;
  try {
    products = getFedrampProducts();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown DB error";
    return NextResponse.json(
      { error: `Failed to read FedRAMP products: ${msg}` },
      { status: 500 },
    );
  }

  const lines: string[] = [];
  lines.push(csvRow(HEADER));
  for (const p of products) {
    lines.push(
      csvRow([
        p.fedramp_id,
        p.cso,
        p.csp,
        p.csp_slug,
        p.status,
        p.impact_level,
        p.service_desc,
        p.deployment_model,
        p.auth_type,
        p.auth_date,
        p.authorization_count,
        p.reuse_count,
        p.independent_assessor,
        p.partnering_agency,
        p.small_business == null ? "" : p.small_business ? "Y" : "N",
        p.uei,
        p.website,
      ]),
    );
  }
  const body = lines.join("");

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="fedramp-products.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
