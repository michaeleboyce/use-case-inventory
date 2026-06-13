/**
 * Editorial masthead. Big italic nameplate, hairline-ruled navigation, and a
 * small command-palette chip on the right. Designed to sit directly below
 * the Dateline strip so the two together read like a newspaper flag.
 */

import Link from "next/link";
import { NavLink } from "./nav-link";
import { CommandPaletteHint } from "./command-palette";

// Primary nav: the high-frequency surfaces. Kept inline on the section rail.
// FedRAMP promoted from "More" — it's a real sub-area with its own
// marketplace / coverage / curate routes and readers go there often.
// Non-menu primary surfaces. Readiness (kicker II) renders as a dropdown
// between Agencies and Use Cases — see ReadinessMenu / the nav body.
const PRIMARY: Array<{ href: string; label: string; kicker: string }> = [
  { href: "/agencies", label: "Agencies", kicker: "I" },
  { href: "/use-cases", label: "Use Cases", kicker: "III" },
  { href: "/products", label: "Products", kicker: "IV" },
  { href: "/analytics", label: "Analytics", kicker: "V" },
  { href: "/policy", label: "Policy", kicker: "VI" },
];

// Readiness is its own sub-area with an overview + two named surfaces;
// expose them as a hover/focus dropdown the same way FedRAMP works.
const READINESS_SECTIONS: Array<{ href: string; label: string }> = [
  { href: "/readiness", label: "Overview" },
  { href: "/readiness/access", label: "AI Access & Scale" },
  { href: "/experience", label: "AI Experience" },
  { href: "/readiness/methodology", label: "Methodology" },
];

// FedRAMP is its own sub-area with an overview + three named surfaces. Each
// of Marketplace and Coverage has its own static drill-downs, so the dropdown
// lists them inline (marked `indent: true`) instead of leaving them only
// reachable via in-page cards. See AGENTS.md "Navigation discoverability".
const FEDRAMP_SECTIONS: Array<{ href: string; label: string; indent?: boolean }> = [
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
  { href: "/fedramp/coverage/fit", label: "Authorization fit", indent: true },
  { href: "/fedramp/coverage/agencies", label: "Agency gaps", indent: true },
  { href: "/fedramp/curate", label: "Curate" },
];

// Lower-frequency surfaces, collapsed into a "More" dropdown.
const MORE: Array<{ href: string; label: string; indent?: boolean }> = [
  { href: "/compare", label: "Compare" },
  { href: "/compare-years", label: "Compare Years" },
  { href: "/compare-years/silently-dropped", label: "Silently dropped", indent: true },
  { href: "/templates", label: "Templates" },
  { href: "/discrepancies", label: "Discrepancies" },
  { href: "/about", label: "Colophon" },
];

const BROWSE_DIMENSIONS: Array<{ slug: string; label: string }> = [
  { slug: "sophistication", label: "AI sophistication" },
  { slug: "high-impact", label: "High-impact" },
  { slug: "topic-area", label: "Topic area" },
  { slug: "vendor", label: "Vendor" },
  { slug: "category", label: "Product category" },
  { slug: "category-topic", label: "Category × Topic" },
];

