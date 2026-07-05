"use client";

import { useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import type { PolicyDocument } from "@/lib/types/policy";

interface Props {
  documents: PolicyDocument[];
  /** Pre-select the agency filter (deep links from /agencies/[slug]). */
  initialAgency?: string;
}

const ch = createColumnHelper<PolicyDocument>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const columns: ColumnDef<PolicyDocument, any>[] = [
  ch.accessor("agency_abbr", {
    header: "Agency",
    cell: (info) => (
      <span className="font-mono text-[11px] font-bold">{info.getValue() as string}</span>
    ),
  }),
  ch.accessor("document_title", {
    header: "Title",
    cell: (info) => (
      <a
        href={info.row.original.url}
        target="_blank"
        rel="noopener noreferrer"
        className="underline-offset-2 hover:underline"
      >
        {info.getValue() as string}
      </a>
    ),
  }),
  ch.accessor("document_type", { header: "Type" }),
  ch.accessor("publication_year", { header: "Year" }),
  ch.accessor("issuing_memo", {
    header: "Memo",
    cell: (info) => (info.getValue() as string | null) ?? "—",
  }),
  ch.accessor("pages", {
    header: "Pages",
    cell: (info) => (info.getValue() as number | null) ?? "—",
  }),
];

export function DocumentDirectory({ documents, initialAgency }: Props) {
  const [agency, setAgency] = useState<string>(initialAgency ?? "");
  const [docType, setDocType] = useState<string>("");
  const [year, setYear] = useState<string>("");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "publication_year", desc: true },
  ]);

  const agencyOptions = useMemo(
    () => Array.from(new Set(documents.map((d) => d.agency_abbr))).sort(),
    [documents],
  );
  const typeOptions = useMemo(
    () => Array.from(new Set(documents.map((d) => d.document_type))).sort(),
    [documents],
  );
  const yearOptions = useMemo(
    () =>
      Array.from(new Set(documents.map((d) => d.publication_year)))
        .sort((a, b) => b - a)
        .map(String),
    [documents],
  );

  const filtered = useMemo(
    () =>
      documents.filter(
        (d) =>
          (!agency || d.agency_abbr === agency) &&
          (!docType || d.document_type === docType) &&
          (!year || String(d.publication_year) === year),
      ),
    [documents, agency, docType, year],
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-3 text-[11px]">
        <FilterSelect
          label="Agency"
          value={agency}
          options={agencyOptions}
          onChange={setAgency}
        />
        <FilterSelect
          label="Document type"
          value={docType}
          options={typeOptions}
          onChange={setDocType}
        />
        <FilterSelect
          label="Year"
          value={year}
          options={yearOptions}
          onChange={setYear}
        />
        <span className="self-center text-foreground/55">
          {filtered.length} of {documents.length} documents
        </span>
      </div>

      <table className="min-w-full border-collapse text-[12px]">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-b border-border text-left">
              {hg.headers.map((h) => (
                <th
                  key={h.id}
                  onClick={h.column.getToggleSortingHandler()}
                  className="cursor-pointer py-1.5 pr-3 font-mono text-[10px] uppercase tracking-wider text-foreground/60"
                >
                  {flexRender(h.column.columnDef.header, h.getContext())}
                  {{ asc: " ↑", desc: " ↓" }[h.column.getIsSorted() as string] ?? ""}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-b border-border/60">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="py-1 pr-3 align-top">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-foreground/70">
      <span>{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-none border border-border bg-background px-2 py-0.5 text-[11px]"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
