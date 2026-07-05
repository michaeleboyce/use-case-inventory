/**
 * Reference footband — the closing strip of reference surfaces so no
 * part of the site is more than one click from the front door.
 */
import Link from "next/link";

const REFERENCE_ITEMS: Array<{ href: string; label: string; note: string }> = [
  {
    href: "/about",
    label: "Methods & Sources",
    note: "how the data was collected, tagged, and counted",
  },
  {
    href: "/templates",
    label: "Templates",
    note: "the verbatim phrasings agencies file over and over",
  },
  {
    href: "/discrepancies",
    label: "Discrepancies",
    note: "where OMB's consolidated file and our ingest disagree",
  },
  {
    href: "/fedramp/curate",
    label: "Curate",
    note: "the FedRAMP link adjudication queue",
  },
];

export function HomeReferenceFootband() {
  return (
    <aside
      aria-label="Reference"
      className="mt-16 border-t-2 border-foreground pt-5 md:mt-24"
    >
      <div className="eyebrow mb-4 !text-[var(--stamp)]">§ Reference</div>
      <ul className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
        {REFERENCE_ITEMS.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="group block">
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-foreground transition-colors group-hover:text-[var(--stamp)]">
                {item.label} →
              </span>
              <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">
                {item.note}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
