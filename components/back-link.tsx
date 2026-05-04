/**
 * Referrer-aware back link.
 *
 * Behavior:
 *  - On mount, reads `document.referrer`. If the referrer is same-origin AND
 *    its pathname matches one of the configured list-page prefixes (e.g.
 *    `/products`, `/agencies`, `/use-cases`), the link renders as
 *    "← Back to results" pointing at the referrer URL — preserving any
 *    filter / search context the user had when they clicked into the detail.
 *  - Otherwise (direct navigation, refresh, cross-origin, or referrer is a
 *    detail page), falls back to the static "← All <thing>" form pointing
 *    at the canonical list URL.
 *
 * Why document.referrer instead of an explicit `?ref=` URL param: avoids
 * touching every list-page → detail-page link site (cards, table rows,
 * sidebar lists). Trade-off: refresh on the detail page loses the back
 * URL. Acceptable — the page still works, just shows the static fallback.
 *
 * SSR note: this is a client component so server-rendered output uses the
 * fallback. The first paint after hydration may briefly flicker the label
 * if the referrer matches; the href change is debounced via useEffect, so
 * the visible-text upgrade happens within ~one frame.
 */

"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";

type Props = {
  /** Where to navigate if there's no usable referrer. */
  fallbackHref: string;
  /** Label suffix for the fallback (e.g. "All products"). */
  fallbackLabel: string;
  /** Pathname prefixes that count as a "results page" the user came from.
   *  Defaults to the three list pages: /products, /agencies, /use-cases. */
  listPrefixes?: string[];
  className?: string;
};

const DEFAULT_LIST_PREFIXES = ["/products", "/agencies", "/use-cases"];

export function BackLink({
  fallbackHref,
  fallbackLabel,
  listPrefixes = DEFAULT_LIST_PREFIXES,
  className,
}: Props) {
  const [referrerHref, setReferrerHref] = useState<string | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const ref = document.referrer;
    if (!ref) return;
    let url: URL;
    try {
      url = new URL(ref);
    } catch {
      return;
    }
    // Same-origin check
    if (url.origin !== window.location.origin) return;
    // Must be a list-page prefix, not a detail page
    const matchesListPrefix = listPrefixes.some((prefix) => {
      // Match exact list URL or list URL with searchParams (`/products?category=X`)
      // but NOT detail pages (`/products/123`).
      if (url.pathname === prefix) return true;
      if (url.pathname.startsWith(`${prefix}/`)) return false;
      return false;
    });
    if (!matchesListPrefix) return;
    setReferrerHref(url.pathname + url.search);
  }, [listPrefixes]);

  const href = referrerHref ?? fallbackHref;
  const label = referrerHref ? "Back to results" : fallbackLabel;

  return (
    <Link
      href={href}
      className={
        className ??
        "inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-[var(--stamp)]"
      }
    >
      <ArrowLeft className="size-3" aria-hidden />
      {label}
    </Link>
  );
}
