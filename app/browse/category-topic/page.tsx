/**
 * /browse/category-topic — 2D cross-tab of IFP product categories ×
 * OMB topic areas.
 *
 * Where the existing /browse/[dimension] heatmaps slice one dimension
 * against the top-15 agency columns, this page pivots two USE-CASE
 * dimensions against each other to answer "which IFP product categories
 * concentrate in which OMB topic areas?" — e.g., does
 * `physical_security` cluster on "Law Enforcement"?
 *
 * Data: `getCategoryTopicCrossTab()` (lib/db/analytics.ts) — same join
 * path as the product_type cross-cut, but groups by both p.product_type
 * AND uc.topic_area. Excludes `unclassified` product_type and empty
 * topic_area.
 *
 * Provenance is mixed: the row axis is IFP-curated (derived) and the
 * column axis is OMB-filed (omb). Header chip flags both.
 */

import { getCategoryTopicCrossTab } from "@/lib/db";
import { Section, MonoChip } from "@/components/editorial";
import { CategoryTopicHeatmap } from "@/components/category-topic-heatmap";
import { DIMENSION_PROVENANCE } from "@/lib/cross-cuts";

export const metadata = {
  title: "Browse · Category × Topic · Federal AI Inventory",
  description:
    "Cross-tab of IFP product categories against OMB-filed topic areas — which categories cluster on which topics.",
};

const ROW_CAP = 15;
const COL_CAP = 15;

export default async function BrowseCategoryTopicPage() {
  const data = getCategoryTopicCrossTab(ROW_CAP, COL_CAP);

  const offCapRows = Math.max(0, data.totalCategoryCount - data.categories.length);
  const offCapCols = Math.max(0, data.totalTopicCount - data.topics.length);
  const offCapUseCases = Math.max(
    0,
    data.totalUseCaseCount - data.visibleUseCaseCount,
  );
  const hasOffCap = offCapRows > 0 || offCapCols > 0 || offCapUseCases > 0;

  const ifp = DIMENSION_PROVENANCE.product_type;
  const omb = DIMENSION_PROVENANCE.topic_area;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-14 md:px-8 md:py-20">
      {/* Editorial header */}
      <header className="ink-in grid grid-cols-12 gap-x-6 border-b border-border pb-10">
        <aside className="col-span-12 mb-6 md:col-span-3 md:mb-0">
          <div className="sticky top-32 space-y-2">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--stamp)]">
              § Browse
            </div>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Cross-tab · Category × Topic
            </div>
          </div>
        </aside>
        <div className="col-span-12 md:col-span-9">
          <h1 className="font-display text-[clamp(2rem,5.5vw,4.2rem)] leading-[0.98] tracking-[-0.02em] text-foreground">
            Browse ·{" "}
            <em className="inline font-normal italic">
              Category × Topic
            </em>
          </h1>
          <p className="mt-4 max-w-prose text-[1rem] leading-[1.55] text-foreground/85">
            IFP-curated product categories on rows × OMB-filed topic areas on
            columns. Cell counts are distinct use cases at the intersection —
            useful for asking "which kinds of AI tools are agencies pointing at
            which kinds of problems?"
          </p>

          {/* Provenance — this view pairs an IFP-derived axis with an
              OMB-filed axis, so we surface BOTH chips. */}
          <div className="mt-5 max-w-prose space-y-2 border-l-2 border-border pl-3">
            <div className="flex items-baseline gap-3">
              <MonoChip tone="stamp" size="xs">
                IFP × OMB
              </MonoChip>
              <p className="text-[0.85rem] leading-[1.5] text-muted-foreground">
                Rows: IFP-curated product taxonomy ({" "}
                <span className="font-mono text-[0.78rem]">product_type</span>
                ). Columns: OMB-filed topic area (M-25-21 §II.1).
              </p>
            </div>
            <div className="flex items-baseline gap-3">
              <MonoChip tone="stamp" size="xs">
                IFP
              </MonoChip>
              <p className="text-[0.8rem] leading-[1.5] text-muted-foreground">
                {ifp.long}
              </p>
            </div>
            <div className="flex items-baseline gap-3">
              <MonoChip tone="muted" size="xs">
                OMB
              </MonoChip>
              <p className="text-[0.8rem] leading-[1.5] text-muted-foreground">
                {omb.long}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Heatmap */}
      <Section
        number="I"
        title="Category × Topic"
        lede={`Top ${ROW_CAP} categories × top ${COL_CAP} topics by use-case count. Click any cell to filter /use-cases to that intersection.`}
      >
        <CategoryTopicHeatmap data={data} />

        {/* Off-cap indicator. Only render if anything was truncated, so a
            full corpus inside the cap doesn't earn a misleading footnote. */}
        {hasOffCap && (
          <div className="mt-6 border-t border-border pt-4 font-mono text-[11px] leading-[1.5] text-muted-foreground">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--stamp)]">
              Σ off-cap
            </span>{" "}
            <span className="text-foreground">
              {offCapRows > 0 && (
                <>
                  {offCapRows} categor{offCapRows === 1 ? "y" : "ies"}{" "}
                </>
              )}
              {offCapRows > 0 && offCapCols > 0 && "· "}
              {offCapCols > 0 && (
                <>
                  {offCapCols} topic{offCapCols === 1 ? "" : "s"}{" "}
                </>
              )}
              {(offCapRows > 0 || offCapCols > 0) && offCapUseCases > 0 && "· "}
              {offCapUseCases > 0 && (
                <>
                  {offCapUseCases} use case
                  {offCapUseCases === 1 ? "" : "s"}{" "}
                </>
              )}
            </span>
            sit outside the visible {ROW_CAP} × {COL_CAP} window. Visible cells
            cover{" "}
            <span className="text-foreground tabular-nums">
              {data.visibleUseCaseCount.toLocaleString()}
            </span>{" "}
            of{" "}
            <span className="text-foreground tabular-nums">
              {data.totalUseCaseCount.toLocaleString()}
            </span>{" "}
            classified use cases.
          </div>
        )}
      </Section>
    </div>
  );
}