export function Navigation() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/92 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto max-w-[1400px] px-4 md:px-8">
        {/* Masthead */}
        <div className="flex items-baseline justify-between gap-6 pt-4 pb-1">
          <Link
            href="/"
            aria-label="Federal AI Use Case Inventory — home"
            className="group inline-flex items-baseline gap-2"
          >
            <span className="font-display italic text-[1.8rem] leading-none tracking-[-0.02em] text-foreground transition-[letter-spacing] duration-500 group-hover:tracking-[-0.005em] md:text-[2.15rem]">
              The Federal AI
            </span>
            <span className="font-display text-[1.8rem] leading-none tracking-[-0.02em] text-foreground md:text-[2.15rem]">
              Inventory
            </span>
          </Link>
          <div className="hidden items-center gap-3 md:flex">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              ⌘K · Lookup
            </span>
            <CommandPaletteHint />
          </div>
        </div>

        {/* Section rail.
            NOTE: `overflow-x-auto` is intentionally absent. Adding it back
            creates a clipping ancestor that hides the absolute-positioned
            BrowseMenu / MoreMenu dropdowns when they pop out below the nav
            (overflow-x:auto implicitly sets overflow-y:auto in CSS). With
            5 primary items + Browse + More + a wide masthead the rail
            still fits without horizontal scroll on typical viewports;
            on very narrow mobile widths the items wrap, which is fine. */}
        <nav className="mt-1 flex flex-wrap items-stretch gap-0 border-t border-border/70 text-sm">
          {/* Agencies (I) */}
          {PRIMARY.slice(0, 1).map((link) => (
            <PrimaryNavLink key={link.href} link={link} />
          ))}
          {/* Readiness (II) — dropdown */}
          <ReadinessMenu />
          {/* Use Cases (III), Products (IV), Analytics (V) */}
          {PRIMARY.slice(1).map((link) => (
            <PrimaryNavLink key={link.href} link={link} />
          ))}
          <FedrampMenu />
          <BrowseMenu />
          <MoreMenu />
        </nav>
      </div>
    </header>
  );
}

/** A single numbered primary nav link (Agencies, Use Cases, …). */
function PrimaryNavLink({
  link,
}: {
  link: { href: string; label: string; kicker: string };
}) {
  return (
    <NavLink
      href={link.href}
      className="group relative -mt-px flex items-baseline gap-2 whitespace-nowrap border-t-2 border-transparent px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground data-[active=true]:border-[var(--stamp)] data-[active=true]:text-foreground md:px-4"
    >
      <span
        aria-hidden
        className="text-[9px] font-normal text-muted-foreground/70 group-data-[active=true]:text-[var(--stamp)]"
      >
        {link.kicker}
      </span>
      {link.label}
    </NavLink>
  );
}

/**
 * "Readiness" sub-area menu. Same CSS-only hover/focus-within pattern as
 * FedrampMenu. The trigger NavLink points to /readiness (the scorecard)
 * and shows active state for any `/readiness/*` path, so readers can click
 * the trigger to land on the scorecard or hover to jump straight to AI
 * Access & Scale / Methodology. Keeps roman kicker II so the numbered
 * section sequence (I · II · III · IV · V) stays intact.
 */
