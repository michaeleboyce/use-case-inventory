/**
 * Authorization ledger for a single FedRAMP product. Renders one row per
 * ATO event (Initial vs Reuse) with the agency that filed it and the key
 * dates from the source FedRAMP marketplace. Server Component — read-only
 * presentation of the rows handed in by `getFedrampAuthorizationsForProduct`.
 */

import Link from "next/link";
import { MonoChip } from "@/components/editorial";
import { formatDate, formatNumber } from "@/lib/formatting";
import type { FedrampAuthorization } from "@/lib/types";

type Row = FedrampAuthorization & {
  parent_agency: string | null;
  parent_slug: string | null;
};

export function AuthorizationsTable({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return (
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        No authorization events on file.
      </p>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-sm tabular-nums">
        <thead>
          <tr className="border-b-2 border-foreground text-left">
            <Th className="w-[3rem] text-right">№</Th>
            <Th>ATO type</Th>
            <Th>Agency</Th>
            <Th>Sub-agency</Th>
            <Th className="text-right">Issued</Th>
            <Th className="text-right">Expires</Th>
            <Th className="text-right">Annual assess.</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={row.id}
              className="border-b border-dotted border-border align-baseline hover:bg-foreground/[0.025]"
            >
              <td className="px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {String(idx + 1).padStart(2, "0")}
              </td>
              <td className="px-2 py-2">
                <span
                  className={`font-mono text-[10.5px] uppercase tracking-[0.14em] ${
                    row.ato_type === "Initial"
                      ? "text-foreground"
                      : "text-[var(--verified)]"
                  }`}
                >
                  {row.ato_type ?? "—"}
                </span>
              </td>
              <td className="px-2 py-2">
                {row.parent_slug && row.parent_agency ? (
                  <MonoChip
                    href={`/fedramp/marketplace/agencies/${row.parent_slug}`}
                    tone="ink"
                    size="xs"
                  >
                    {row.parent_agency}
                  </MonoChip>
                ) : (
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {row.parent_agency ?? "—"}
                  </span>
                )}
              </td>
              <td className="px-2 py-2 text-[12px] text-foreground/80">
                {row.sub_agency ?? "—"}
              </td>
              <td className="px-2 py-2 text-right font-mono text-[11px] text-foreground">
                {formatDate(row.ato_issuance_date)}
              </td>
              <td className="px-2 py-2 text-right font-mono text-[11px] text-muted-foreground">
                {formatDate(row.ato_expiration_date)}
              </td>
              <td className="px-2 py-2 text-right font-mono text-[11px] text-muted-foreground">
                {formatDate(row.annual_assessment_date)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-foreground">
            <td colSpan={7} className="px-2 py-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
              {formatNumber(rows.length)} authorization {rows.length === 1 ? "event" : "events"}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={`px-2 pb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground ${className}`}
    >
      {children}
    </th>
  );
}
