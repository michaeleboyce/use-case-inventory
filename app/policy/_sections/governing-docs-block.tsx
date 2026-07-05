// app/policy/_sections/governing-docs-block.tsx
// Reference block for the 3 executive orders + 3 OMB memoranda that agencies
// write their policies in response to. Visually distinguished from the
// agency-issued content above.

import type { PolicyDocument } from "@/lib/types/policy";

interface Props {
  governing: PolicyDocument[];
}

export function GoverningDocsBlock({ governing }: Props) {
  const totalPages = governing.reduce((acc, d) => acc + (d.pages ?? 0), 0);

  return (
    <section className="border border-stamp/40 bg-stamp/[0.04] p-5">
      <header className="mb-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-stamp">
          Governing documents · White House &amp; OMB
        </p>
        <p className="mt-1 text-sm text-foreground/70">
          The federal foundation agencies respond to.{" "}
          {governing.length} documents · {totalPages} pages · excluded from the
          agency totals above.
        </p>
      </header>
      <table className="min-w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="py-1.5 pr-3 font-mono text-[10px] uppercase tracking-wider text-foreground/60">
              Document
            </th>
            <th className="py-1.5 pr-3 font-mono text-[10px] uppercase tracking-wider text-foreground/60">
              Year
            </th>
            <th className="py-1.5 pr-3 font-mono text-[10px] uppercase tracking-wider text-foreground/60">
              Pages
            </th>
            <th className="py-1.5 pr-3 font-mono text-[10px] uppercase tracking-wider text-foreground/60">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {governing.map((d) => (
            <tr key={d.id} className="border-b border-border/50">
              <td className="py-1 pr-3">
                <a
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline-offset-2 hover:underline"
                >
                  {d.document_title}
                </a>
              </td>
              <td className="py-1 pr-3 font-mono">{d.publication_year}</td>
              <td className="py-1 pr-3 font-mono">{d.pages ?? "—"}</td>
              <td className="py-1 pr-3 text-foreground/70">
                {d.superseded ? "Superseded" : "In effect"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
