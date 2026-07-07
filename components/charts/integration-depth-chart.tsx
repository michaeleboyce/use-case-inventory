/**
 * Integration-depth figure: how coupled is the federal government's operating
 * AI? Two hand-built (capture-stable) panels:
 *
 *  1. Depth distribution — one horizontal bar per integration depth (shallow →
 *     deep), each split GenAI (stamp) vs classical / non-GenAI (muted). The
 *     stamp share collapses as depth increases: GenAI lives at the shallow end
 *     (standalone chat) while the deeply-integrated estate is pre-GenAI.
 *  2. Coding taxonomy breakout — the five coding_tool_type buckets, split live
 *     (pilot/deployed, verified-green) vs not-yet-live (muted). Headline: all
 *     four `coding_agent` filings are pre-deployment — zero live agentic coding.
 *
 * Pure presentational Server Component — no client hooks, so it renders
 * identically for the live route and the /figures capture.
 */

import type { IntegrationDepthAnalysis } from "@/lib/db";

const STAMP = "var(--stamp)";
const MUTED = "var(--muted-foreground)";
const VERIFIED = "var(--verified)";

function pct(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((n / d) * 100);
}

function StatTile({
  value,
  label,
}: {
  value: string;
  label: React.ReactNode;
}) {
  return (
    <div className="border-t-2 border-foreground pt-2">
      <div className="font-display text-[2rem] leading-none tracking-[-0.02em] text-foreground tabular-nums">
        {value}
      </div>
      <div className="mt-1.5 text-[12px] leading-snug text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

export function IntegrationDepthChart({
  data,
}: {
  data: IntegrationDepthAnalysis;
}) {
  const maxDepthTotal = Math.max(1, ...data.depths.map((d) => d.total));
  const standalone = data.depths.find((d) => d.key === "standalone_chat");
  const systemInt = data.depths.find((d) => d.key === "system_integrated");
  const maxCoding = Math.max(1, ...data.coding.map((c) => c.count));

  return (
    <div className="flex flex-col gap-8">
      {/* Flagship stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <StatTile
          value={data.totalGenAI.toLocaleString()}
          label={
            <>
              generative-AI use cases in the labeled{" "}
              <span className="text-foreground">pilot + deployed</span> set
            </>
          }
        />
        {standalone && (
          <StatTile
            value={`${pct(standalone.genai, data.totalGenAI)}%`}
            label={
              <>
                of operating GenAI is a{" "}
                <span className="text-foreground">standalone chatbot</span> (
                {standalone.genai} of {data.totalGenAI})
              </>
            }
          />
        )}
        {systemInt && (
          <StatTile
            value={`${systemInt.classical} of ${systemInt.total}`}
            label={
              <>
                <span className="text-foreground">system-integrated</span>{" "}
                deployments are classical ML, not GenAI
              </>
            }
          />
        )}
      </div>

      {/* Depth distribution — stacked bars */}
      <div>
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-foreground">
            Integration depth · pilot + deployed
          </h3>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {data.totalPD.toLocaleString()} use cases
          </span>
        </div>
        <ul className="flex flex-col gap-2.5">
          {data.depths.map((d) => {
            const barWidth = (d.total / maxDepthTotal) * 100;
            const genaiShare = pct(d.genai, d.total);
            return (
              <li
                key={d.key}
                className="grid grid-cols-[128px_1fr_92px] items-center gap-3"
              >
                <span className="truncate text-[13px] text-foreground">
                  {d.label}
                </span>
                <div className="flex h-6 items-center">
                  <div
                    className="flex h-full gap-[2px]"
                    style={{ width: `${barWidth}%`, minWidth: 2 }}
                    role="img"
                    aria-label={`${d.label}: ${d.genai} generative AI, ${d.classical} classical, ${d.total} total`}
                  >
                    {d.genai > 0 && (
                      <span
                        className="h-full rounded-[2px]"
                        style={{
                          width: `${(d.genai / d.total) * 100}%`,
                          background: STAMP,
                        }}
                        title={`${d.genai} generative AI`}
                      />
                    )}
                    {d.classical > 0 && (
                      <span
                        className="h-full rounded-[2px]"
                        style={{
                          width: `${(d.classical / d.total) * 100}%`,
                          background: MUTED,
                        }}
                        title={`${d.classical} classical / non-GenAI`}
                      />
                    )}
                  </div>
                </div>
                <span className="text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                  <span className="text-foreground">{d.total}</span>
                  {" · "}
                  <span style={{ color: STAMP }}>{genaiShare}%</span>
                </span>
              </li>
            );
          })}
        </ul>
        {/* Legend */}
        <div className="mt-3 flex flex-wrap gap-4 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-[2px]"
              style={{ background: STAMP }}
            />
            Generative AI
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-[2px]"
              style={{ background: MUTED }}
            />
            Classical / non-GenAI
          </span>
          <span className="normal-case tracking-normal">
            Right column: total · GenAI share of that depth.
          </span>
        </div>
      </div>

      {/* Coding taxonomy breakout */}
      <div className="border-t border-border pt-6">
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-foreground">
            Coding tools · taxonomy
          </h3>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {data.codingTotal} coding-tagged filings
          </span>
        </div>
        <ul className="flex flex-col gap-2">
          {data.coding.map((c) => {
            const barWidth = (c.count / maxCoding) * 100;
            const notLive = c.count - c.live;
            return (
              <li
                key={c.key}
                className="grid grid-cols-[128px_1fr_104px] items-center gap-3"
              >
                <span className="truncate text-[13px] text-foreground">
                  {c.label}
                </span>
                <div className="flex h-5 items-center">
                  <div
                    className="flex h-full gap-[2px]"
                    style={{ width: `${barWidth}%`, minWidth: 2 }}
                    role="img"
                    aria-label={`${c.label}: ${c.live} live, ${notLive} not yet live, ${c.count} total`}
                  >
                    {c.live > 0 && (
                      <span
                        className="h-full rounded-[2px]"
                        style={{
                          width: `${(c.live / c.count) * 100}%`,
                          background: VERIFIED,
                        }}
                        title={`${c.live} live (pilot / deployed)`}
                      />
                    )}
                    {notLive > 0 && (
                      <span
                        className="h-full rounded-[2px]"
                        style={{
                          width: `${(notLive / c.count) * 100}%`,
                          background: MUTED,
                        }}
                        title={`${notLive} not yet live`}
                      />
                    )}
                  </div>
                </div>
                <span className="text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                  <span className="text-foreground">{c.count}</span>
                  {c.live === 0 ? (
                    <span style={{ color: STAMP }}> · 0 live</span>
                  ) : (
                    <span>
                      {" · "}
                      {c.live} live
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="mt-3 flex flex-wrap gap-4 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-[2px]"
              style={{ background: VERIFIED }}
            />
            Live (pilot / deployed)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-[2px]"
              style={{ background: MUTED }}
            />
            Not yet live
          </span>
        </div>
        <p className="mt-3 border-l-2 border-[var(--stamp)] pl-3 text-[12.5px] leading-snug text-foreground">
          All {data.codingAgent.count} filings that claim a{" "}
          <span className="font-medium">coding agent</span> are pre-deployment —
          zero live agentic coding tools in the federal estate.
        </p>
      </div>
    </div>
  );
}
