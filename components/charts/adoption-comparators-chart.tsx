/**
 * Adoption-comparators figure. Two hand-built (capture-stable) panels plus a
 * source apparatus, all from CHECKED-IN facts in lib/data/adoption-comparators.ts
 * (never the DB):
 *
 *  1. Mechanism-presence matrix — nine adoption mechanisms × six entities
 *     (US Federal + four governments + two enterprises). Each cell is one of
 *     four states: evidenced (✓), evidenced-absent (✗), partial, or NOT
 *     evidenced (–). The last is neutral by construction: absence of evidence,
 *     not evidence of absence. The final row inverts — the US inventory is the
 *     only source on earth that can report a coding-agent deployment count
 *     (and it is zero live).
 *  2. Evidence-quality ledger — the actual numbers, grouped by how they were
 *     produced (self-reported survey / vendor-reported / randomized trial),
 *     with the METR perception-gap called out. Deliberately NOT one shared
 *     axis: the units are incommensurable, so they are labeled facts, not bars.
 *
 * Then: keyed source footnotes (URL + access date + verification vote), the two
 * refuted claims that were left out, and a link to the companion depth figure.
 *
 * Pure presentational Server Component — no client hooks, so it renders
 * identically for the live route and the /figures capture.
 */

import {
  CODING_FRAMING,
  COMPANION_FIGURE,
  ENTITIES,
  EVIDENCE_GROUPS,
  EXCLUDED_CLAIMS,
  MECHANISM_ROWS,
  METR_PERCEPTION,
  SOURCES,
  type CellState,
  type MechanismCell,
} from "@/lib/data/adoption-comparators";

const STAMP = "var(--stamp)";
const VERIFIED = "var(--verified)";
const MUTED = "var(--muted-foreground)";

const STATE_LABEL: Record<CellState, string> = {
  evidenced: "evidenced present",
  absent: "evidenced absent",
  partial: "partial",
  none: "not evidenced",
  "measured-zero": "measured — zero live",
  "no-data": "no published data",
};

/** The small state glyph. Identity is never color-alone: every state has a
 * distinct shape as well as a distinct token. */
function StateMark({ state }: { state: CellState }) {
  switch (state) {
    case "evidenced":
    case "absent":
    case "measured-zero": {
      const bg = state === "evidenced" ? VERIFIED : STAMP;
      const glyph = state === "evidenced" ? "✓" : state === "absent" ? "✗" : "0";
      return (
        <span
          aria-hidden
          className="inline-flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-[2px] text-[10px] font-bold leading-none"
          style={{ background: bg, color: "var(--paper)" }}
        >
          {glyph}
        </span>
      );
    }
    case "partial":
      // A clean left-half fill reads as "half / partial" at a glance — more
      // legible than a diagonal, which looked nearly solid.
      return (
        <span
          aria-hidden
          className="inline-block h-[15px] w-[15px] shrink-0 rounded-[2px]"
          style={{
            background:
              "linear-gradient(to right, var(--foreground) 0 50%, transparent 50% 100%)",
            boxShadow: "inset 0 0 0 1px var(--border)",
          }}
        />
      );
    default:
      // none / no-data — hollow neutral
      return (
        <span
          aria-hidden
          className="inline-flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-[2px] text-[11px] leading-none text-muted-foreground"
          style={{ boxShadow: "inset 0 0 0 1px var(--border)" }}
        >
          –
        </span>
      );
  }
}

