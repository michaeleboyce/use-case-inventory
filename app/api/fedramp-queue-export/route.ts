/**
 * GET /api/fedramp-queue-export?group=vendor|reason|agency&value=<key>
 *
 * Streams the FedRAMP link curation queue as a CSV that an adjudicator can
 * edit and re-import via `scripts/import_fedramp_link_decisions.py`. The
 * column layout matches `scripts/export_fedramp_link_queue.py` exactly so
 * either source is interchangeable.
 *
 * No auth — consistent with the rest of the dashboard, which is intended for
 * an internal/curated audience (no PII or sensitive data is exposed).
 *
 * Query params:
 *   group  required, one of 'vendor' | 'reason' | 'agency'
 *   value  required, the group key returned by getLinkQueueGroups()
 *
 * Returns 400 on bad/missing params; 200 with text/csv otherwise.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getLinkQueueRows } from "@/lib/db";
import type { LinkQueueRow } from "@/lib/types";
import { csvRow } from "@/lib/csv";

const MAX_CANDIDATES = 5;

function isGroup(v: string | null): v is "vendor" | "reason" | "agency" {
  return v === "vendor" || v === "reason" || v === "agency";
}

function buildHeader(): string[] {
  const header = [
    "queue_id",
    "link_kind",
    "inventory_id",
    "inventory_name",
    "source_text",
    "reason",
  ];
  for (let i = 1; i <= MAX_CANDIDATES; i++) {
    header.push(
      `candidate_${i}_fedramp_id`,
      `candidate_${i}_csp`,
      `candidate_${i}_cso`,
      `candidate_${i}_score`,
    );
  }
  header.push("decision", "decision_notes");
  return header;
}

function buildRow(r: LinkQueueRow): Array<string | number | null | undefined> {
  const fields: Array<string | number | null | undefined> = [
    r.id,
    r.link_kind,
    r.inventory_id,
    r.inventory_name ?? "",
    r.source_text ?? "",
    r.reason,
  ];
  for (let i = 0; i < MAX_CANDIDATES; i++) {
    const c = r.candidates[i];
    if (!c) {
      fields.push("", "", "", "");
      continue;
    }
    // Agencies use parent_agency / parent_slug; products use csp / cso.
    const csp = c.csp ?? c.parent_agency ?? "";
    const cso = c.cso ?? c.parent_slug ?? "";
    const score =
      typeof c.score === "number" && Number.isFinite(c.score)
        ? c.score.toFixed(3)
        : "";
    fields.push(c.fedramp_id ?? "", csp, cso, score);
  }
  // decision + decision_notes are blank — adjudicator fills them.
  fields.push("", "");
  return fields;
}

/** Slugify a value for the Content-Disposition filename. Conservative: only
 *  ASCII alphanumerics + dash, fold case to lower. Empty input -> "all". */
function slugify(v: string): string {
  const s = v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "all";
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const group = url.searchParams.get("group");
  const value = url.searchParams.get("value");

  if (!isGroup(group)) {
    return NextResponse.json(
      {
        error:
          "Missing or invalid `group` query param (expected 'vendor' | 'reason' | 'agency').",
      },
      { status: 400 },
    );
  }
  if (value == null || value === "") {
    return NextResponse.json(
      { error: "Missing `value` query param." },
      { status: 400 },
    );
  }

  let rows: LinkQueueRow[];
  try {
    rows = getLinkQueueRows({ group, value });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown DB error";
    return NextResponse.json(
      { error: `Failed to read queue rows: ${msg}` },
      { status: 500 },
    );
  }

  // Sort by id ascending so re-running is byte-stable.
  rows.sort((a, b) => a.id - b.id);

  const header = buildHeader();
  const lines: string[] = [];
  lines.push(csvRow(header));
  for (const r of rows) {
    lines.push(csvRow(buildRow(r)));
  }
  const body = lines.join("");

  const filename = `fedramp-queue_${group}_${slugify(value)}.csv`;
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
