/**
 * View-model for /compare.
 *
 * Parses the URL's `a` parameter into a list of agency abbreviations,
 * resolves them against the canonical agency list (case-insensitive,
 * dedup, capped at four), then fetches the heavy AgencyCompareData
 * payload for each selection.
 *
 * The page still owns the searchParams unwrap because Next's
 * `searchParams` is a per-route async value; the VM accepts already-
 * parsed input and returns the final render payload.
 */
import { getAgencies, getAgencyCompareData } from "@/lib/db";
import type { AgencyCompareData } from "@/lib/types";

export function parseCompareAbbrs(raw: string | string[] | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return String(raw)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function resolveSelectedAgencies(
  raw: string[],
  options: Array<{ abbreviation: string }>,
  limit = 4,
): string[] {
  const optionSet = new Map(
    options.map((option) => [
      option.abbreviation.toUpperCase(),
      option.abbreviation,
    ]),
  );
  const selected: string[] = [];
  for (const value of raw) {
    const canonical = optionSet.get(value.toUpperCase());
    if (canonical && !selected.includes(canonical)) selected.push(canonical);
    if (selected.length >= limit) break;
  }
  return selected;
}

export function compareGridClass(count: number): string {
  if (count === 0) return "grid-cols-1";
  if (count === 1) return "grid-cols-[200px_1fr]";
  if (count === 2) return "grid-cols-[200px_1fr_1fr]";
  if (count === 3) return "grid-cols-[200px_1fr_1fr_1fr]";
  return "grid-cols-[200px_1fr_1fr_1fr_1fr]";
}

export interface CompareViewModel {
  options: Array<{ id: number; name: string; abbreviation: string }>;
  selected: string[];
  compareData: AgencyCompareData[];
  gridTemplate: string;
}

export async function buildCompareViewModel({
  rawAbbrs,
}: {
  rawAbbrs: string | string[] | undefined;
}): Promise<CompareViewModel> {
  const raw = parseCompareAbbrs(rawAbbrs);
  const options = getAgencies().map((a) => ({
    id: a.id,
    name: a.name,
    abbreviation: a.abbreviation,
  }));
  const selected = resolveSelectedAgencies(raw, options);
  const compareData: AgencyCompareData[] = selected
    .map((abbr) => getAgencyCompareData(abbr))
    .filter((d): d is AgencyCompareData => d !== null);
  const gridTemplate = compareGridClass(compareData.length);

  return { options, selected, compareData, gridTemplate };
}