function Cell({
  cell,
  entityLabel,
}: {
  cell: MechanismCell;
  entityLabel: string;
}) {
  const label = `${entityLabel} — ${STATE_LABEL[cell.state]}${
    cell.detail ? `: ${cell.detail}` : ""
  }`;

  // A measured count is not a mechanism mark — the inverted coding row's US
  // cell gets a stamp badge so "0 live" reads as data, not as a "no".
  if (cell.state === "measured-zero") {
    return (
      <div className="px-2 py-2" role="cell" aria-label={label}>
        <span
          className="inline-flex items-center gap-1 rounded-[2px] px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.06em]"
          style={{ background: STAMP, color: "var(--paper)" }}
        >
          0 live · measured
        </span>
        {cell.detail && (
          <span className="mt-1 block text-[10.5px] leading-snug text-foreground">
            {cell.detail}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex gap-1.5 px-2 py-2" role="cell" aria-label={label}>
      <StateMark state={cell.state} />
      {cell.detail && (
        <span className="text-[10.5px] leading-[1.32] text-foreground">
          {cell.detail}
        </span>
      )}
    </div>
  );
}

function MechanismMatrix() {
  // label column + 6 entity columns. The two enterprises carry a heavier left
  // rule so the government/enterprise split reads without a second header band.
  const cols = "grid-cols-[minmax(190px,1.25fr)_repeat(6,minmax(132px,1fr))]";
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[940px]">
        {/* Header */}
        <div className={`grid ${cols} items-end border-b-2 border-foreground`}>
          <div className="px-2 pb-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Mechanism
            </span>
          </div>
          {ENTITIES.map((e) => (
            <div
              key={e.id}
              className={`px-2 pb-2 ${
                e.kind === "enterprise"
                  ? "border-l border-border"
                  : ""
              } ${e.id === "accenture" ? "border-l-2 border-foreground/40" : ""}`}
            >
              <span
                className="block font-mono text-[11.5px] font-semibold uppercase tracking-[0.04em]"
                style={{ color: e.id === "us" ? STAMP : "var(--foreground)" }}
              >
                {e.label}
              </span>
              <span className="block text-[9.5px] leading-tight text-muted-foreground">
                {e.sub}
              </span>
            </div>
          ))}
        </div>

        {/* Group tags row */}
        <div className={`grid ${cols} border-b border-border`}>
          <div />
          <div className="col-span-4 px-2 py-1">
            <span className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-muted-foreground">
              Governments
            </span>
          </div>
          <div className="col-span-2 border-l-2 border-foreground/40 px-2 py-1">
            <span className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-muted-foreground">
              Private enterprise
            </span>
          </div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-border">
          {MECHANISM_ROWS.map((row) => (
            <div
              key={row.id}
              className={`grid ${cols} items-start ${
                row.inverted ? "bg-[color-mix(in_oklab,var(--stamp)_7%,transparent)]" : ""
              }`}
              role="row"
            >
              <div className="px-2 py-2">
                <span className="block text-[12px] font-medium leading-tight text-foreground">
                  {row.label}
                </span>
                {row.note && (
                  <span className="mt-0.5 block text-[9.5px] leading-tight text-muted-foreground">
                    {row.note}
                  </span>
                )}
              </div>
              {ENTITIES.map((e) => (
                <div
                  key={e.id}
                  className={
                    e.id === "accenture" ? "border-l-2 border-foreground/40" : ""
                  }
                >
                  <Cell cell={row.cells[e.id]} entityLabel={e.label} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MatrixLegend() {
  const items: { state: CellState; label: string }[] = [
    { state: "evidenced", label: "Evidenced (mechanism present)" },
    { state: "absent", label: "Evidenced absent (evidence it is missing)" },
    { state: "partial", label: "Partial / weaker form" },
    { state: "none", label: "Not evidenced" },
  ];
  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {items.map((it) => (
          <span
            key={it.state}
            className="inline-flex items-center gap-1.5 text-[10.5px] text-muted-foreground"
          >
            <StateMark state={it.state} />
            {it.label}
          </span>
        ))}
      </div>
      <p className="text-[10.5px] leading-snug text-muted-foreground">
        <span className="font-medium text-foreground">Read the dash as silence, not a no.</span>{" "}
        &ldquo;Not evidenced&rdquo; (–) means the mechanism was not found in the
        sources reviewed — absence of evidence, not evidence of absence. Only
        &ldquo;evidenced absent&rdquo; (✗) is a positive finding that the
        mechanism is missing.
      </p>
    </div>
  );
}

/** The METR headline: a measured slowdown against a believed speed-up, on one
 * signed track. The gap between the two marks is the whole point. */
function PerceptionGap() {
  const { measured, believed, gapPoints } = METR_PERCEPTION;
  const min = -25;
  const max = 25;
  const pos = (v: number) => ((v - min) / (max - min)) * 100;
  return (
    <div className="mt-4 border border-border p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground">
          METR RCT · measured vs believed
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
          {gapPoints}-point gap
        </span>
      </div>
      <div className="relative h-9">
        {/* baseline */}
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
        {/* zero tick */}
        <div
          className="absolute top-1/2 h-4 w-px -translate-y-1/2"
          style={{ left: `${pos(0)}%`, background: MUTED }}
        />
        {/* gap span */}
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-[2px]"
          style={{
            left: `${pos(measured)}%`,
            width: `${pos(believed) - pos(measured)}%`,
            background: "color-mix(in oklab, var(--stamp) 22%, transparent)",
          }}
        />
        {/* measured marker */}
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${pos(measured)}%` }}
        >
          <span
            className="inline-block h-3.5 w-3.5 rounded-full"
            style={{ background: STAMP, boxShadow: "0 0 0 2px var(--background)" }}
          />
        </div>
        {/* believed marker (ghost/outline) */}
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${pos(believed)}%` }}
        >
          <span
            className="inline-block h-3.5 w-3.5 rounded-full"
            style={{
              background: "var(--background)",
              boxShadow: "inset 0 0 0 2px var(--muted-foreground)",
            }}
          />
        </div>
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] tabular-nums">
        <span style={{ color: STAMP }}>{measured}% measured (slower)</span>
        <span className="text-muted-foreground">+{believed}% believed (faster)</span>
      </div>
    </div>
  );
}

/** Evidence-type accent: weak→strong reads muted → vermilion → ink → forest. */
function groupAccent(id: string): string {
  switch (id) {
    case "self-reported":
      return MUTED;
    case "vendor-reported":
      return STAMP;
    case "telemetry":
      return "var(--foreground)";
    default:
      return VERIFIED; // rct
  }
}

function GroupAccent({ id }: { id: string }) {
  return (
    <span
      aria-hidden
      className="inline-block h-3 w-3 shrink-0 rounded-[2px]"
      style={{ background: groupAccent(id) }}
    />
  );
}

function EvidenceLedger() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {EVIDENCE_GROUPS.map((g) => {
        const accent = groupAccent(g.id);
        return (
          <div
            key={g.id}
            className="flex flex-col gap-2 pl-3"
            style={{ borderLeft: `2px solid ${accent}` }}
          >
            <div>
              <div className="flex items-center gap-1.5">
                <GroupAccent id={g.id} />
                <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-foreground">
                  {g.label}
                </span>
                <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
                  ({g.tag})
                </span>
              </div>
              <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
                {g.gloss}
              </p>
            </div>
            <ul className="flex flex-col divide-y divide-border">
              {g.items.map((it) => (
                <li key={`${g.id}-${it.entity}`} className="py-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[11px] font-medium text-foreground">
                      {it.entity}
                    </span>
                    <span
                      className="font-display text-[16px] leading-none tabular-nums"
                      style={{
                        color:
                          it.sign === "down"
                            ? STAMP
                            : it.sign === "up"
                              ? VERIFIED
                              : "var(--foreground)",
                      }}
                    >
                      {it.figure}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                    {it.metric}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function SourceFootnotes() {
  // Every sourceKey referenced anywhere in the figure, in registry order.
  const used = new Set<string>();
  for (const row of MECHANISM_ROWS) {
    for (const e of ENTITIES) {
      const k = row.cells[e.id]?.sourceKey;
      if (k) used.add(k);
    }
  }
  for (const g of EVIDENCE_GROUPS) for (const it of g.items) used.add(it.sourceKey);
  for (const c of EXCLUDED_CLAIMS) used.add(c.sourceKey);
  const keys = Object.keys(SOURCES).filter((k) => used.has(k));

  return (
    <ol className="flex flex-col gap-1.5">
      {keys.map((k) => {
        const s = SOURCES[k];
        return (
          <li key={k} className="text-[10px] leading-snug text-muted-foreground">
            <span className="font-mono uppercase tracking-[0.06em] text-foreground">
              {k}
            </span>{" "}
            — {s.label}
            {s.url && (
              <>
                {" "}
                <a
                  href={s.url}
                  className="break-all underline underline-offset-2 hover:text-foreground"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {s.url}
                </a>
              </>
            )}
            {s.accessed && <> · accessed {s.accessed}</>}
            {s.vote && <> · {s.vote}</>}
          </li>
        );
      })}
    </ol>
  );
}

export function AdoptionComparatorsChart() {
  return (
    <div className="flex flex-col gap-8">
      {/* Panel 1 — mechanism-presence matrix */}
      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-foreground">
            What fast adopters actually did · mechanism presence
          </h3>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            9 mechanisms × 6 entities
          </span>
        </div>
        <MechanismMatrix />
        <MatrixLegend />
        <p className="mt-3 max-w-[92ch] border-l-2 border-[var(--stamp)] pl-3 text-[11.5px] leading-snug text-foreground">
          {CODING_FRAMING}
        </p>
      </section>

      {/* Panel 2 — evidence-quality ledger */}
      <section className="border-t border-border pt-6">
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-foreground">
            What the numbers actually are · by evidence type
          </h3>
        </div>
        <p className="mb-3 max-w-[68ch] text-[11px] leading-snug text-muted-foreground">
          Grouped by how each figure was produced, not by size. Self-reported
          figures are survey data, not measured outcomes; the units are
          incommensurable, so these are labeled facts, never one shared axis.
        </p>
        <EvidenceLedger />
        <PerceptionGap />
        <p className="mt-3 max-w-[80ch] border-l-2 border-[var(--stamp)] pl-3 text-[11.5px] leading-snug text-foreground">
          Self-reported figures are survey data, not measured outcomes.
          METR&rsquo;s randomized trial found a ~{METR_PERCEPTION.gapPoints}-point
          gap between measured and perceived productivity — reason to discount
          every self-reported time-savings number in this space, including the
          US ones.
        </p>
      </section>

      {/* Excluded claims */}
      <section className="border-t border-border pt-6">
        <h3 className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-foreground">
          Left out — refuted by verification
        </h3>
        <ul className="flex flex-col gap-2">
          {EXCLUDED_CLAIMS.map((c) => (
            <li
              key={c.claim}
              className="grid grid-cols-[auto_1fr] gap-2 text-[11px] leading-snug"
            >
              <span
                className="mt-0.5 h-fit shrink-0 rounded-[2px] px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.06em]"
                style={{ background: STAMP, color: "var(--paper)" }}
              >
                {c.vote}
              </span>
              <span className="text-muted-foreground">
                <span className="text-foreground">{c.claim}</span> {c.why}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Sources */}
      <section className="border-t border-border pt-6">
        <h3 className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-foreground">
          Sources · URL · access date · verification vote
        </h3>
        <SourceFootnotes />
      </section>

      {/* Companion figure */}
      <section className="border-t border-border pt-4">
        <a
          href={COMPANION_FIGURE.href}
          className="inline-flex items-baseline gap-2 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <span className="font-mono uppercase tracking-[0.12em]">
            Companion figure →
          </span>
          <span className="underline underline-offset-2">{COMPANION_FIGURE.title}</span>
        </a>
      </section>
    </div>
  );
}
