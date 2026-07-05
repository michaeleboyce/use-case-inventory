"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import type { DiscrepancyRow, DiscrepancyStatus } from "@/lib/types";

const STATUS_LABEL: Record<DiscrepancyStatus, string> = {
  matched_exact: "Exact match",
  matched_fuzzy: "Fuzzy match",
  suggested_rename: "Suggested rename",
  omb_only: "OMB only (new)",
  db_only: "DB only (vanished)",
  duplicate_in_omb: "Duplicate in OMB",
  consolidated_upstream: "Consolidated upstream",
};

const STATUS_TONE: Record<DiscrepancyStatus, string> = {
  matched_exact: "bg-muted text-muted-foreground",
  matched_fuzzy: "bg-muted text-foreground",
  suggested_rename: "bg-[var(--highlight)]/15 text-foreground",
  omb_only: "bg-[var(--highlight)]/25 text-foreground",
  db_only: "bg-[var(--stamp)]/10 text-[var(--stamp)]",
  duplicate_in_omb: "bg-[var(--stamp)]/15 text-[var(--stamp)]",
  consolidated_upstream: "bg-[var(--highlight)]/15 text-foreground",
};

const STATUS_OPTIONS: DiscrepancyStatus[] = [
  "omb_only",
  "db_only",
  "consolidated_upstream",
  "suggested_rename",
  "duplicate_in_omb",
  "matched_fuzzy",
  "matched_exact",
];

const ALL_STATUSES = new Set<DiscrepancyStatus>(STATUS_OPTIONS);

function isStatus(value: string | null): value is DiscrepancyStatus {
  return value != null && ALL_STATUSES.has(value as DiscrepancyStatus);
}

