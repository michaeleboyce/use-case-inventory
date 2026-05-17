"use client";

import { useEffect } from "react";

import { useSessionCounter } from "@/lib/session-counter";

interface Props {
  totalUnresolved: number;
  /** When true, the pill resets its sessionStorage to 0 on mount — used on
   *  the /discrepancies list root so a "fresh visit" zeroes the counter
   *  but in-flight detail-page navigation preserves it. */
  resetOnMount?: boolean;
}

export function SessionCounterPill({
  totalUnresolved,
  resetOnMount = false,
}: Props) {
  const { resolved, remaining, reset } = useSessionCounter(totalUnresolved);

  useEffect(() => {
    if (resetOnMount) reset();
    // We intentionally fire only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <span className="font-mono text-xs px-2 py-1 bg-stone-100 border border-stone-200">
      Resolved this session: {resolved} · Remaining: {remaining.toLocaleString()}
    </span>
  );
}
