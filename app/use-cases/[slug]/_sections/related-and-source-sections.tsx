import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { FedrampCoverageBadge } from "@/components/fedramp/coverage-badge";
import {
  MonoChip,
  SCOPE_LABELS,
  SOPHISTICATION_LABELS,
} from "@/components/editorial";
import type { PeerUseCaseRow } from "@/lib/db";
import type { FedrampCoverageState, FedrampProduct } from "@/lib/types";

/** Renders a list of peer use cases — entries that share ≥3 analytical
 *  dimensions with the current use case (and are not from the same agency). */
export function PeerUseCaseList({ items }: { items: PeerUseCaseRow[] }) {
  return (
    <ul className="flex flex-col divide-y divide-border border-t-2 border-foreground">
      {items.map((peer) => {
        const peerHref = peer.slug
          ? `/use-cases/${peer.slug}`
          : `/use-cases/id/${peer.id}`;
        const sophLabel = peer.ai_sophistication
          ? (SOPHISTICATION_LABELS[peer.ai_sophistication] ??
            peer.ai_sophistication.replace(/_/g, " "))
          : null;
        const scopeLabel = peer.deployment_scope
          ? (SCOPE_LABELS[peer.deployment_scope] ??
            peer.deployment_scope.replace(/_/g, " "))
          : null;
        const stageLabel = peer.stage_of_development ?? null;
        const dims = [sophLabel, scopeLabel, stageLabel].filter(Boolean);
        return (
          <li
            key={peer.id}
            className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
          >
            <div className="flex min-w-0 items-baseline gap-3">
              <MonoChip
                href={`/agencies/${peer.agency_abbreviation}`}
                tone="stamp"
                size="xs"
                title={peer.agency_name}
              >
                {peer.agency_abbreviation}
              </MonoChip>
              <Link
                href={peerHref}
                className="min-w-0 truncate text-[14px] leading-snug text-foreground hover:text-[var(--stamp)]"
                title={peer.use_case_name}
              >
                {peer.use_case_name}
              </Link>
            </div>
            {dims.length > 0 && (
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground sm:text-right">
                {dims.join(" · ")}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function FedrampCoverageSection({
  coverage,
}: {
  coverage: {
    state: FedrampCoverageState;
    fedramp_products: FedrampProduct[];
    authorized_at_using_agency: boolean;
    inherited_via_parent: boolean;
  };
}) {
  const { state, fedramp_products, inherited_via_parent } = coverage;
  const primary = fedramp_products[0] ?? null;
  return (
    <div className="border-t-2 border-foreground pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <FedrampCoverageBadge
          state={state}
          impactLevel={primary?.impact_level ?? null}
        />
        {inherited_via_parent && state === "covered" ? (
          <span
            className="inline-flex items-center border border-[var(--stamp)] bg-background px-2 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--stamp)]"
            title="Coverage is inherited via the parent product's FedRAMP authorization (Phase-5 hierarchy)."
          >
            via parent platform
          </span>
        ) : null}
      </div>

      {state === "outside_scope" ? (
        <p className="mt-4 max-w-prose text-[13.5px] leading-relaxed text-muted-foreground">
          The product is FedRAMP authorized, but the filing agency does not
          appear in the ATO scope for this product. The agency may be operating
          under another agency&apos;s ATO, under a separate authorization not
          captured here, or without an authorization at all.
        </p>
      ) : null}

      {state === "no_fedramp" ? (
        <p className="mt-4 max-w-prose text-[13.5px] leading-relaxed text-muted-foreground">
          No FedRAMP marketplace listing has been mapped to this entry&apos;s
          linked product.
        </p>
      ) : null}

      {state === "no_link" ? (
        <p className="mt-4 max-w-prose text-[13.5px] leading-relaxed text-muted-foreground">
          This entry has no canonical product resolved yet, or the product is
          awaiting FedRAMP-link review in the curation queue.
        </p>
      ) : null}

      {fedramp_products.length > 0 ? (
        <ul className="mt-5 flex flex-col divide-y divide-border border-t border-border">
          {fedramp_products.map((p) => (
            <li key={p.fedramp_id} className="py-3">
              <Link
                href={`/fedramp/marketplace/products/${p.fedramp_id}`}
                className="group flex items-baseline justify-between gap-3 hover:text-[var(--stamp)]"
              >
                <div className="min-w-0">
                  <p className="font-display italic text-[1.15rem] leading-tight tracking-[-0.01em] text-foreground group-hover:text-[var(--stamp)]">
                    {p.cso}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {p.csp}
                    {p.impact_level ? ` · Impact ${p.impact_level}` : ""}
                  </p>
                </div>
                <ExternalLink
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function SourceInventoryLinks({
  inventoryUrl,
  csvUrl,
  sourceFile,
}: {
  inventoryUrl: string | null;
  csvUrl: string | null;
  sourceFile?: string | null;
}) {
  if (!inventoryUrl && !csvUrl) return null;
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
      <span>Source</span>
      {inventoryUrl ? (
        <Link
          href={inventoryUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-foreground hover:text-[var(--stamp)]"
        >
          Agency inventory page<span aria-hidden>↗</span>
        </Link>
      ) : null}
      {csvUrl ? (
        <Link
          href={csvUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-foreground hover:text-[var(--stamp)]"
        >
          Official inventory file<span aria-hidden>↗</span>
        </Link>
      ) : null}
      {sourceFile ? (
        <span className="text-muted-foreground normal-case tracking-normal">
          {sourceFile}
        </span>
      ) : null}
    </p>
  );
}
