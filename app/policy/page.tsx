// app/policy/page.tsx — top-level /policy section.

import { buildPolicyViewModel } from "./_view-model";
import { ComplianceScorecard } from "./_sections/compliance-scorecard";
import { PagesByAgencyChart } from "./_sections/pages-by-agency-chart";

export const metadata = { title: "Federal AI Policy" };

export default async function PolicyPage() {
  const vm = await buildPolicyViewModel();

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-8 md:px-8">
      <header className="mb-8">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-stamp">
          VI · Policy
        </p>
        <h1 className="mt-1 font-display text-4xl italic leading-tight md:text-5xl">
          Federal AI Policy
        </h1>
        <p className="mt-2 max-w-[60ch] text-sm text-foreground/70">
          M-25-21 compliance · {vm.stats.total_agencies} agencies · last
          refreshed {vm.stats.last_refreshed}
        </p>
      </header>

      <section className="mb-10 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Pages of policy"
          value={vm.stats.total_pages.toLocaleString()}
          hint="agency-issued only"
        />
        <StatCard
          label="Documents"
          value={vm.stats.total_documents.toString()}
          hint="agency-issued only"
        />
        <StatCard
          label="M-25-21 Strategies"
          value={`${vm.stats.strategies_published} / ${vm.stats.total_agencies}`}
          hint="public agency strategy"
        />
        <StatCard
          label="M-25-21 Compliance Plans"
          value={`${vm.stats.plans_published} / ${vm.stats.total_agencies}`}
          hint="public agency plan"
        />
      </section>

      <section className="mb-12 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-sm border border-border bg-card/40 p-4">
          <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-stamp">
            Compliance scorecard
          </h2>
          <ComplianceScorecard rows={vm.compliance} />
        </div>
        <div className="rounded-sm border border-border bg-card/40 p-4">
          <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-stamp">
            Pages of policy by agency
          </h2>
          <PagesByAgencyChart rows={vm.pagesByAgency} />
        </div>
      </section>
    </main>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-sm border border-border bg-card/40 p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-foreground/60">
        {label}
      </p>
      <p className="mt-1 font-display text-3xl leading-none text-foreground">
        {value}
      </p>
      <p className="mt-1 text-[11px] text-foreground/50">{hint}</p>
    </div>
  );
}
