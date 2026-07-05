/**
 * Plain-English narrative of how an agency's seat estimate was built —
 * generated from the model output itself, so the story and the numbers
 * can never drift apart. Client-safe (pure; no DB imports).
 *
 * Used by /experience/seats/[slug] ("How this estimate was built") and
 * the expandable agency rows in /experience §04.
 */

import {
  type AgencySeatModel,
  type StratumResult,
  STRATUM_LABELS,
} from "./experience-shared";

const fmt = (n: number) => n.toLocaleString("en-US");
const pct = (x: number) => `${Math.round(x * 100)}%`;

export interface SeatNarrativeStep {
  title: string;
  body: string;
}

export interface SeatNarrative {
  steps: SeatNarrativeStep[];
  conclusion: string;
}

/** Short human name for a stratum, without the parenthetical examples. */
function stratumName(s: StratumResult["stratum"]): string {
  return STRATUM_LABELS[s]
    .split("(")[0]
    .trim()
    .toLowerCase()
    .replace(/\bai\b/g, "AI");
}

function denominatorStep(a: AgencySeatModel): SeatNarrativeStep {
  const parts: string[] = [];
  parts.push(
    `${a.abbreviation} employs ${fmt(a.total_headcount ?? 0)} people` +
      (a.headcount_as_of ? ` (as of ${a.headcount_as_of})` : "") +
      ".",
  );
  if (a.denominator_basis === "incl_contractors") {
    parts.push(
      `Its filed license counts clearly include on-site contractors, so the ` +
        `denominator adds them in rather than pretending they don't hold seats.`,
    );
  }
  if (a.eligible != null && a.total_headcount) {
    parts.push(
      `Not everyone is a candidate for a desk AI tool — field, trade, and ` +
        `frontline roles are excluded — leaving ${fmt(a.eligible)} ` +
        `AI-eligible staff. Every share below is measured against that number.`,
    );
  }
  return { title: "Start from who could have a seat", body: parts.join(" ") };
}

function stratumStep(a: AgencySeatModel, s: StratumResult): SeatNarrativeStep {
  const name = stratumName(s.stratum);
  const parts: string[] = [];
  parts.push(
    `${a.abbreviation} filed ${s.rows === 1 ? "one row" : `${s.rows} rows`} of ` +
      `${name} tools; the largest license band is "${s.winning_band_label}" ` +
      `(${s.winning_family}).`,
  );
  if (s.rows > 1) {
    parts.push(
      `Those rows all reach the same people, so only the largest band ` +
        `counts — summing them would count the same employees ` +
        `${s.rows} times.`,
    );
  }
  const capped = s.reach > s.cap;
  if (capped && a.eligible != null && s.cap < a.eligible) {
    parts.push(
      `The band exceeds the ${fmt(s.cap)} people who actually work in these ` +
        `roles here (OPM staffing data), so the estimate is capped there.`,
    );
  } else if (capped) {
    parts.push(
      `The band exceeds the eligible workforce, so it is capped at ` +
        `${fmt(s.cap)} — an agency can't have more seats than people.`,
    );
  }
  if (s.saturated) {
    parts.push(
      `Even the band's bottom end covers essentially this entire group: ` +
        `by ${a.abbreviation}'s own filing, ${name} access is agency-wide.`,
    );
  } else {
    parts.push(
      `That puts ${name} coverage at roughly ${pct(s.share)} of eligible staff.`,
    );
  }
  return {
    title: `Count the ${name} population once`,
    body: parts.join(" "),
  };
}

function combineStep(a: AgencySeatModel): SeatNarrativeStep {
  const n = a.strata.length;
  const body =
    (n > 1
      ? `The ${n} groups above overlap — a developer with a coding assistant ` +
        `almost certainly also has the general chat tool — so their shares ` +
        `are combined the way independent overlaps combine, never added ` +
        `outright. `
      : ``) +
    `The result is bounded honestly: at least ${fmt(a.floor ?? 0)} people ` +
    `(if every specialist group sits inside the general rollout, taking each ` +
    `band at its bottom end), at most ${fmt(a.ceiling ?? 0)} (if the groups ` +
    `don't overlap at all, at the bands' top ends — and never more than the ` +
    `eligible workforce).`;
  return { title: "Combine the groups without double-counting", body };
}

export function buildSeatNarrative(a: AgencySeatModel): SeatNarrative {
  if (!a.modeled) {
    return {
      steps: [
        {
          title: "Why there is no modeled estimate",
          body:
            `${a.abbreviation} filed license bands (${fmt(a.raw_band_lower)}` +
            `–${fmt(a.raw_band_upper)} across its rows) but has no researched ` +
            `workforce denominator yet, so the bands can't be turned into a ` +
            `defensible people-count. The raw range is shown instead of a ` +
            `made-up number.`,
        },
      ],
      conclusion: "",
    };
  }
  const steps: SeatNarrativeStep[] = [denominatorStep(a)];
  for (const s of a.strata) steps.push(stratumStep(a, s));
  steps.push(combineStep(a));
  return {
    steps,
    conclusion:
      `Best estimate: ${fmt(a.central ?? 0)} of ${fmt(a.eligible ?? 0)} ` +
      `AI-eligible ${a.abbreviation} staff — ${pct(
        (a.central ?? 0) / Math.max(1, a.eligible ?? 1),
      )} — have at least one AI tool. Every input above traces to a filed, ` +
      `hand-audited inventory row or a cited workforce source.`,
  };
}
