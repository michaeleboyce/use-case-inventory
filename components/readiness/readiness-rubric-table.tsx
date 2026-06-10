/**
 * ReadinessRubricTable — renders the 5-dimension rubric from
 * `lib/readiness-rubric.ts` as a citable table for the methodology page.
 *
 * Server component, no client state. The rubric metadata is the published
 * source of truth; if a dimension changes here, the Python ETL constant
 * must change too (see RUBRIC_DIMENSIONS comment).
 */

import { RUBRIC_DIMENSIONS } from "@/lib/readiness/rubric";

export function ReadinessRubricTable() {
  return (
    <div className="border-t-2 border-foreground">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            <th scope="col" className="py-2 pr-4 align-bottom">
              Dimension
            </th>
            <th scope="col" className="py-2 pr-4 text-right align-bottom">
              Weight
            </th>
            <th scope="col" className="py-2 pr-4 align-bottom">
              Definition
            </th>
            <th scope="col" className="py-2 pr-4 align-bottom">
              Source
            </th>
            <th scope="col" className="py-2 align-bottom">
              Caveats
            </th>
          </tr>
        </thead>
        <tbody>
          {RUBRIC_DIMENSIONS.map((d) => (
            <tr
              key={d.key}
              id={d.key}
              className="scroll-mt-24 border-b border-border/60 align-top last:border-b-0"
            >
              <th
                scope="row"
                className="py-3 pr-4 text-left font-display italic text-[1.05rem] leading-snug text-foreground"
              >
                {d.label}
              </th>
              <td className="py-3 pr-4 text-right font-mono tabular-nums text-foreground">
                {Math.round(d.weight * 100)}%
              </td>
              <td className="py-3 pr-4 leading-snug text-foreground">
                {d.definition}
              </td>
              <td className="py-3 pr-4 font-mono text-[11px] leading-snug text-muted-foreground">
                {d.source}
              </td>
              <td className="py-3 leading-snug text-muted-foreground">
                {d.caveats.length === 0 ? (
                  <span className="font-mono text-[11px] text-muted-foreground/70">
                    None noted.
                  </span>
                ) : (
                  <ul className="list-disc space-y-1 pl-4 text-[13px]">
                    {d.caveats.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
