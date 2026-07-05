"use client";

/**
 * How much the headline moves under different modeling choices — band end
 * (lower/mid/upper), whether low-confidence rows are dropped, whether the
 * clinical stratum counts. One dot-range row per scenario on a shared track,
 * so the reader sees at a glance that the central estimates cluster well
 * inside any single scenario's floor–ceiling span: the choice of assumptions
 * moves the answer less than the band width does. The first scenario is the
 * published headline and is emphasized.
 */

type Scenario = {
  label: string;
  agencies_total: number;
  agencies_modeled: number;
  eligible_total: number;
  floor: number;
  central: number;
  ceiling: number;
};

const compact = (n: number) =>
  Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);

export function SensitivityRange({ scenarios }: { scenarios: Scenario[] }) {
  if (scenarios.length === 0) return null;

  // Shared track: global min floor → global max ceiling, padded a touch.
  const min = Math.min(...scenarios.map((s) => s.floor));
  const max = Math.max(...scenarios.map((s) => s.ceiling));
  const span = max - min || 1;
  const pad = span * 0.06;
  const lo = min - pad;
  const hi = max + pad;
  const pos = (v: number) => ((v - lo) / (hi - lo)) * 100;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col divide-y divide-border">
        {scenarios.map((s, i) => {
          const headline = i === 0;
          const barColor = headline ? "#b3361f" : "#94a3b8";
          const dotColor = headline ? "#b3361f" : "#4b5563";
          return (
            <div key={s.label} className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[13rem_1fr]">
              <div className="flex flex-col">
                <span
                  className={`text-sm ${headline ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                >
                  {s.label}
                  {headline ? (
                    <span className="ml-2 align-middle font-mono text-[9px] uppercase tracking-[0.1em] text-[#b3361f]">
                      headline
                    </span>
                  ) : null}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                  {s.agencies_modeled}/{s.agencies_total} modeled ·{" "}
                  {compact(s.eligible_total)} eligible
                </span>
              </div>

              <div className="flex flex-col justify-center">
                {/* Track */}
                <div className="relative h-6 w-full">
                  <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
                  {/* floor–ceiling bar */}
                  <div
                    className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full"
                    style={{
                      left: `${pos(s.floor)}%`,
                      width: `${Math.max(0, pos(s.ceiling) - pos(s.floor))}%`,
                      background: barColor,
                      opacity: headline ? 0.5 : 0.35,
                    }}
                  />
                  {/* central dot */}
                  <div
                    className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${pos(s.central)}%` }}
                  >
                    <span
                      className="block rounded-full"
                      style={{
                        width: headline ? 14 : 11,
                        height: headline ? 14 : 11,
                        background: dotColor,
                        boxShadow: "0 0 0 2px var(--background)",
                      }}
                    />
                  </div>
                </div>
                {/* value labels */}
                <div className="mt-0.5 flex items-baseline justify-between font-mono text-[10px] tabular-nums text-muted-foreground">
                  <span>{compact(s.floor)}</span>
                  <span
                    className={headline ? "font-semibold text-[#b3361f]" : "text-foreground"}
                  >
                    {compact(s.central)}
                  </span>
                  <span>{compact(s.ceiling)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground">
        Bar = floor→ceiling span · dot = central estimate. All values are
        people estimated to hold at least one AI tool.
      </p>
    </div>
  );
}
