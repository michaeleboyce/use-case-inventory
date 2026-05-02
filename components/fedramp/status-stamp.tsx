/**
 * FedRAMP authorization-status stamp. Five canonical states
 * ("FedRAMP Authorized", "FedRAMP In Process", "FedRAMP Ready",
 * "Pending Authorization", anything else) get a different border tone so
 * they stand out in tables and product detail headers without breaking the
 * editorial color discipline.
 */

import { MonoChip } from "@/components/editorial";

type Tone = "ink" | "stamp" | "verified" | "muted";

const STATUS_TONE: Record<string, Tone> = {
  "FedRAMP Authorized": "verified",
  "FedRAMP In Process": "stamp",
  "FedRAMP Ready": "ink",
  "Pending Authorization": "stamp",
};

export function StatusStamp({
  status,
  size = "sm",
}: {
  status: string | null | undefined;
  size?: "xs" | "sm" | "md";
}) {
  if (!status) {
    return (
      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        —
      </span>
    );
  }
  const tone = STATUS_TONE[status] ?? "muted";
  return (
    <MonoChip tone={tone} size={size}>
      {status}
    </MonoChip>
  );
}
