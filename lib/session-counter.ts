"use client";

/**
 * Tiny `sessionStorage`-backed counter for the /discrepancies triage
 * workbench. Tracks how many discrepancies the user has resolved in the
 * current browser session — survives in-tab navigation but resets when
 * the tab closes (or when explicitly reset on landing at /discrepancies).
 */
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "discrepancy-triage-session";

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
  } catch {
    /* sessionStorage may be unavailable (Safari private mode etc.) */
  }
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
  const [resolved, setResolved] = useState<number>(0);

  // Hydrate from sessionStorage on mount.
  useEffect(() => {
    setResolved(readStored());
  }, []);

  const increment = useCallback(() => {
    setResolved((prev) => {
      const next = prev + 1;
      writeStored(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    writeStored(0);
    setResolved(0);
  }, []);

  return {
    resolved,
    remaining: Math.max(0, totalUnresolved - resolved),
    increment,
    reset,
  };
}
