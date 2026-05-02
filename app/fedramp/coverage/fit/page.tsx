import Link from "next/link";
import {
  getCoverageFitGrid,
  getFedrampSnapshot,
} from "@/lib/db";
import type { CoverageFitCell, FedrampSnapshot } from "@/lib/types";
import { formatNumber, formatDate } from "@/lib/formatting";
import { Section } from "@/components/editorial";

export const metadata = {
  title: "Authorization fit · FedRAMP × AI Inventory",
  description:
    "Use cases by rights/safety designation × FedRAMP impact level. Cells highlight where impact level may be too low for the reported use.",
};

function safeGrid(): { grid: CoverageFitCell[]; error: string | null } {
  try {
    return { grid: getCoverageFitGrid(), error: null };
  } catch (err) {
    return {
      grid: [],
      error: err instanceof Error ? err.message : "Unknown error.",
    };
  }
}

function safeSnapshot(): FedrampSnapshot | null {
  try {
    return getFedrampSnapshot();
  } catch {
    return null;
  }
}

// Canonical row / column orderings.
const ROWS: Array<{ key: string; label: string }> = [
  { key: "rights_impacting", label: "Rights-impacting" },
  { key: "safety_impacting", label: "Safety-impacting" },
  { key: "both", label: "Rights & safety" },
  { key: "high_impact", label: "High-impact (other)" },
  { key: "neither", label: "Neither" },
  { key: "unknown", label: "Unknown" },
];

const COLS: Array<{ key: string; label: string }> = [
  { key: "Low", label: "Low" },
  { key: "Li-SaaS", label: "Li-SaaS" },
  { key: "Moderate", label: "Moderate" },
  { key: "High", label: "High" },
  { key: "unknown", label: "Unknown" },
];

function normalizeRowKey(raw: string | null | undefined): string {
  const v = (raw ?? "").toLowerCase().trim();
  if (!v) return "unknown";
  if (v === "rights_impacting") return "rights_impacting";
  if (v === "safety_impacting") return "safety_impacting";
  if (v === "rights_and_safety_impacting" || v === "both") return "both";
  if (v === "high_impact") return "high_impact";
  if (v === "neither" || v === "none") return "neither";
  return "unknown";
}

function normalizeColKey(raw: string | null | undefined): string {
  const v = (raw ?? "").trim();
  if (!v) return "unknown";
  // Pass through canonical FedRAMP impact strings.
  if (/^low$/i.test(v)) return "Low";
  if (/^li-?saas$/i.test(v)) return "Li-SaaS";
  if (/^moderate$/i.test(v)) return "Moderate";
  if (/^high$/i.test(v)) return "High";
  return "unknown";
}

type CellTone = "misfit" | "verified" | "neutral" | "muted";

function cellTone(rowKey: string, colKey: string, count: number): CellTone {
  if (count === 0) return "muted";
  // Rights/safety designations on Low/Moderate impact => potential misfit.
  const isRiskRow =
    rowKey === "rights_impacting" ||
    rowKey === "safety_impacting" ||
    rowKey === "both";
  if (isRiskRow && (colKey === "Low" || colKey === "Li-SaaS" || colKey === "Moderate")) {
    return "misfit";
  }
  // Risk row on High impact => verified fit.
  if (isRiskRow && colKey === "High") return "verified";
  return "neutral";
}

const TONE_CLASS: Record<CellTone, string> = {
  misfit:
    "bg-[color-mix(in_oklab,var(--stamp)_14%,transparent)] text-foreground",
  verified:
    "bg-[color-mix(in_oklab,var(--verified)_14%,transparent)] text-foreground",
  neutral: "bg-transparent text-foreground",
  muted: "bg-transparent text-muted-foreground",
};

