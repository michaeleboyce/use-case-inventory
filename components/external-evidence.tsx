import { CheckCircle2, FileSearch, ExternalLink, Search } from "lucide-react";
import type {
  UseCaseExternalEvidence,
  ExternalEvidenceStatus,
  ExternalEvidenceTopic,
} from "@/lib/types";

const TOPIC_LABEL: Record<string, string> = {
  general_llm: "General-purpose LLM",
  coding: "AI for coding",
  data_analysis: "AI data analysis",
};

const STATUS_RANK: Record<ExternalEvidenceStatus, number> = {
  corroborated: 0,
  inventory_only: 1,
  searched_no_source: 2,
};

function statusLabel(s: ExternalEvidenceStatus): string {
  switch (s) {
    case "corroborated":
      return "Corroborated";
    case "inventory_only":
      return "Inventory only";
    case "searched_no_source":
      return "No external source";
  }
}

function StatusIcon({
  status,
  className,
}: {
  status: ExternalEvidenceStatus;
  className?: string;
}) {
  const cls = className ?? "size-3";
  if (status === "corroborated")
    return (
      <CheckCircle2 className={`${cls} text-[var(--verified)]`} aria-hidden />
    );
  if (status === "searched_no_source")
    return (
      <Search className={`${cls} text-muted-foreground`} aria-hidden />
    );
  return <FileSearch className={`${cls} text-foreground/70`} aria-hidden />;
}

/** Hero-strip badge: rolls all evidence rows up into a single status chip.
 *  Shown in the use-case page header alongside the other tag flags. */
export function ExternalEvidenceBadge({
  evidence,
}: {
  evidence: UseCaseExternalEvidence[];
}) {
  if (evidence.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
        <Search className="size-3 text-muted-foreground/60" aria-hidden />
        Not externally verified
      </span>
    );
  }
  const top = [...evidence].sort(
    (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status],
  )[0];
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.1em] text-foreground">
      <StatusIcon status={top.status} />
      {statusLabel(top.status)}
    </span>
  );
}

/** Full section body listing every evidence row, grouped by topic. */
export function ExternalEvidenceList({
  evidence,
}: {
  evidence: UseCaseExternalEvidence[];
}) {
  if (evidence.length === 0) {
    return (
      <div className="border-t-2 border-foreground pt-4">
        <p className="max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
          No external corroboration has been recorded for this entry yet. The
          claim still rests on what the agency itself wrote in its 2025
          inventory filing — a useful starting point, but not independent
          verification.
        </p>
      </div>
    );
  }

  // Group by topic for editorial readability.
  const byTopic = new Map<ExternalEvidenceTopic, UseCaseExternalEvidence[]>();
  for (const row of evidence) {
    const list = byTopic.get(row.topic) ?? [];
    list.push(row);
    byTopic.set(row.topic, list);
  }

  return (
    <ul className="flex flex-col divide-y divide-border border-t-2 border-foreground">
      {[...byTopic.entries()].map(([topic, rows]) => (
        <li key={topic} className="py-5 first:pt-4">
          <div className="mb-2 flex items-baseline gap-3">
            <p className="font-display italic text-[1.25rem] leading-tight tracking-[-0.01em] text-foreground">
              {TOPIC_LABEL[topic] ?? topic.replace(/_/g, " ")}
            </p>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {rows.length} {rows.length === 1 ? "row" : "rows"}
            </span>
          </div>
          <ul className="flex flex-col gap-3">
            {rows.map((row) => (
              <EvidenceRow key={row.id} row={row} />
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

function EvidenceRow({ row }: { row: UseCaseExternalEvidence }) {
  return (
    <li className="rounded-sm border-l-2 border-border pl-4">
      <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        <StatusIcon status={row.status} />
        <span className="text-foreground">{statusLabel(row.status)}</span>
        {row.confidence && (
          <>
            <span>·</span>
            <span>{row.confidence} confidence</span>
          </>
        )}
        {row.captured_at && (
          <>
            <span>·</span>
            <span>captured {row.captured_at}</span>
          </>
        )}
      </div>

      {row.source_url && (
        <p className="mt-1.5">
          <a
            href={row.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[13px] text-foreground hover:text-[var(--stamp)]"
          >
            <span className="break-all underline-offset-2 hover:underline">
              {row.source_url}
            </span>
            <ExternalLink className="size-3 shrink-0" aria-hidden />
          </a>
        </p>
      )}

      {row.source_quote && (
        <blockquote className="mt-2 max-w-[62ch] border-l-2 border-foreground/20 pl-3 text-[13px] leading-snug text-foreground/85">
          &ldquo;{row.source_quote}&rdquo;
        </blockquote>
      )}

      {row.notes && (
        <p className="mt-1.5 max-w-[62ch] text-[12px] leading-snug text-muted-foreground">
          {row.notes}
        </p>
      )}

      {row.search_method && (
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground/70">
          method · {row.search_method.replace(/_/g, " ")}
        </p>
      )}
    </li>
  );
}
