import { ShieldCheck, ShieldAlert, ShieldOff, Shield } from "lucide-react";
import type { FedrampCoverageState } from "@/lib/types";

/**
 * Editorial-styled badge that summarises a use case's FedRAMP coverage state.
 *
 * Reused on:
 *   - /use-cases/[slug] (hero / coverage section)
 *   - /products/[id] (when no FedRAMP linkage exists)
 *   - /fedramp/coverage/* (Agent C may consume)
 *
 * The visual styling uses the inventory's editorial palette tokens
 * (`--verified`, `--stamp`, muted) and intentionally avoids a pill border-radius
 * to match the section's mono-chip language.
 */
export function FedrampCoverageBadge({
  state,
  impactLevel,
  atoDate,
  className = "",
}: {
  state: FedrampCoverageState;
  impactLevel?: string | null;
  atoDate?: string | null;
  className?: string;
}) {
  const base =
    "inline-flex items-center gap-1.5 border bg-background px-2 py-1 font-mono text-[11px] uppercase tracking-[0.08em]";

  if (state === "covered") {
    const parts: string[] = ["FedRAMP authorized"];
    if (impactLevel) parts.push(`Impact: ${impactLevel}`);
    if (atoDate) parts.push(`ATO: ${atoDate}`);
    return (
      <span
        className={`${base} border-[var(--verified)] text-[var(--verified)] ${className}`}
        title="The using agency has an ATO for this product."
      >
        <ShieldCheck className="size-3.5" aria-hidden />
        <span>{parts.join(" · ")}</span>
      </span>
    );
  }

  if (state === "outside_scope") {
    return (
      <span
        className={`${base} border-[var(--stamp)] text-[var(--stamp)] ${className}`}
        title="The product is FedRAMP authorized, but this agency is not listed in the ATO scope."
      >
        <ShieldAlert className="size-3.5" aria-hidden />
        <span>FedRAMP authorized · this agency not in ATO scope</span>
      </span>
    );
  }

  if (state === "no_fedramp") {
    return (
      <span
        className={`${base} border-border text-muted-foreground ${className}`}
        title="This product has no FedRAMP listing."
      >
        <ShieldOff className="size-3.5" aria-hidden />
        <span>Not FedRAMP-authorized</span>
      </span>
    );
  }

  // no_link
  return (
    <span
      className={`${base} border-border text-muted-foreground ${className}`}
      title="The inventory product has not yet been resolved against FedRAMP — sits in the curation queue."
    >
      <Shield className="size-3.5" aria-hidden />
      <span>FedRAMP mapping pending review</span>
    </span>
  );
}
