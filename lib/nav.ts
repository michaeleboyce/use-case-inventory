/**
 * lib/nav.ts — the single IA registry.
 *
 * One typed description of the site's section structure: kicker numerals,
 * labels, hrefs, children (with indent flags for drill-downs), and a short
 * description per section for hub cards. Consumed by:
 *
 *   - components/navigation.tsx  (the top rail + dropdowns)
 *   - components/breadcrumbs.tsx (via breadcrumbTrail())
 *   - home-page section headers  (so § numbers mirror the nav exactly)
 *   - the command palette        (labels)
 *
 * Roman numerals are defined here and NOWHERE else — pages and cards that
 * need a section's kicker must read it from this registry rather than
 * hard-coding it (they used to drift across three files).
 *
 * Pure module: no React, no DB.
 */

export type NavChild = {
  href: string;
  label: string;
  /** Renders with left padding in dropdowns — a drill-down under a hub. */
  indent?: boolean;
};

export type NavSection = {
  /** Rail kicker: a roman numeral for numbered sections, a symbol otherwise. */
  kicker: string;
  label: string;
  href: string;
  /** One-liner for hub cards / the home front door. */
  description: string;
  children?: NavChild[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    kicker: "I",
    label: "Agencies",
    href: "/agencies",
    description:
      "Every filing agency side by side — directory, hierarchy, maturity ledger.",
  },
  {
    kicker: "II",
    label: "Readiness",
    href: "/readiness",
    description:
      "State-capacity readiness scored against a published A–F rubric.",
    children: [
      { href: "/readiness", label: "Overview" },
      { href: "/readiness/access", label: "AI Access & Scale" },
      { href: "/experience", label: "AI Experience" },
      { href: "/stories", label: "Stories: 2024 → 2025" },
      { href: "/readiness/methodology", label: "Methodology" },
    ],
  },
  {
    kicker: "III",
    label: "Use Cases",
    href: "/use-cases",
    description:
      "The explorer — every individual and consolidated entry, fully filterable.",
  },
  {
    kicker: "IV",
    label: "Products",
    href: "/products",
    description:
      "The commercial AI catalogue: vendors, categories, per-product adoption.",
  },
  {
    kicker: "V",
    label: "Analytics",
    href: "/analytics",
    description:
      "Adoption, market share, growth and reach across the inventory.",
  },
  {
    kicker: "VI",
    label: "Policy",
    href: "/policy",
    description:
      "M-25-21 compliance: strategies, plans, and agency-issued AI policy.",
  },
  {
    kicker: "VII",
    label: "FedRAMP",
    href: "/fedramp",
    description:
      "The marketplace mirror, cross-referenced against what agencies report.",
    children: [
      { href: "/fedramp", label: "Overview" },
      { href: "/fedramp/marketplace", label: "Marketplace" },
      { href: "/fedramp/marketplace/products", label: "Products", indent: true },
      { href: "/fedramp/marketplace/csps", label: "Providers", indent: true },
      { href: "/fedramp/marketplace/agencies", label: "Agencies", indent: true },
      { href: "/fedramp/marketplace/assessors", label: "3PAOs", indent: true },
      { href: "/fedramp/marketplace/analytics", label: "Analytics", indent: true },
      { href: "/fedramp/marketplace/compare", label: "Compare", indent: true },
      { href: "/fedramp/marketplace/about", label: "About", indent: true },
      { href: "/fedramp/coverage", label: "Coverage" },
      { href: "/fedramp/coverage/vendors", label: "Vendor coverage", indent: true },
      { href: "/fedramp/coverage/products", label: "Unused authorizations", indent: true },
      { href: "/fedramp/coverage/sleeping", label: "Sleeping authorizations", indent: true },
      { href: "/fedramp/coverage/unlinked-ai", label: "Unlinked AI products", indent: true },
      { href: "/fedramp/coverage/spread", label: "Authorization vs adoption", indent: true },
      { href: "/fedramp/coverage/fit", label: "Authorization fit", indent: true },
      { href: "/fedramp/coverage/agencies", label: "Agency gaps", indent: true },
      { href: "/fedramp/curate", label: "Curate" },
    ],
  },
];

/** Cross-cut browse dimensions (the ⊞ Browse menu). */
export const BROWSE_DIMENSIONS: Array<{ slug: string; label: string }> = [
  { slug: "sophistication", label: "AI sophistication" },
  { slug: "high-impact", label: "High-impact" },
  { slug: "topic-area", label: "Topic area" },
  { slug: "vendor", label: "Vendor" },
  { slug: "category", label: "Product category" },
  { slug: "category-topic", label: "Category × Topic" },
];

/** Lower-frequency reference surfaces (the ⋯ overflow menu). */
export const MORE_LINKS: NavChild[] = [
  { href: "/compare", label: "Compare" },
  { href: "/compare-years", label: "Compare Years" },
  { href: "/compare-years/silently-dropped", label: "Silently dropped", indent: true },
  { href: "/templates", label: "Templates" },
  { href: "/discrepancies", label: "Discrepancies" },
  { href: "/about", label: "Colophon" },
];

/** Section lookup by href prefix — longest match wins. */
export function sectionForPath(pathname: string): NavSection | undefined {
  let best: NavSection | undefined;
  for (const section of NAV_SECTIONS) {
    if (
      pathname === section.href ||
      pathname.startsWith(`${section.href}/`)
    ) {
      if (!best || section.href.length > best.href.length) best = section;
    }
  }
  return best;
}

/**
 * Breadcrumb trail for a path, derived from the registry: the section,
 * then any child whose href is a prefix of the path. Callers append the
 * dynamic leaf (agency name, product name, …) themselves.
 */
export function breadcrumbTrail(
  pathname: string,
): Array<{ href: string; label: string }> {
  const section = sectionForPath(pathname);
  if (!section) return [];
  const trail: Array<{ href: string; label: string }> = [
    { href: section.href, label: section.label },
  ];
  let bestChild: NavChild | undefined;
  for (const child of section.children ?? []) {
    if (child.href === section.href) continue;
    if (pathname === child.href || pathname.startsWith(`${child.href}/`)) {
      if (!bestChild || child.href.length > bestChild.href.length)
        bestChild = child;
    }
  }
  if (bestChild) trail.push({ href: bestChild.href, label: bestChild.label });
  return trail;
}
