/**
 * Server-rendered tree of federal organizations. Uses native <details> for
 * collapse/expand — no client JS needed. Each node links to /agencies/<slug>.
 *
 * Counts shown:
 *   "X uc" — use cases tagged DIRECTLY at this org (bureau_organization_id)
 *   "Y subtree" — use cases tagged at this org OR any descendant
 *
 * Top-level departments expand by default; sub-agencies collapse.
 */
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatNumber } from "@/lib/formatting";
import type { OrgWithUseCaseCount } from "@/lib/types";

export interface AgencyHierarchyTreeProps {
  orgs: OrgWithUseCaseCount[];
  /** When true, all departments default-expanded. When false, all collapsed. */
  defaultExpandTopLevel?: boolean;
  className?: string;
}

interface OrgNode extends OrgWithUseCaseCount {
  children: OrgNode[];
}

function buildTree(orgs: OrgWithUseCaseCount[]): OrgNode[] {
  const byId = new Map<number, OrgNode>();
  for (const o of orgs) byId.set(o.id, { ...o, children: [] });
  const roots: OrgNode[] = [];
  for (const o of orgs) {
    const node = byId.get(o.id);
    if (!node) continue;
    if (o.parent_id == null) {
      roots.push(node);
    } else {
      byId.get(o.parent_id)?.children.push(node);
    }
  }
  return roots;
}

const LEVEL_DOT: Record<string, string> = {
  department: "var(--stamp)",
  independent: "var(--stamp)",
  sub_agency: "var(--ink)",
  office: "var(--muted-foreground)",
  component: "var(--muted-foreground)",
};

export function AgencyHierarchyTree({
  orgs,
  defaultExpandTopLevel = true,
  className = "",
}: AgencyHierarchyTreeProps) {
  const roots = buildTree(orgs);
  return (
    <ul className={`flex flex-col divide-y divide-border border-y border-border ${className}`}>
      {roots.map((root) => (
        <li key={root.id}>
          <OrgNodeRow node={root} defaultOpen={defaultExpandTopLevel} />
        </li>
      ))}
    </ul>
  );
}

function OrgNodeRow({
  node,
  defaultOpen,
}: {
  node: OrgNode;
  defaultOpen: boolean;
}) {
  const hasChildren = node.children.length > 0;
  const tier =
    node.descendant_use_case_count > 0
      ? `${formatNumber(node.descendant_use_case_count)} subtree`
      : null;
  const direct =
    node.use_case_count > 0
      ? `${formatNumber(node.use_case_count)} direct`
      : null;
  const counts = [direct, tier].filter(Boolean).join(" · ");

  const summary = (
    <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2">
      {hasChildren ? (
        <ChevronRight
          className="size-3 shrink-0 transition-transform duration-150 group-open:rotate-90"
          style={{ color: LEVEL_DOT[node.level] ?? "currentColor" }}
          aria-hidden
        />
      ) : (
        <span
          aria-hidden
          className="inline-block size-1.5 shrink-0 translate-y-[1px] rounded-full"
          style={{ background: LEVEL_DOT[node.level] ?? "currentColor" }}
        />
      )}
      <Link
        href={`/agencies/${node.slug}`}
        className="font-display italic text-[1.05rem] leading-tight tracking-[-0.005em] text-foreground hover:text-[var(--stamp)]"
      >
        {node.name}
      </Link>
      {node.abbreviation && (
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {node.abbreviation}
        </span>
      )}
      <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground tabular-nums">
        {counts || "—"}
      </span>
    </span>
  );

  if (!hasChildren) {
    return <div className="pl-1">{summary}</div>;
  }

  return (
    <details className="group" open={defaultOpen}>
      <summary className="cursor-pointer list-none pl-1 marker:hidden">
        {summary}
      </summary>
      <ul className="ml-5 border-l border-border">
        {node.children.map((child) => (
          <li key={child.id} className="pl-3">
            <OrgNodeRow node={child} defaultOpen={false} />
          </li>
        ))}
      </ul>
    </details>
  );
}
