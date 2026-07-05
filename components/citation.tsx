"use client";

/**
 * The one way research sources render across the dashboard: link text is the
 * source title (hostname when untitled), an outbound-link glyph, an optional
 * date, and a copy button that puts the MLA-formatted citation on the
 * clipboard. Used by the external-evidence list, the AI-access table, and the
 * seat-model source lines so every citation reads and copies the same way.
 */

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";

import { formatMla, hostnameOf, type CitationFields } from "@/lib/citation";

function useCopy(text: string) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // no-op: clipboard may be unavailable
    }
  };
  return { copied, onCopy };
}

/** Small "MLA / Copied" chip; also reusable for prose citations. */
export function CopyCitationButton({ text }: { text: string }) {
  const { copied, onCopy } = useCopy(text);
  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label="Copy MLA citation"
      title="Copy MLA citation"
      className="inline-flex items-center gap-1 border border-border px-1.5 py-0.5 align-baseline font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:border-[var(--stamp)] hover:text-[var(--stamp)]"
    >
      {copied ? (
        <>
          <Check className="size-2.5" aria-hidden /> Copied
        </>
      ) : (
        <>
          <Copy className="size-2.5" aria-hidden /> MLA
        </>
      )}
    </button>
  );
}

export function Citation({
  url,
  title,
  date,
  accessed,
  label,
  display,
  className,
}: CitationFields & {
  /** Mono micro-label rendered before the link ("Headcount source"). */
  label?: string;
  /** Link text override when the recorded title is too long to display. */
  display?: string;
  className?: string;
}) {
  const text = display ?? title?.trim() ?? hostnameOf(url) ?? url;
  return (
    <span
      className={`inline-flex flex-wrap items-baseline gap-x-2 gap-y-1 ${className ?? ""}`}
    >
      {label ? (
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </span>
      ) : null}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-baseline gap-1 text-foreground underline decoration-dotted underline-offset-2 hover:text-[var(--stamp)]"
      >
        <span className="break-all">{text}</span>
        <ExternalLink className="size-3 shrink-0 self-center" aria-hidden />
      </a>
      {date ? (
        <span className="font-mono text-[11px] text-muted-foreground">
          {date}
        </span>
      ) : null}
      <CopyCitationButton text={formatMla({ url, title, date, accessed })} />
    </span>
  );
}