export default function FedrampCoverageFitPage() {
  const { grid, error } = safeGrid();
  const snapshot = safeSnapshot();

  // Build a lookup keyed on (rowKey, colKey).
  const lookup = new Map<string, number>();
  for (const cell of grid) {
    const r = normalizeRowKey(cell.high_impact_designation);
    const c = normalizeColKey(cell.fedramp_impact_level);
    const key = `${r}|${c}`;
    lookup.set(key, (lookup.get(key) ?? 0) + cell.use_case_count);
  }

  // Row & column totals.
  const rowTotals: Record<string, number> = {};
  const colTotals: Record<string, number> = {};
  let grandTotal = 0;
  for (const r of ROWS) {
    let sum = 0;
    for (const c of COLS) {
      const v = lookup.get(`${r.key}|${c.key}`) ?? 0;
      sum += v;
      colTotals[c.key] = (colTotals[c.key] ?? 0) + v;
    }
    rowTotals[r.key] = sum;
    grandTotal += sum;
  }

  const misfitTotal = (["rights_impacting", "safety_impacting", "both"] as const)
    .flatMap((rk) =>
      (["Low", "Li-SaaS", "Moderate"] as const).map(
        (ck) => lookup.get(`${rk}|${ck}`) ?? 0,
      ),
    )
    .reduce((a, b) => a + b, 0);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-14 md:px-8 md:py-20">
      <header className="ink-in grid grid-cols-12 gap-x-6 border-b border-border pb-12 md:pb-16">
        <aside className="col-span-12 mb-8 md:col-span-3 md:mb-0">
          <div className="sticky top-32 space-y-2">
            <div className="eyebrow !text-[var(--stamp)]">Panel 2</div>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Authorization fit
            </div>
            <Link
              href="/fedramp/coverage"
              className="block font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground hover:text-[var(--stamp)]"
            >
              ← Coverage hub
            </Link>
          </div>
        </aside>

        <div className="col-span-12 md:col-span-9">
          <h1 className="font-display text-[clamp(2.2rem,5vw,3.8rem)] leading-[0.95] tracking-[-0.03em] text-foreground">
            Is the impact level{" "}
            <em className="italic">appropriate</em> for what they&rsquo;re doing?
          </h1>
          <p className="mt-6 max-w-prose text-[1.02rem] leading-[1.55] text-foreground/85">
            Federal AI policy designates use cases as rights- or
            safety-impacting. FedRAMP authorizes products at Low / Moderate /
            High impact. The grid below shows where the two columns disagree.
            Cells in <span className="text-[var(--stamp)] font-medium">vermilion</span>{" "}
            indicate use cases reported as rights- or safety-impacting that ride
            on a Low- or Moderate-impact authorization — a potential misfit
            worth examining.
          </p>
        </div>
      </header>

      {error ? (
        <Section number="I" title="No data" lede="The FedRAMP tables aren&rsquo;t loaded.">
          <p className="border-t-2 border-foreground pt-4 max-w-prose text-sm text-muted-foreground">
            Run <code className="font-mono text-foreground">make fedramp</code>{" "}
            to seed the FedRAMP tables. Detail:{" "}
            <span className="font-mono text-[11px]">{error}</span>
          </p>
        </Section>
      ) : grandTotal === 0 ? (
        <Section
          number="I"
          title="Empty grid"
          lede="No use cases resolved to a FedRAMP-listed product."
        >
          <p className="border-t-2 border-foreground pt-4 text-sm text-muted-foreground">
            The fit grid only includes use cases whose product carries a
            FedRAMP authorization. Until the link table is populated this view
            stays blank — see{" "}
            <Link
              href="/fedramp/coverage/vendors"
              className="text-foreground hover:text-[var(--stamp)] underline-offset-2 hover:underline"
            >
              vendor coverage
            </Link>{" "}
            for raw matched-vs-unmatched counts.
          </p>
        </Section>
      ) : (
        <Section
          number="I"
          title="The fit grid"
          lede="Counts are individual + consolidated use cases whose product carries a FedRAMP authorization."
        >
          <div className="overflow-x-auto border-t-2 border-foreground pt-4">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground border-b border-border">
                    Designation ↓ / Impact →
                  </th>
                  {COLS.map((c) => (
                    <th
                      key={c.key}
                      className="px-3 py-2 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground border-b border-border"
                    >
                      {c.label}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-foreground border-b-2 border-foreground">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r.key} className="border-b border-border/60">
                    <th className="px-3 py-2.5 text-left font-mono text-[11px] uppercase tracking-[0.06em] text-foreground">
                      {r.label}
                    </th>
                    {COLS.map((c) => {
                      const v = lookup.get(`${r.key}|${c.key}`) ?? 0;
                      const tone = cellTone(r.key, c.key, v);
                      return (
                        <td
                          key={c.key}
                          className={`px-3 py-2.5 text-right tabular-nums ${TONE_CLASS[tone]}`}
                        >
                          {v === 0 ? (
                            <span className="font-mono text-[11px] text-muted-foreground">
                              —
                            </span>
                          ) : (
                            formatNumber(v)
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium border-l border-border">
                      {rowTotals[r.key] === 0 ? (
                        <span className="font-mono text-[11px] text-muted-foreground">
                          —
                        </span>
                      ) : (
                        formatNumber(rowTotals[r.key])
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-foreground">
                  <th className="px-3 py-2 text-left font-mono text-[11px] uppercase tracking-[0.06em] text-foreground">
                    Total
                  </th>
                  {COLS.map((c) => (
                    <td
                      key={c.key}
                      className="px-3 py-2 text-right tabular-nums font-medium"
                    >
                      {colTotals[c.key] === 0
                        ? "—"
                        : formatNumber(colTotals[c.key])}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right tabular-nums font-bold border-l border-border">
                    {formatNumber(grandTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Legend
              tone="misfit"
              label="Potential misfit"
              copy="Rights- or safety-impacting use case riding on Low- or Moderate-impact authorization."
            />
            <Legend
              tone="verified"
              label="Verified fit"
              copy="Rights- or safety-impacting use case on a High-impact authorization."
            />
            <Legend
              tone="neutral"
              label="Out of policy scope"
              copy="No rights/safety designation; impact level less directly relevant."
            />
          </div>

          <p className="mt-6 font-mono text-[11px] text-muted-foreground">
            Misfit total · {formatNumber(misfitTotal)} use cases (
            {grandTotal === 0
              ? "—"
              : `${Math.round((misfitTotal / grandTotal) * 100)}% of mapped`}
            ).
          </p>
        </Section>
      )}

      <SnapshotFooter snapshot={snapshot} />
    </div>
  );
}

function Legend({
  tone,
  label,
  copy,
}: {
  tone: CellTone;
  label: string;
  copy: string;
}) {
  return (
    <div className="border-t-2 border-foreground pt-3">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={`inline-block h-3 w-3 ${TONE_CLASS[tone]} border border-border`}
        />
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-foreground">
          {label}
        </span>
      </div>
      <p className="mt-2 text-[0.85rem] leading-snug text-muted-foreground">
        {copy}
      </p>
    </div>
  );
}

function SnapshotFooter({ snapshot }: { snapshot: FedrampSnapshot | null }) {
  if (!snapshot) {
    return (
      <p className="mt-16 border-t border-border pt-4 text-center font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
        FedRAMP snapshot · unavailable
      </p>
    );
  }
  return (
    <p className="mt-16 border-t border-border pt-4 text-center font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
      FedRAMP snapshot ·{" "}
      {snapshot.snapshot_date
        ? `data as of ${formatDate(snapshot.snapshot_date)}`
        : "date unknown"}{" "}
      · {formatNumber(snapshot.product_count)} products ·{" "}
      {formatNumber(snapshot.ato_event_count)} authorizations
    </p>
  );
}
