/**
 * MLA-format citation strings for the research sources surfaced across the
 * dashboard (agency_ai_access_evidence, use_case_external_evidence,
 * agency_workforce_profile, agency_occupation_counts).
 *
 * These sources almost never carry a named author, so strings follow the
 * MLA 9 no-author web-source shape: "Title." site, Date, URL. Accessed Date.
 * Citations are copied as plain text, so the container's italics are dropped.
 */

const MLA_MONTHS = [
  "Jan.",
  "Feb.",
  "Mar.",
  "Apr.",
  "May",
  "June",
  "July",
  "Aug.",
  "Sept.",
  "Oct.",
  "Nov.",
  "Dec.",
];

/** ISO-ish date (yyyy, yyyy-mm, yyyy-mm-dd, or a datetime with that prefix)
 *  → MLA day-month-year ("17 Dec. 2025"). Free-text dates pass through. */
export function mlaDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = value.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
  if (!m) return value;
  const [, year, month, day] = m;
  if (!month) return year;
  const monthName = MLA_MONTHS[Number(month) - 1];
  if (!monthName) return year;
  if (!day) return `${monthName} ${year}`;
  return `${Number(day)} ${monthName} ${year}`;
}

/** Hostname without the www. prefix — the MLA container when the source has
 *  no recorded title, and the link text of last resort. */
export function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export interface CitationFields {
  url: string;
  title?: string | null;
  /** Publication date (ISO-ish or free text). */
  date?: string | null;
  /** When we captured/verified the source — MLA "Accessed" date. */
  accessed?: string | null;
}

export function formatMla(c: CitationFields): string {
  const parts: string[] = [];
  const title = c.title?.trim();
  if (title) {
    parts.push(/[.?!]$/.test(title) ? `"${title}"` : `"${title}."`);
  }
  const container: string[] = [];
  const site = hostnameOf(c.url);
  if (site) container.push(site);
  const date = mlaDate(c.date);
  if (date) container.push(date);
  container.push(c.url.replace(/^https?:\/\//, ""));
  parts.push(`${container.join(", ")}.`);
  const accessed = mlaDate(c.accessed);
  if (accessed) parts.push(`Accessed ${accessed}.`);
  return parts.join(" ");
}
