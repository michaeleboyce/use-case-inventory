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
 * IA notes (July 2026 restructure):
 *   - The narrative essays (Experience, Stories) and the policy crosswalk
 *     live under a numbered "Features" section — they carry the site's
 *     argument and were previously buried in a hover dropdown.
 *   - The two Compare surfaces are disambiguated: "Compare agencies"
 *     (/agencies/compare, moved from /compare with a redirect) vs
 *     "Compare providers" (FedRAMP marketplace).
 *   - Browse dimensions are Use Cases drill-downs, not a separate menu.
 *   - "More" is gone; reference surfaces live in REFERENCE_LINKS.
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
  /** Rail kicker: a roman numeral for numbered sections. */
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
    children: [
      { href: "/agencies", label: "All agencies" },
      { href: "/agencies/compare", label: "Compare agencies" },
    ],
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
      { href: "/readiness/methodology", label: "Methodology & rubric" },
    ],
  },
  {
    kicker: "III",
    label: "Use Cases",
    href: "/use-cases",
    description:
      "The explorer — every individual and consolidated entry, fully filterable.",
    children: [
      { href: "/use-cases", label: "All use cases" },
      { href: "/templates", label: "Templates" },
      { href: "/browse/sophistication", label: "AI sophistication", indent: true },
      { href: "/browse/high-impact", label: "High-impact", indent: true },
      { href: "/browse/topic-area", label: "Topic area", indent: true },
      { href: "/browse/vendor", label: "Vendor", indent: true },
      { href: "/browse/category", label: "Product category", indent: true },
      { href: "/browse/category-topic", label: "Category × Topic", indent: true },
    ],
  },
  {
    kicker: "IV",
    label: "Products",
    href: "/products",
    description:
      "The commercial AI catalogue: vendors, categories, per-product adoption.",
    children: [
      { href: "/products", label: "Directory" },
      { href: "/fedramp/coverage/unlinked-ai", label: "Products × FedRAMP" },
    ],
  },
  {
    kicker: "V",
    label: "Analytics",
    href: "/analytics",
    description:
      "Adoption, market share, growth and year-over-year change.",
    children: [
      { href: "/analytics", label: "Inventory analytics" },
      { href: "/compare-years", label: "Year over year" },
      { href: "/compare-years/silently-dropped", label: "Silently dropped", indent: true },
      { href: "/fedramp/marketplace/analytics", label: "Marketplace analytics (FedRAMP)" },
    ],
  },
  {
    kicker: "VI",
    label: "Features",
    href: "/experience",
    description:
      "The essays and crosswalks that carry the argument — read these first.",
    children: [
      { href: "/experience", label: "The AI Experience" },
      { href: "/stories", label: "Stories: 2024 → 2025" },
      { href: "/policy", label: "Policy crosswalk" },
    ],
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
      { href: "/fedramp/marketplace/products", label: "Marketplace products", indent: true },
      { href: "/fedramp/marketplace/csps", label: "Providers", indent: true },
      { href: "/fedramp/marketplace/agencies", label: "Marketplace agencies", indent: true },
      { href: "/fedramp/marketplace/assessors", label: "3PAOs", indent: true },
      { href: "/fedramp/marketplace/analytics", label: "Marketplace analytics", indent: true },
      { href: "/fedramp/marketplace/compare", label: "Compare providers", indent: true },
      { href: "/fedramp/marketplace/about", label: "About the mirror", indent: true },
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

/**
 * Reference surfaces — methods, audits, provenance. Unnumbered; rendered
 * as the right-aligned "Reference" menu. (/glossary joins this list when
 * the route ships.)
 */
export const REFERENCE_LINKS: NavChild[] = [
  { href: "/about", label: "Methods & Sources" },
  { href: "/discrepancies", label: "Discrepancies" },
];

/**
 * Section lookup for a path. A section's own href prefix wins (longest
 * match); failing that, a section owning a child whose href prefixes the
 * path claims it (Features owns /stories and /policy this way). Cross-links
 * into another section's territory (e.g. Products → /fedramp/...) never
 * shadow the owning section because direct matches are checked first.
 */
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
  if (best) return best;
  let bestChildLen = 0;
  for (const section of NAV_SECTIONS) {
    for (const child of section.children ?? []) {
      if (pathname === child.href || pathname.startsWith(`${child.href}/`)) {
        if (child.href.length > bestChildLen) {
          best = section;
          bestChildLen = child.href.length;
        }
      }
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
  if (!section) {
    // Reference surfaces (Discrepancies, Methods & Sources) aren't numbered
    // sections but still deserve a clickable parent crumb.
    const ref = REFERENCE_LINKS.find(
      (r) => pathname === r.href || pathname.startsWith(`${r.href}/`),
    );
    return ref ? [{ href: ref.href, label: ref.label }] : [];
  }
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
