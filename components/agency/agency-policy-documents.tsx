// components/agency/agency-policy-documents.tsx
// Per-agency "Policy & strategy documents" subsection rendered inside the
// /agencies/[slug] detail page. Server component; takes the agency abbreviation
// and queries lib/db/policy for that agency's documents.

import { getDocumentsForAgency } from "@/lib/db/policy";

interface Props {
  /** Agency abbreviation, e.g. "DHS" — must match agency_ai_policy_documents.agency_abbr. */
  agencyAbbr: string;
}

export function AgencyPolicyDocuments({ agencyAbbr }: Props) {
  const docs = getDocumentsForAgency(agencyAbbr);

  return (
    <section className="mb-10">
      <header className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.14em] text-stamp">
          Policy &amp; strategy documents
        </h2>
        <a
          href={`/policy#agency-${agencyAbbr}`}
          className="text-[11px] text-foreground/55 underline-offset-2 hover:underline"
        >
          See in full /policy view →
        </a>
      </header>

      {docs.length === 0 ? (
        <p className="text-sm text-foreground/55">
          No formal AI strategy or policy document found publicly for this agency.
        </p>
      ) : (
        <ul className="divide-y divide-border/60">
          {docs.map((d) => (
            <li key={d.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2">
              <span className="font-mono text-[11px] text-foreground/60">
                {d.publication_year}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-foreground/55">
                {d.document_type}
              </span>
              <a
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm underline-offset-2 hover:underline"
              >
                {d.document_title}
              </a>
              {d.superseded && (
                <span className="font-mono text-[9px] uppercase tracking-wider text-stamp">
                  superseded
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
