"use client";

/**
 * Tiny `sessionStorage`-backed counter for the /discrepancies triage
 * workbench. Tracks how many discrepancies the user has resolved in the
 * current browser session — survives in-tab navigation but resets when
 * the tab closes (or when explicitly reset on landing at /discrepancies).
 *
 * Reads use `useSyncExternalStore` so the source of truth is
 * sessionStorage itself (no hydration setState in an effect, which trips
 * React 19's `react-hooks/set-state-in-effect` rule). Writes go through
 * sessionStorage + dispatch a custom event so the subscriber re-renders
 * in the same tab.
 */
import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "discrepancy-triage-session";
const EVENT_NAME = "discrepancy-triage-session:change";

function readStored(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw == null) return 0;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writeStored(n: number): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, String(n));
    window.dispatchEvent(new Event(EVENT_NAME));
  } catch {
    /* sessionStorage may be unavailable (Safari private mode etc.) */
  }
}

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  // Same-tab updates fire our custom event. Cross-tab updates fire the
  // native `storage` event (sessionStorage is per-tab, but we listen
  // anyway in case the model evolves to localStorage).
  window.addEventListener(EVENT_NAME, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT_NAME, callback);
    window.removeEventListener("storage", callback);
  };
}

export interface SessionCounter {
  resolved: number;
  remaining: number;
  increment: () => void;
  reset: () => void;
}

/**
 * @param totalUnresolved Snapshot count of unresolved discrepancies at
 *   page-render time. The hook computes `remaining = totalUnresolved -
 *   resolved` so the user sees the queue shrink in real time, even
 *   though the server-side count is stale until the next revalidate.
 */
export function useSessionCounter(totalUnresolved = 0): SessionCounter {
  const resolved = useSyncExternalStore(
    subscribe,
    readStored, // client-side snapshot
    () => 0, // server-side snapshot
  );

  const increment = useCallback(() => {
    writeStored(readStored() + 1);
  }, []);

  const reset = useCallback(() => {
    writeStored(0);
  }, []);

  return {
    resolved,
    remaining: Math.max(0, totalUnresolved - resolved),
    increment,
    reset,
  };
}
