/**
 * GET /api/policy-documents.csv
 *
 * Streams the full AI policy tracker as a CSV download: every located
 * agency-issued AI policy document plus the White House / OMB governing
 * documents (distinguishable via `agency_type`). Backs the "Download CSV"
 * link on /policy and gives the article's policy-volume numbers an
 * exportable source.
 *
 * Row ids are deliberately omitted — they rotate on every ETL rebuild.
 *
 * No auth — same posture as the rest of the dashboard.
 */

import { NextResponse } from "next/server";
import { getGoverningDocuments, getPolicyDocuments } from "@/lib/db/policy";
import { csvRow } from "@/lib/csv";

const HEADER = [
  "agency_abbr",
  "agency_name",
  "agency_type",
  "issuing_office",
  "document_type",
  "document_title",
  "publication_year",
  "publication_date",
  "pages",
  "issuing_memo",
  "superseded",
  "is_public",
  "url",
  "access_status",
  "date_accessed",
  "notes",
];

export async function GET() {
  let documents;
  try {
    documents = [...getPolicyDocuments(), ...getGoverningDocuments()];
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown DB error";
    return NextResponse.json(
      { error: `Failed to read policy documents: ${msg}` },
      { status: 500 },
    );
  }

  const lines: string[] = [];
  lines.push(csvRow(HEADER));
  for (const d of documents) {
    lines.push(
      csvRow([
        d.agency_abbr,
        d.agency_name,
        d.agency_type,
        d.issuing_office,
        d.document_type,
        d.document_title,
        d.publication_year,
        d.publication_date,
        d.pages,
        d.issuing_memo,
        d.superseded ? "Y" : "N",
        d.is_public ? "Y" : "N",
        d.url,
        d.access_status,
        d.date_accessed,
        d.notes,
      ]),
    );
  }
  const body = lines.join("");

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ai-policy-documents.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
