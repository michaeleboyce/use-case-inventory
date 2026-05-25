// app/policy/page.tsx — top-level /policy section.

import { buildPolicyViewModel } from "./_view-model";

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

      <p className="text-sm text-foreground/60">
        {vm.stats.total_documents} agency documents · {vm.stats.total_pages.toLocaleString()} pages of policy ·
        {" "}{vm.stats.strategies_published}/{vm.stats.total_agencies} M-25-21 strategies ·
        {" "}{vm.stats.plans_published}/{vm.stats.total_agencies} compliance plans
      </p>
    </main>
  );
}
