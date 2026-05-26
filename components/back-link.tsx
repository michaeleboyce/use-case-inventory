/**
 * Referrer-aware back link.
 *
 * Behavior:
 *  - On the client, reads `document.referrer`. If same-origin AND its
 *    pathname matches one of the configured list-page prefixes (e.g.
 *    `/products`, `/agencies`, `/use-cases`), the link renders as
 *    "← Back to results" pointing at the referrer URL — preserving any
 *    filter / search context the user had when they clicked into the
 *    detail.
 *  - Otherwise (direct navigation, refresh, cross-origin, or referrer is a
 *    detail page), falls back to the static "← All <thing>" form pointing
 *    at the canonical list URL.
 *
 * Why document.referrer instead of an explicit `?ref=` URL param: avoids
 * touching every list-page → detail-page link site (cards, table rows,
 * sidebar lists). Trade-off: refresh on the detail page loses the back
 * URL. Acceptable — the page still works, just shows the static fallback.
 *
 * Implementation note: uses `useSyncExternalStore` with a no-op subscribe
 * because `document.referrer` never changes after first paint. The SSR
 * snapshot returns an empty string so the server renders the fallback;
 * the client snapshot returns the actual referrer for the hydration
 * pass. This avoids the "setState in effect" hydration pattern that
 * React 19's `react-hooks/set-state-in-effect` lint flags.
 */

"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useSyncExternalStore } from "react";

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

// document.referrer is immutable after first paint; subscribe is a no-op.
const NO_OP_SUBSCRIBE = () => () => {};
const readReferrer = () =>
  typeof document === "undefined" ? "" : document.referrer;
const readReferrerSsr = () => "";

function resolveReferrerHref(
  referrer: string,
  listPrefixes: string[],
): string | null {
  if (!referrer) return null;
  let url: URL;
  try {
    url = new URL(referrer);
  } catch {
    return null;
  }
  if (typeof window === "undefined") return null;
  if (url.origin !== window.location.origin) return null;
  const matchesListPrefix = listPrefixes.some((prefix) => {
    if (url.pathname === prefix) return true;
    if (url.pathname.startsWith(`${prefix}/`)) return false;
    return false;
  });
  if (!matchesListPrefix) return null;
  return url.pathname + url.search;
}

export function BackLink({
  fallbackHref,
  fallbackLabel,
  listPrefixes = DEFAULT_LIST_PREFIXES,
  className,
}: Props) {
  const referrer = useSyncExternalStore(
    NO_OP_SUBSCRIBE,
    readReferrer,
    readReferrerSsr,
  );
  const referrerHref = resolveReferrerHref(referrer, listPrefixes);
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
