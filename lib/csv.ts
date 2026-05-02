/**
 * Shared CSV-escape helpers for routes that stream CSV responses.
 *
 * Two layers of safety on top of RFC 4180 quoting:
 *   1. Standard quoting if the value contains comma, double-quote, CR, or LF.
 *   2. CSV-injection mitigation: if the value starts with =, +, -, @, tab,
 *      or CR (Excel/Sheets formula-trigger characters), prefix with a single
 *      quote `'` AND wrap in double quotes. This is the OWASP-recommended
 *      defense for "CSV injection" / "Formula injection".
 *
 * Examples:
 *   "hello"          -> hello
 *   "a,b"            -> "a,b"
 *   "=CMD()"         -> "'=CMD()"
 *   "+1 555-1234"    -> "'+1 555-1234"
 *   "-2,3"           -> "'-2,3"
 *   "@user"          -> "'@user"
 *   "\\t=foo"        -> "'\\t=foo"  (leading TAB)
 */

const FORMULA_TRIGGERS = /^[=+\-@\t\r]/;
const NEEDS_QUOTING = /[",\r\n]/;

export function csvCell(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = typeof value === "number" ? String(value) : value;
  if (FORMULA_TRIGGERS.test(s)) {
    // Always wrap in quotes so the prefix `'` lands inside the quoted field.
    // Escape any internal quotes per RFC 4180 (double them up).
    return `"'${s.replace(/"/g, '""')}"`;
  }
  if (NEEDS_QUOTING.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function csvRow(values: Array<string | number | null | undefined>): string {
  return values.map(csvCell).join(",") + "\r\n";
}
