/**
 * Editorial masthead. Big italic nameplate, hairline-ruled navigation, and a
 * small command-palette chip on the right. Designed to sit directly below
 * the Dateline strip so the two together read like a newspaper flag.
 *
 * The rail is driven entirely by the IA registry in lib/nav.ts — sections,
 * kickers, children, and the Reference overflow all come from there. To add
 * a page to the nav, register it in lib/nav.ts (see AGENTS.md "Navigation
 * discoverability"); do not hard-code links here.
 *
 * Dropdowns are CSS-only (hover/focus-within) — no JS state, so they work
 * without client-side hydration. All menus share the named group `menu`;
 * the wrappers are siblings, so nearest-ancestor resolution keeps them
 * independent.
 */

import Link from "next/link";
import { NavLink } from "./nav-link";
import { CommandPaletteHint } from "./command-palette";
import { NAV_SECTIONS, REFERENCE_LINKS, type NavChild } from "@/lib/nav";

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
            dropdowns when they pop out below the nav (overflow-x:auto
            implicitly sets overflow-y:auto in CSS). The rail wraps on very
            narrow viewports, which is fine — see
            docs/TODO-2026-07-05-mobile-nav.md for the deferred mobile menu. */}
        <nav className="mt-1 flex flex-wrap items-stretch gap-0 border-t border-border/70 text-sm">
          {NAV_SECTIONS.map((section) =>
            section.children && section.children.length > 0 ? (
              <SectionMenu
                key={section.href}
                kicker={section.kicker}
                label={section.label}
                href={section.href}
                items={section.children}
              />
            ) : (
              <PrimaryNavLink
                key={section.href}
                link={{
                  href: section.href,
                  label: section.label,
                  kicker: section.kicker,
                }}
              />
            ),
          )}
          <ReferenceMenu />
        </nav>
      </div>
    </header>
  );
}

const TRIGGER_CLASS =
  "group relative -mt-px flex items-baseline gap-2 whitespace-nowrap border-t-2 border-transparent px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground data-[active=true]:border-[var(--stamp)] data-[active=true]:text-foreground md:px-4";

const ITEM_CLASS =
  "block whitespace-nowrap px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";

const INDENTED_ITEM_CLASS =
  "block whitespace-nowrap pl-7 pr-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground/85 transition-colors hover:bg-accent hover:text-foreground";

/** A single numbered primary nav link (no dropdown). */
function PrimaryNavLink({
  link,
}: {
  link: { href: string; label: string; kicker: string };
}) {
  return (
    <NavLink href={link.href} className={TRIGGER_CLASS}>
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
 * A numbered section with a CSS-only dropdown. The trigger NavLink points
 * at the section hub (still useful with no JS) and shows active state for
 * the section's path prefix; hover/focus-within opens the child list.
 */
function SectionMenu({
  kicker,
  label,
  href,
  items,
}: {
  kicker: string;
  label: string;
  href: string;
  items: NavChild[];
}) {
  return (
    <div className="group/menu relative -mt-px flex items-stretch">
      <NavLink href={href} className={TRIGGER_CLASS}>
        <span
          aria-hidden
          className="text-[9px] font-normal text-muted-foreground/70 group-data-[active=true]:text-[var(--stamp)]"
        >
          {kicker}
        </span>
        {label}
        <span aria-hidden className="ml-0.5 text-[9px] text-muted-foreground/70">
          ▾
        </span>
      </NavLink>
      <div
        role="menu"
        className="absolute left-0 top-full z-50 mt-0 hidden min-w-[15rem] border border-border bg-background py-1 shadow-md group-hover/menu:block group-focus-within/menu:block"
      >
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            role="menuitem"
            className={item.indent ? INDENTED_ITEM_CLASS : ITEM_CLASS}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

/**
 * "Reference" overflow menu — methods, audits, provenance. Unnumbered and
 * right-aligned; the trigger is a real <button> so keyboard users can open
 * the dropdown without navigating anywhere.
 */
function ReferenceMenu() {
  return (
    <div className="group/menu relative -mt-px ml-auto flex items-stretch">
      <button
        type="button"
        className="group flex cursor-default items-baseline gap-2 whitespace-nowrap border-t-2 border-transparent px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:text-foreground md:px-4"
      >
        <span aria-hidden className="text-[9px] font-normal text-muted-foreground/70">
          §
        </span>
        Reference
        <span aria-hidden className="ml-0.5 text-[9px] text-muted-foreground/70">
          ▾
        </span>
      </button>
      <div
        role="menu"
        className="absolute right-0 top-full z-50 mt-0 hidden min-w-[15rem] border border-border bg-background py-1 shadow-md group-hover/menu:block group-focus-within/menu:block"
      >
        {REFERENCE_LINKS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            role="menuitem"
            className={item.indent ? INDENTED_ITEM_CLASS : ITEM_CLASS}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