function ReadinessMenu() {
  return (
    <div className="group/readiness relative -mt-px flex items-stretch">
      <NavLink
        href="/readiness"
        className="group relative -mt-px flex items-baseline gap-2 whitespace-nowrap border-t-2 border-transparent px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground data-[active=true]:border-[var(--stamp)] data-[active=true]:text-foreground md:px-4"
      >
        <span
          aria-hidden
          className="text-[9px] font-normal text-muted-foreground/70 group-data-[active=true]:text-[var(--stamp)]"
        >
          II
        </span>
        Readiness
        <span aria-hidden className="ml-0.5 text-[9px] text-muted-foreground/70">
          ▾
        </span>
      </NavLink>
      <div
        role="menu"
        className="absolute left-0 top-full z-50 mt-0 hidden min-w-[14rem] border border-border bg-background py-1 shadow-md group-hover/readiness:block group-focus-within/readiness:block"
      >
        {READINESS_SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            role="menuitem"
            className="block whitespace-nowrap px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {s.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

/**
 * "More" overflow menu — same CSS-only hover/focus-within pattern as
 * BrowseMenu. Holds the lower-frequency surfaces (FedRAMP, Compare,
 * Templates, Colophon) so the primary section rail doesn't overflow.
 * The trigger has no destination of its own — keyboard users tab into
 * it and the dropdown opens on focus-within.
 */
function MoreMenu() {
  return (
    <div className="group/more relative -mt-px flex items-stretch">
      {/* Use a real <button> with tabIndex so keyboard users can open the
          dropdown without a destination link they don't want to navigate to. */}
      <button
        type="button"
        className="group flex cursor-default items-baseline gap-2 whitespace-nowrap border-t-2 border-transparent px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:text-foreground md:px-4"
      >
        <span aria-hidden className="text-[9px] font-normal text-muted-foreground/70">
          ⋯
        </span>
        More
        <span aria-hidden className="ml-0.5 text-[9px] text-muted-foreground/70">
          ▾
        </span>
      </button>
      <div
        role="menu"
        className="absolute right-0 top-full z-50 mt-0 hidden min-w-[14rem] border border-border bg-background py-1 shadow-md group-hover/more:block group-focus-within/more:block"
      >
        {MORE.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            role="menuitem"
            className={
              link.indent
                ? "block whitespace-nowrap pl-7 pr-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground/85 transition-colors hover:bg-accent hover:text-foreground"
                : "block whitespace-nowrap px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            }
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

/**
 * "Browse" cross-cut menu. CSS-only dropdown — no JS state — opens on
 * hover/focus-within so it works without client-side hydration. Mirrors
 * the styling of a NavLink but routes the trigger to /browse/sophistication
 * (the first dimension) so it's still useful with no JS.
 */
function BrowseMenu() {
  return (
    <div className="group/browse relative -mt-px flex items-stretch">
      <NavLink
        href="/browse/sophistication"
        className="group relative -mt-px flex items-baseline gap-2 whitespace-nowrap border-t-2 border-transparent px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground data-[active=true]:border-[var(--stamp)] data-[active=true]:text-foreground md:px-4"
      >
        <span
          aria-hidden
          className="text-[9px] font-normal text-muted-foreground/70 group-data-[active=true]:text-[var(--stamp)]"
        >
          ⊞
        </span>
        Browse
        <span aria-hidden className="ml-0.5 text-[9px] text-muted-foreground/70">
          ▾
        </span>
      </NavLink>
      <div
        role="menu"
        className="absolute left-0 top-full z-50 mt-0 hidden min-w-[14rem] border border-border bg-background py-1 shadow-md group-hover/browse:block group-focus-within/browse:block"
      >
        {BROWSE_DIMENSIONS.map((d) => (
          <Link
            key={d.slug}
            href={`/browse/${d.slug}`}
            role="menuitem"
            className="block whitespace-nowrap px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {d.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

/**
 * "FedRAMP" sub-area menu. Same CSS-only hover/focus-within pattern as
 * BrowseMenu and MoreMenu. The trigger NavLink points to /fedramp (the
 * overview page) and shows active state for any `/fedramp/*` path, so
 * readers can either click the trigger to land on the overview or hover
 * to jump straight into Marketplace / Coverage / Curate.
 */
function FedrampMenu() {
  return (
    <div className="group/fedramp relative -mt-px flex items-stretch">
      <NavLink
        href="/fedramp"
        className="group relative -mt-px flex items-baseline gap-2 whitespace-nowrap border-t-2 border-transparent px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground data-[active=true]:border-[var(--stamp)] data-[active=true]:text-foreground md:px-4"
      >
        <span
          aria-hidden
          className="text-[9px] font-normal text-muted-foreground/70 group-data-[active=true]:text-[var(--stamp)]"
        >
          VII
        </span>
        FedRAMP
        <span aria-hidden className="ml-0.5 text-[9px] text-muted-foreground/70">
          ▾
        </span>
      </NavLink>
      <div
        role="menu"
        className="absolute left-0 top-full z-50 mt-0 hidden min-w-[17rem] border border-border bg-background py-1 shadow-md group-hover/fedramp:block group-focus-within/fedramp:block"
      >
        {FEDRAMP_SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            role="menuitem"
            className={
              s.indent
                ? "block whitespace-nowrap pl-7 pr-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground/85 transition-colors hover:bg-accent hover:text-foreground"
                : "block whitespace-nowrap px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            }
          >
            {s.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
