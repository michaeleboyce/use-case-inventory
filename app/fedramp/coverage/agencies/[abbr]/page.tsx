import Link from "next/link";
import {
  getCoverageAgencyDrill,
  getFedrampSnapshot,
} from "@/lib/db";
import type { CoverageAgencyDrill, FedrampSnapshot } from "@/lib/types";
import { formatNumber, formatDate } from "@/lib/formatting";
import { Section, MonoChip } from "@/components/editorial";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ abbr: string }>;
}) {
  const { abbr } = await params;
  return {
    title: `${abbr.toUpperCase()} FedRAMP coverage · AI Inventory`,
    description: `Cross-reference of ${abbr.toUpperCase()}'s 2025 AI inventory against its FedRAMP authorization scope.`,
  };
}

function safeDrill(
  abbr: string,
): { drill: CoverageAgencyDrill | null; error: string | null } {
  try {
    return { drill: getCoverageAgencyDrill(abbr), error: null };
  } catch (err) {
    return {
      drill: null,
      error: err instanceof Error ? err.message : "Unknown error.",
    };
  }
}

function safeSnapshot(): FedrampSnapshot | null {
  try {
    return getFedrampSnapshot();
  } catch {
    return null;
  }
}

function impactTone(level: string | null): "stamp" | "verified" | "ink" | "muted" {
  const v = (level ?? "").toLowerCase();
  if (v === "high") return "verified";
  if (v === "moderate") return "stamp";
  if (v === "low" || v === "li-saas") return "muted";
  return "ink";
}

