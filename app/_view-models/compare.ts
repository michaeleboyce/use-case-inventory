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
