// app/adoption/_sections/baselines-table.tsx — the per-series provenance
// table for /adoption: population, exact metric, driver, start event, span,
// and a citation per series. Doubles as the chart's accessible table view.

import { Citation } from "@/components/citation";
import { MonoChip } from "@/components/editorial";
import type { AdoptionSeries } from "@/lib/types/adoption";

function span(s: AdoptionSeries): string {
  const first = s.points[0];
  const last = s.points[s.points.length - 1];
  const fmt = (v: number) =>
    s.unit === "percent" ? `${v}%` : v.toLocaleString("en-US");
  return `${first.date.slice(0, 7)} ${fmt(first.value)} → ${last.date.slice(0, 7)} ${fmt(last.value)}`;
}

export function BaselinesTable({ series }: { series: AdoptionSeries[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-foreground text-left">
            {["Series", "Population", "Metric", "Driver", "Clock starts", "Span", "Source"].map(
              (h) => (
                <th
                  key={h}
                  className="px-3 py-2 font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground"
                >
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {series.map((s) => (
            <tr key={s.id} className="border-b border-border align-top">
              <td className="px-3 py-3 font-medium text-foreground">
                {s.label}
              </td>
              <td className="px-3 py-3 text-muted-foreground">
                {s.population}
              </td>
              <td className="px-3 py-3 text-muted-foreground">{s.metric}</td>
              <td className="px-3 py-3">
                <MonoChip
                  size="xs"
                  tone={s.driver === "federal mandate" ? "stamp" : "muted"}
                >
                  {s.driver}
                </MonoChip>
              </td>
              <td className="px-3 py-3 font-mono text-[12px] text-muted-foreground">
                {s.start.date}
                <div className="text-[11px]">{s.start.label}</div>
              </td>
              <td className="px-3 py-3 font-mono text-[12px] text-muted-foreground">
                {span(s)}
              </td>
              <td className="px-3 py-3">
                <Citation
                  url={s.source.url}
                  title={s.source.title}
                  accessed={s.source.accessed}
                  display={new URL(s.source.url).hostname.replace(/^www\./, "")}
                />
                {s.source.note ? (
                  <div className="mt-1 font-mono text-[10.5px] text-muted-foreground">
                    {s.source.note}
                  </div>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