export function DiscrepancyTable({
  rows,
  agencies,
  initialStatus,
  initialAgency,
  initialQuery,
}: {
  rows: DiscrepancyRow[];
  agencies: Array<{ agency: string; n: number }>;
  initialStatus?: DiscrepancyStatus | "all";
  initialAgency?: string;
  initialQuery?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [statusFilter, setStatusFilter] = useState<DiscrepancyStatus | "all">(
    initialStatus ?? "all",
  );
  const [agencyFilter, setAgencyFilter] = useState<string>(
    initialAgency ?? "all",
  );
  const [resolvedFilter, setResolvedFilter] = useState<
    "all" | "unresolved" | "resolved"
  >("unresolved");
  const [search, setSearch] = useState<string>(initialQuery ?? "");

  // Re-sync state from URL when it changes externally (e.g., pattern-card
  // click). We compare to current state to avoid setState->push->setState
  // loops with the writer effect below.
  const lastWrittenUrlRef = useRef<string | null>(null);
  useEffect(() => {
    const urlStatus = searchParams.get("status");
    const urlAgency = searchParams.get("agency");
    const urlQuery = searchParams.get("q");
    const nextStatus: DiscrepancyStatus | "all" = isStatus(urlStatus)
      ? urlStatus
      : "all";
    const nextAgency = urlAgency ?? "all";
    const nextQuery = urlQuery ?? "";
    setStatusFilter((prev) => (prev === nextStatus ? prev : nextStatus));
    setAgencyFilter((prev) => (prev === nextAgency ? prev : nextAgency));
    setSearch((prev) => (prev === nextQuery ? prev : nextQuery));
  }, [searchParams]);

  // Push filter state into the URL so pattern-card links remain shareable
  // and the back-button restores prior filter sets. router.replace +
  // scroll:false keeps the page from jumping when the user changes filters.
  useEffect(() => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (agencyFilter !== "all") params.set("agency", agencyFilter);
    if (search.trim() !== "") params.set("q", search.trim());
    const qs = params.toString();
    const nextUrl = qs ? `?${qs}` : "";
    if (lastWrittenUrlRef.current === nextUrl) return;
    lastWrittenUrlRef.current = nextUrl;
    const currentQs = searchParams.toString();
    if (currentQs === qs) return;
    router.replace(`/discrepancies${nextUrl}`, { scroll: false });
  }, [statusFilter, agencyFilter, search, router, searchParams]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.match_status !== statusFilter) return false;
      if (agencyFilter !== "all" && r.agency_abbreviation !== agencyFilter)
        return false;
      if (resolvedFilter === "unresolved" && r.resolved_at != null) return false;
      if (resolvedFilter === "resolved" && r.resolved_at == null) return false;
      if (q && !(r.use_case_name ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, statusFilter, agencyFilter, resolvedFilter, search]);

  const statusCounts: Record<DiscrepancyStatus, number> = useMemo(() => {
    const out: Record<DiscrepancyStatus, number> = {
      matched_exact: 0,
      matched_fuzzy: 0,
      suggested_rename: 0,
      omb_only: 0,
      db_only: 0,
      duplicate_in_omb: 0,
      consolidated_upstream: 0,
    };
    for (const r of rows) out[r.match_status]++;
    return out;
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <FilterSelect
          label="Status"
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as DiscrepancyStatus | "all")}
          options={[
            { value: "all", label: `All (${rows.length.toLocaleString()})` },
            ...STATUS_OPTIONS.map((s) => ({
              value: s,
              label: `${STATUS_LABEL[s]} (${statusCounts[s].toLocaleString()})`,
            })),
          ]}
        />
        <FilterSelect
          label="Agency"
          value={agencyFilter}
          onChange={setAgencyFilter}
          options={[
            { value: "all", label: `All agencies (${agencies.length})` },
            ...agencies.map((a) => ({
              value: a.agency,
              label: `${a.agency} (${a.n})`,
            })),
          ]}
        />
        <FilterSelect
          label="Resolved?"
          value={resolvedFilter}
          onChange={(v) =>
            setResolvedFilter(v as "all" | "unresolved" | "resolved")
          }
          options={[
            { value: "unresolved", label: "Unresolved only" },
            { value: "resolved", label: "Resolved only" },
            { value: "all", label: "Both" },
          ]}
        />
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-muted-foreground">
          Search name
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="filter by use-case name"
            className="border border-border px-2 py-1 text-sm font-normal normal-case tracking-normal text-foreground"
          />
        </label>
        <p className="ml-auto text-sm tabular-nums text-muted-foreground">
          {filtered.length.toLocaleString()} shown
        </p>
      </div>

      <div className="overflow-x-auto border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/20 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Agency</th>
              <th className="px-3 py-2">Use case</th>
              <th className="px-3 py-2">IFP ID</th>
              <th className="px-3 py-2">OMB ID</th>
              <th className="px-3 py-2 text-right">Drift</th>
              <th className="px-3 py-2 text-right">Score</th>
              <th className="px-3 py-2">Resolved</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((r) => (
              <tr key={r.audit_id} className="hover:bg-muted/20">
                <td className="px-3 py-2">
                  <span
                    className={`inline-block px-2 py-0.5 text-xs font-medium ${
                      STATUS_TONE[r.match_status]
                    }`}
                  >
                    {STATUS_LABEL[r.match_status]}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  {r.agency_abbreviation ?? "—"}
                </td>
                <td className="px-3 py-2">
                  {r.db_use_case_slug ? (
                    <Link
                      href={`/use-cases/${r.db_use_case_slug}`}
                      className="text-foreground hover:underline"
                    >
                      {r.use_case_name ?? "—"}
                    </Link>
                  ) : (
                    (r.use_case_name ?? "—")
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                  {r.db_use_case_id_text ?? "—"}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                  {r.omb_use_case_id ?? "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.drift_field_count > 0 ? r.drift_field_count : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {r.match_score != null ? r.match_score.toFixed(2) : "—"}
                </td>
                <td className="px-3 py-2">
                  {r.resolved_at ? (
                    <span className="inline-block bg-[var(--verified)]/10 px-2 py-0.5 text-xs font-medium text-[var(--verified)]">
                      ✓
                    </span>
                  ) : (
                    <span className="text-muted-foreground/50">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={`/discrepancies/${r.audit_id}`}
                    className="text-sm text-foreground underline-offset-4 hover:underline"
                  >
                    View →
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">
                  No rows match the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-border px-2 py-1 text-sm font-normal normal-case tracking-normal text-foreground"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
