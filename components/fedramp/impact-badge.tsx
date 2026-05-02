/**
 * Impact-level chip for FedRAMP rendering. Maps the FedRAMP impact level
 * vocabulary (Low / Moderate / High / Li-SaaS) onto the inventory
 * dashboard's monochip palette so it visually rhymes with the rest of the
 * editorial page surface. Falls back to a muted dash when the level is
 * unknown.
 */

import { MonoChip } from "@/components/editorial";

type ImpactTone = "ink" | "stamp" | "verified" | "muted";

const TONE_BY_IMPACT: Record<string, ImpactTone> = {
  Low: "muted",
  Moderate: "ink",
  High: "verified",
  "Li-SaaS": "muted",
  "LI-SaaS": "muted",
};

export function ImpactBadge({
  impact,
  size = "xs",
}: {
  impact: string | null | undefined;
  size?: "xs" | "sm";
}) {
  if (!impact) {
    return (
      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        —
      </span>
    );
  }
  const tone = TONE_BY_IMPACT[impact] ?? "ink";
  return (
    <MonoChip tone={tone} size={size} title={`Impact level: ${impact}`}>
      {impact}
    </MonoChip>
  );
}
