"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { DiscrepancyRow, DiscrepancyStatus } from "@/lib/types";

const STATUS_LABEL: Record<DiscrepancyStatus, string> = {
  matched_exact: "Exact match",
  matched_fuzzy: "Fuzzy match",
  suggested_rename: "Suggested rename",
  omb_only: "OMB only (new)",
  db_only: "DB only (vanished)",
  duplicate_in_omb: "Duplicate in OMB",
};

const STATUS_TONE: Record<DiscrepancyStatus, string> = {
  matched_exact: "bg-stone-100 text-stone-700",
  matched_fuzzy: "bg-blue-50 text-blue-800",
  suggested_rename: "bg-violet-50 text-violet-800",
  omb_only: "bg-amber-50 text-amber-900",
  db_only: "bg-rose-50 text-rose-900",
  duplicate_in_omb: "bg-orange-50 text-orange-900",
};

const STATUS_OPTIONS: DiscrepancyStatus[] = [
  "omb_only",
  "db_only",
  "suggested_rename",
  "duplicate_in_omb",
  "matched_fuzzy",
  "matched_exact",
];

export function DiscrepancyTable({
  rows,
  agencies,
}: {
  rows: DiscrepancyRow[];
  agencies: Array<{ agency: string; n: number }>;
}) {
  const [statusFilter, setStatusFilter] = useState<DiscrepancyStatus | "all">(
    "all",
  );
  const [agencyFilter, setAgencyFilter] = useState<string>("all");
  const [resolvedFilter, setResolvedFilter] = useState<
    "all" | "unresolved" | "resolved"
  >("unresolved");
  const [search, setSearch] = useState<string>("");

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
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-stone-500">
          Search name
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="filter by use-case name"
            className="rounded border border-stone-300 px-2 py-1 text-sm font-normal normal-case tracking-normal text-stone-900"
          />
        </label>
        <p className="ml-auto text-sm tabular-nums text-stone-500">
          {filtered.length.toLocaleString()} shown
        </p>
      </div>

      <div className="overflow-x-auto rounded border border-stone-200">
        <table className="min-w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wider text-stone-500">
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
          <tbody className="divide-y divide-stone-100">
            {filtered.map((r) => (
              <tr key={r.audit_id} className="hover:bg-stone-50">
                <td className="px-3 py-2">
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
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
                      className="text-stone-900 hover:underline"
                    >
                      {r.use_case_name ?? "—"}
                    </Link>
                  ) : (
                    (r.use_case_name ?? "—")
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-stone-600">
                  {r.db_use_case_id_text ?? "—"}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-stone-600">
                  {r.omb_use_case_id ?? "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.drift_field_count > 0 ? r.drift_field_count : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-stone-600">
                  {r.match_score != null ? r.match_score.toFixed(2) : "—"}
                </td>
                <td className="px-3 py-2">
                  {r.resolved_at ? (
                    <span className="inline-block rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                      ✓
                    </span>
                  ) : (
                    <span className="text-stone-300">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={`/discrepancies/${r.audit_id}`}
                    className="text-sm text-stone-700 underline-offset-4 hover:underline"
                  >
                    View →
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-stone-500">
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
    <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-stone-500">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-stone-300 px-2 py-1 text-sm font-normal normal-case tracking-normal text-stone-900"
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
