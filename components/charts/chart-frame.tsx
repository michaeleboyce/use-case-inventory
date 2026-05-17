"use client";

import type { CSSProperties, ReactNode } from "react";
import { ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

type ChartFrameProps = {
  children: ReactNode;
  className?: string;
  height: number;
  overlay?: ReactNode;
  style?: CSSProperties;
};

const DEFAULT_INITIAL_WIDTH = 800;

/**
 * Shared Recharts frame for SSR-safe responsive charts.
 *
 * Recharts defaults ResponsiveContainer's server-side dimensions to -1, which
 * makes `next build` noisy. A stable initial size keeps the static render valid;
 * ResizeObserver still takes over on the client.
 */
export function ChartFrame({
  children,
  className,
  height,
  overlay,
  style,
}: ChartFrameProps) {
  return (
    <div
      className={cn("relative w-full min-w-0", className)}
      style={{ height, minHeight: 1, ...style }}
    >
      <ResponsiveContainer
        width="100%"
        height="100%"
        minWidth={1}
        minHeight={1}
        initialDimension={{ width: DEFAULT_INITIAL_WIDTH, height }}
      >
        {children}
      </ResponsiveContainer>
      {overlay}
    </div>
  );
}