export default async function FedrampCoverageAgencyDrillPage({
  params,
}: {
  params: Promise<{ abbr: string }>;
}) {
  const { abbr } = await params;
  const { drill, error } = safeDrill(abbr);
  const snapshot = safeSnapshot();

  if (error) {
    return (
      <div className="mx-auto w-full max-w-[1400px] px-4 py-14 md:px-8 md:py-20">
        <Section
          number="I"
          title="Data unavailable"
          lede="The FedRAMP tables aren&rsquo;t loaded in this build."
        >
          <p className="border-t-2 border-foreground pt-4 max-w-prose text-sm text-muted-foreground">
            Run <code className="font-mono text-foreground">make fedramp</code>{" "}
            to seed the FedRAMP tables. Detail:{" "}
            <span className="font-mono text-[11px]">{error}</span>
          </p>
        </Section>
        <SnapshotFooter snapshot={snapshot} />
      </div>
    );
  }

  // After the AI-scope filter applied to `getCoverageAgencyDrill`, a valid
  // agency may legitimately return null/empty when no FedRAMP authorizations
  // overlap with the curated AI product graph. Render an editorial
  // empty-state instead of a 404 — the agency exists, it just has no AI
  // overlap.
  if (!drill) {
    return (
      <div className="mx-auto w-full max-w-[1400px] px-4 py-14 md:px-8 md:py-20">
        <header className="ink-in grid grid-cols-12 gap-x-6 border-b border-border pb-12 md:pb-16">
          <aside className="col-span-12 mb-8 md:col-span-3 md:mb-0">
            <div className="sticky top-32 space-y-2">
              <div className="eyebrow !text-[var(--stamp)]">Agency drill</div>
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                {abbr.toUpperCase()}
              </div>
              <Link
                href="/fedramp/coverage/agencies"
                className="block font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground hover:text-[var(--stamp)]"
              >
                ← All agencies
              </Link>
            </div>
          </aside>
          <div className="col-span-12 md:col-span-9">
            <h1 className="font-display text-[clamp(2rem,5vw,3.6rem)] leading-[0.95] tracking-[-0.03em] text-foreground">
              <em className="italic">{abbr.toUpperCase()}</em>
            </h1>
            <p className="mt-2 font-mono text-[12px] uppercase tracking-[0.14em] text-muted-foreground">
              FedRAMP × inventory · {abbr.toUpperCase()}
            </p>
            <p className="mt-6 max-w-prose text-[1.02rem] leading-[1.55] text-foreground/85">
              This agency has no AI-linked FedRAMP authorizations in scope.
              That can mean: (a) the agency holds no FedRAMP ATOs for cloud
              products that have been linked to a curated AI use-case, or
              (b) the curation queue hasn&rsquo;t yet matched this agency&rsquo;s
              ATO portfolio. Either way, there&rsquo;s no AI-coverage delta
              to report.
            </p>
          </div>
        </header>
        <SnapshotFooter snapshot={snapshot} />
      </div>
    );
  }

  const { agency, authorized_but_unreported, mentioned_without_ato, unresolved_tokens } =
    drill;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-14 md:px-8 md:py-20">
      <header className="ink-in grid grid-cols-12 gap-x-6 border-b border-border pb-12 md:pb-16">
        <aside className="col-span-12 mb-8 md:col-span-3 md:mb-0">
          <div className="sticky top-32 space-y-2">
            <div className="eyebrow !text-[var(--stamp)]">Agency drill</div>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {agency.abbreviation}
            </div>
            <Link
              href="/fedramp/coverage/agencies"
              className="block font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground hover:text-[var(--stamp)]"
            >
              ← All agencies
            </Link>
            <Link
              href={`/agencies/${agency.abbreviation}`}
              className="block font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground hover:text-[var(--stamp)]"
            >
              → Inventory profile
            </Link>
          </div>
        </aside>

        <div className="col-span-12 md:col-span-9">
          <h1 className="font-display text-[clamp(2rem,5vw,3.6rem)] leading-[0.95] tracking-[-0.03em] text-foreground">
            <em className="italic">{agency.name}</em>
          </h1>
          <p className="mt-2 font-mono text-[12px] uppercase tracking-[0.14em] text-muted-foreground">
            FedRAMP × inventory · {agency.abbreviation}
          </p>
          <p className="mt-6 max-w-prose text-[1.02rem] leading-[1.55] text-foreground/85">
            <span className="font-medium text-foreground">
              {formatNumber(authorized_but_unreported.length)}
            </span>{" "}
            AI-linked FedRAMP products are authorized to this agency but go
            unmentioned in its 2025 inventory.{" "}
            <span className="font-medium text-foreground">
              {formatNumber(mentioned_without_ato.length)}
            </span>{" "}
            FedRAMP-listed products appear in use cases without a matching ATO
            on file.{" "}
            <span className="font-medium text-foreground">
              {formatNumber(unresolved_tokens.length)}
            </span>{" "}
            free-text vendor strings did not resolve to a known product. Scope
            is restricted to FedRAMP products linked to a curated AI inventory
            entry; the agency&rsquo;s broader ATO portfolio is not counted
            here.
          </p>
        </div>
      </header>

      {/* ------------------------------------------------------------ */}
      {/* § I — AUTHORIZED BUT UNREPORTED                               */}
      {/* ------------------------------------------------------------ */}
      <Section
        number="I"
        title="Authorized AI products not mentioned"
        lede="AI-linked FedRAMP authorizations on file for this agency where no inventory use-case names the product. (Filtered to FedRAMP products with a row in fedramp_product_links.)"
      >
        {authorized_but_unreported.length === 0 ? (
          <p className="border-t-2 border-foreground pt-4 max-w-prose text-sm text-muted-foreground">
            No gap detected. Either the agency&rsquo;s ATO scope is fully
            reflected in its inventory, or no FedRAMP authorizations are linked
            to this agency yet.
          </p>
        ) : (
          <div className="overflow-x-auto border-t-2 border-foreground">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <Th>FedRAMP ID</Th>
                  <Th align="left">CSP</Th>
                  <Th align="left">Offering</Th>
                  <Th align="left">Impact</Th>
                  <Th align="right">Latest ATO</Th>
                </tr>
              </thead>
              <tbody>
                {authorized_but_unreported.map((p) => (
                  <tr
                    key={p.fedramp_id}
                    className="border-b border-border/60 hover:bg-muted/30"
                  >
                    <td className="px-2 py-2">
                      <MonoChip
                        href={`/fedramp/marketplace/products/${p.fedramp_id}`}
                        tone="verified"
                        size="xs"
                      >
                        {p.fedramp_id}
                      </MonoChip>
                    </td>
                    <td className="px-2 py-2 text-foreground">{p.csp}</td>
                    <td className="px-2 py-2 text-muted-foreground">{p.cso}</td>
                    <td className="px-2 py-2">
                      {p.impact_level ? (
                        <MonoChip tone={impactTone(p.impact_level)} size="xs">
                          {p.impact_level}
                        </MonoChip>
                      ) : (
                        <span className="font-mono text-[10.5px] text-muted-foreground">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                      {p.ato_issuance_date
                        ? formatDate(p.ato_issuance_date)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ------------------------------------------------------------ */}
      {/* § II — MENTIONED WITHOUT ATO                                  */}
      {/* ------------------------------------------------------------ */}
      <Section
        number="II"
        title="Mentioned without an ATO on file"
        lede="Products this agency reports using whose FedRAMP listing isn&rsquo;t paired with an ATO at this agency."
      >
        {mentioned_without_ato.length === 0 ? (
          <p className="border-t-2 border-foreground pt-4 max-w-prose text-sm text-muted-foreground">
            Every FedRAMP-listed product this agency reports is paired with a
            matching ATO record. Nothing to flag here.
          </p>
        ) : (
          <div className="overflow-x-auto border-t-2 border-foreground">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <Th align="left">Product</Th>
                  <Th align="left">CSP / offering</Th>
                  <Th align="left">FedRAMP</Th>
                  <Th align="right">Use cases</Th>
                </tr>
              </thead>
              <tbody>
                {mentioned_without_ato.map((p) => (
                  <tr
                    key={p.inventory_product_id}
                    className="border-b border-border/60 hover:bg-muted/30"
                  >
                    <td className="px-2 py-2">
                      <Link
                        href={`/products/${p.inventory_product_id}`}
                        className="text-foreground hover:text-[var(--stamp)]"
                      >
                        {p.canonical_name}
                      </Link>
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">
                      {[p.csp, p.cso].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-2 py-2">
                      {p.fedramp_id ? (
                        <MonoChip
                          href={`/fedramp/marketplace/products/${p.fedramp_id}`}
                          tone="stamp"
                          size="xs"
                        >
                          {p.fedramp_id}
                        </MonoChip>
                      ) : (
                        <span className="font-mono text-[10.5px] text-muted-foreground">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {formatNumber(p.use_case_count)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ------------------------------------------------------------ */}
      {/* § III — UNRESOLVED INVENTORY TOKENS                           */}
      {/* ------------------------------------------------------------ */}
      <Section
        number="III"
        title="Unresolved inventory tokens"
        lede="Free-text vendor strings on this agency&rsquo;s use cases that didn&rsquo;t bind to a curated product."
      >
        {unresolved_tokens.length === 0 ? (
          <p className="border-t-2 border-foreground pt-4 max-w-prose text-sm text-muted-foreground">
            All vendor strings resolved cleanly to known products.
          </p>
        ) : (
          <>
            <ul className="border-t-2 border-foreground divide-y divide-border/60">
              {unresolved_tokens.map((t) => (
                <li
                  key={t.token}
                  className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 px-2 py-2 text-sm hover:bg-muted/30"
                >
                  <span className="font-mono text-[11px] text-foreground truncate">
                    {t.token}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                    {formatNumber(t.count)}×
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 max-w-prose text-sm text-muted-foreground">
              These strings are candidates for the alias seed in{" "}
              <Link
                href="/fedramp/curate"
                className="text-foreground hover:text-[var(--stamp)] underline-offset-2 hover:underline"
              >
                the curation queue
              </Link>
              . Adjudicating them upgrades this agency&rsquo;s coverage on the
              next rebuild.
            </p>
          </>
        )}
      </Section>

      <SnapshotFooter snapshot={snapshot} />
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-2 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function SnapshotFooter({ snapshot }: { snapshot: FedrampSnapshot | null }) {
  if (!snapshot) {
    return (
      <p className="mt-16 border-t border-border pt-4 text-center font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
        FedRAMP snapshot · unavailable
      </p>
    );
  }
  return (
    <p className="mt-16 border-t border-border pt-4 text-center font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
      FedRAMP snapshot ·{" "}
      {snapshot.snapshot_date
        ? `data as of ${formatDate(snapshot.snapshot_date)}`
        : "date unknown"}
    </p>
  );
}
