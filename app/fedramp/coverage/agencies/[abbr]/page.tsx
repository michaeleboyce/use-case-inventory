import Link from "next/link";
import {
  getCoverageAgencyDrill,
  getFedrampSnapshot,
  getUseCasesForCoverageAgencyProduct,
  getUnlinkedAiProductsForAgency,
  getAiServicesInReachForAgency,
  getSleepingServicesForAgency,
  getContainmentCoverForAgency,
  matchContainmentPattern,
  bucketTiming,
  getAgencyAccessTiers,
  type AgencyAccessTier,
} from "@/lib/db";
import type {
  ContainmentCoverRow,
  CoverageAgencyDrill,
  CoverageUseCaseRow,
  FedrampSnapshot,
} from "@/lib/types";
import { formatNumber, formatDate } from "@/lib/formatting";
import { Section, MonoChip } from "@/components/editorial";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { breadcrumbTrail } from "@/lib/nav";
import { EmptyState } from "@/components/empty-state";
import { MentionedWithoutAtoTable } from "./_sections/mentioned-without-ato-table";

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
        <Breadcrumbs
          trail={[
            ...breadcrumbTrail("/fedramp/coverage/agencies"),
            { label: abbr.toUpperCase() },
          ]}
        />
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

  // Additive: AI products (by independent classification) this agency holds an
  // ATO for but never reports — distinct from `authorized_but_unreported`,
  // which is scoped to inventory-LINKED products. This catches FedRAMP AI
  // tools the inventory never named. Empty when classification isn't loaded.
  const unlinkedAiHeld = getUnlinkedAiProductsForAgency(agency.id);

  // Additive: core-AI SERVICES in scope of packages this agency holds an ATO
  // for (Bedrock inside AWS, Azure OpenAI inside Azure Commercial, …). In
  // scope of an authorization the agency already holds — not evidence the
  // agency enabled the service. Empty when the per-service labels aren't
  // loaded.
  const servicesInReach = getAiServicesInReachForAgency(agency.id);
  let accessTier: AgencyAccessTier | null = null;
  if (servicesInReach.length > 0) {
    try {
      accessTier = getAgencyAccessTiers()[agency.abbreviation] ?? null;
    } catch {
      accessTier = null;
    }
  }

  // Sleeping services: mapped services in reach here where a peer agency is
  // a proven lead user and this agency reports nothing. Empty when the
  // sleeping-services sidecars aren't loaded.
  const sleepingServices = getSleepingServicesForAgency(agency.id);

  // Roman-numeral counter — two fixed sections, then up to four conditional
  // ones. Replaces the old hardcoded "IV"/"V-or-III" juggling.
  const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];
  let sectionIdx = 0;
  const nextSection = () => ROMAN[sectionIdx++];
  const authorizedNum = nextSection();
  const mentionedNum = nextSection();
  const unlinkedNum = unlinkedAiHeld.length > 0 ? nextSection() : null;
  const reachNum = servicesInReach.length > 0 ? nextSection() : null;
  const sleepingServicesNum = sleepingServices.length > 0 ? nextSection() : null;
  const tokensNum = nextSection();

  // Containment cover: for each "mentioned without ATO" row, the ledger can't
  // attribute the use to a channel — but if the agency holds a package whose
  // services-in-scope catalog carries a matching service, that package is the
  // likely cover (Azure OpenAI for "OpenAI API", Palantir tenancy for Claude,
  // …). Prefetched once per agency, then distributed per product family below.
  // "possible cover ≠ confirmed attribution; no cover ≠ unauthorized."
  const containmentCover = getContainmentCoverForAgency(agency.id);
  const coverByPattern = new Map<string, ContainmentCoverRow[]>();
  for (const c of containmentCover) {
    const list = coverByPattern.get(c.service_pattern) ?? [];
    list.push(c);
    coverByPattern.set(c.service_pattern, list);
  }

  // Attach top-10 use cases per "mentioned without ATO" row, server-side.
  // Cheap — each row's product is a single id lookup; rows are O(few-dozen).
  type MentionedRowWithDetail =
    CoverageAgencyDrill["mentioned_without_ato"][number] & {
      _detail: CoverageUseCaseRow[];
      _totalUseCases: number;
      _cover: ContainmentCoverRow[];
      _coverNote: string | null;
    };
  const mentionedWithDetail: MentionedRowWithDetail[] =
    mentioned_without_ato.map((p) => {
      const pattern = matchContainmentPattern(p.canonical_name);
      const cover = pattern
        ? coverByPattern.get(pattern.servicePattern) ?? []
        : [];
      return {
        ...p,
        _detail: getUseCasesForCoverageAgencyProduct(
          agency.id,
          p.inventory_product_id,
          { limit: 10 },
        ),
        _totalUseCases: p.use_case_count,
        _cover: cover,
        _coverNote: pattern?.note ?? null,
      };
    });

  const crumbLabel =
    agency.name.length > 70 ? agency.name.slice(0, 69) + "…" : agency.name;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-14 md:px-8 md:py-20">
      <Breadcrumbs
        trail={[
          ...breadcrumbTrail("/fedramp/coverage/agencies"),
          { label: crumbLabel },
        ]}
      />
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
        number={authorizedNum}
        title="Authorized AI products not mentioned"
        lede="AI-linked FedRAMP authorizations on file for this agency where no inventory use-case names the product. (Filtered to FedRAMP products with a row in fedramp_product_links.)"
      >
        {authorized_but_unreported.length === 0 ? (
          <EmptyState
            variant="boxed"
            message="No gap detected. Either the agency’s ATO scope is fully reflected in its inventory, or no FedRAMP authorizations are linked to this agency yet."
          />
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
        number={mentionedNum}
        title="Mentioned without an ATO on file"
        lede="Products this agency reports using whose FedRAMP listing isn&rsquo;t paired with an ATO at this agency. The ledger can&rsquo;t attribute a use to a channel, so where the agency holds a package whose in-scope services carry a match, that package is flagged as the likely cover — possible cover &ne; confirmed attribution; no cover &ne; unauthorized. Click a row to see the actual use cases."
      >
        {mentioned_without_ato.length === 0 ? (
          <p className="border-t-2 border-foreground pt-4 max-w-prose text-sm text-muted-foreground">
            Every FedRAMP-listed product this agency reports is paired with a
            matching ATO record. Nothing to flag here.
          </p>
        ) : (
          <div className="border-t-2 border-foreground pt-4">
            <MentionedWithoutAtoTable
              rows={mentionedWithDetail}
              agencyId={agency.id}
              agencyAbbr={agency.abbreviation}
            />
          </div>
        )}
      </Section>

      {/* ------------------------------------------------------------ */}
      {/* § III — UNRESOLVED INVENTORY TOKENS                           */}
      {/* ------------------------------------------------------------ */}
      {unlinkedAiHeld.length > 0 ? (
        <Section
          number={unlinkedNum!}
          title="AI ATOs absent from this agency's inventory"
          lede="FedRAMP products an independent LLM review judged to be AI/ML offerings that this agency holds an ATO for, yet names in no use case. Distinct from §II above, which is scoped to products already in the inventory's AI catalog — this catches AI tools the inventory never named."
        >
          <ul className="border-t-2 border-foreground divide-y divide-border/60">
            {unlinkedAiHeld.map((p) => (
              <li
                key={p.fedramp_id}
                className="grid grid-cols-[auto_1fr_auto] items-baseline gap-x-3 px-2 py-2.5 text-sm hover:bg-muted/30"
              >
                <MonoChip
                  href={`/fedramp/marketplace/products/${p.fedramp_id}`}
                  tone={p.category === "core_ai" ? "stamp" : "ink"}
                  size="xs"
                  title={p.category === "core_ai" ? "Core AI" : "AI-featured"}
                >
                  {p.category === "core_ai" ? "Core AI" : "AI-feat."}
                </MonoChip>
                <span className="min-w-0">
                  <span className="text-foreground">{p.cso}</span>
                  <span className="ml-2 text-[0.85rem] text-muted-foreground">
                    {p.csp}
                  </span>
                </span>
                {p.impact_level ? (
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
                    {p.impact_level}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="mt-4 max-w-prose text-sm text-muted-foreground">
            See the full cross-agency board at{" "}
            <Link
              href="/fedramp/coverage/unlinked-ai"
              className="text-foreground hover:text-[var(--stamp)] underline-offset-2 hover:underline"
            >
              FedRAMP AI absent from the inventory
            </Link>
            .
          </p>
        </Section>
      ) : null}

      {servicesInReach.length > 0 ? (
        <Section
          number={reachNum!}
          title="Frontier-adjacent services in reach"
          source="mixed"
          lede="Core-AI services listed in the scope catalogs of packages this agency holds an ATO for. In scope of an authorization the agency already holds — not evidence the agency enabled the service or made it available to staff."
        >
          {accessTier ? (
            <p className="mb-4 flex flex-wrap items-baseline gap-2 text-sm text-foreground/85">
              <MonoChip tone="stamp" size="xs" title="IFP web-corroborated assessment, not OMB data">
                IFP
              </MonoChip>
              <span>
                Estimated staff access to a general-purpose AI tool at this
                agency:{" "}
                <span className="font-medium text-foreground">
                  {accessTier.tier}
                </span>
                {accessTier.share != null ? (
                  <> (~{Math.round(accessTier.share * 100)}% of eligible staff)</>
                ) : null}
                . Capability in reach and staff access are different facts —
                the gap between them is the story.
              </span>
            </p>
          ) : null}

          <table className="w-full border-t-2 border-foreground text-sm">
            <thead>
              <tr className="text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                <th className="py-2 pr-4">Service</th>
                <th className="py-2 pr-4">Host package</th>
                <th className="py-2 pr-4">Impact</th>
                <th className="py-2">Agency ATO issued</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {servicesInReach.map((s) => (
                <tr key={`${s.service}-${s.host_fedramp_id}`} className="hover:bg-muted/30">
                  <td className="py-2.5 pr-4 font-medium text-foreground">
                    {s.service}
                  </td>
                  <td className="py-2.5 pr-4">
                    <MonoChip
                      href={`/fedramp/marketplace/products/${s.host_fedramp_id}`}
                      tone="stamp"
                      size="xs"
                    >
                      {s.host_fedramp_id}
                    </MonoChip>
                    <span className="ml-2 text-[0.85rem] text-muted-foreground">
                      {s.cso}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
                    {s.impact_level ?? "—"}
                  </td>
                  <td className="py-2.5 font-mono text-[11px] text-muted-foreground">
                    {s.ato_issuance_date ? formatDate(s.ato_issuance_date) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 max-w-prose text-sm text-muted-foreground">
            Cross-agency view:{" "}
            <Link
              href="/fedramp/coverage/spread#services"
              className="text-foreground hover:text-[var(--stamp)] underline-offset-2 hover:underline"
            >
              the shelf inside the shelf
            </Link>
            .
          </p>
        </Section>
      ) : null}

      {sleepingServices.length > 0 ? (
        <Section
          number={sleepingServicesNum!}
          title="AI services in reach, unreported"
          source="mixed"
          lede="Services this agency has in authorized reach where at least one peer agency reports real AI use of the mapped product — and this agency's inventory names neither the product nor, where flagged, anything in the capability class."
        >
          <table className="w-full border-t-2 border-foreground text-sm">
            <thead>
              <tr className="text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                <th className="py-2 pr-4">Product / service</th>
                <th className="py-2 pr-4">Via</th>
                <th className="py-2 pr-4">First host ATO</th>
                <th className="py-2">Similar capability deployed?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {sleepingServices.map((s) => {
                const bucket = bucketTiming(s.first_ato_date);
                const excluded = bucket === "post_cutoff" || s.recency_last90 === 1;
                return (
                  <tr
                    key={s.product}
                    className={`hover:bg-muted/30 ${excluded ? "opacity-45" : ""}`}
                  >
                    <td className="py-2.5 pr-4">
                      <span className="font-medium text-foreground">{s.product}</span>
                      <span className="mt-0.5 block max-w-[22rem] truncate font-mono text-[10px] text-muted-foreground">
                        {s.services.split(",").join(" · ")}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-[0.85rem] text-muted-foreground">
                      {(s.host_packages ?? "").split(",")[0] || "—"}
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-[11px] text-muted-foreground">
                      {s.first_ato_date ? formatDate(s.first_ato_date) : "—"}
                      {excluded ? " · post-inventory" : ""}
                    </td>
                    <td className="py-2.5 text-[0.85rem]">
                      {s.similar_deployed === 1 ? (
                        <span className="text-muted-foreground">
                          yes{s.similar_products ? ` — ${s.similar_products.split(",").slice(0, 3).join(", ")}` : ""}
                        </span>
                      ) : (
                        <span className="font-medium text-[var(--stamp)]">
                          nothing similar
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-4 max-w-prose text-sm text-muted-foreground">
            Government-wide view:{" "}
            <Link
              href="/fedramp/coverage/sleeping-services"
              className="text-foreground hover:text-[var(--stamp)] underline-offset-2 hover:underline"
            >
              the sleeping-services board
            </Link>
            . Grayed rows postdate the inventory cutoff and are excluded from
            headline counts.
          </p>
        </Section>
      ) : null}

      <Section
        number={tokensNum}
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
