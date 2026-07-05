"use client";

/**
 * Small client-only "Print or save as PDF" button used on the
 * /agencies/[slug]/scorecard print-friendly page. Split out so the
 * surrounding page can stay a server component (and so the button
 * itself disappears via `print:hidden` when the user prints).
 */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden mt-6 bg-foreground text-background px-4 py-2 font-display text-sm hover:bg-foreground/80 transition-colors"
    >
      Print or save as PDF
    </button>
  );
}
