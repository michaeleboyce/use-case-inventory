/**
 * The capability ladder: three rungs of the 2025 federal AI experience.
 * Chat assistants arrived broadly; coding assistance exists but sits mostly
 * pre-production; analytics platforms are federated and barely surface in
 * the inventory at all. Server component — static markup over the audited
 * tag counts from `getCapabilityLadder()`.
 */

import Link from "next/link";
import type { CapabilityLadderData } from "@/lib/db/experience";

function Rung({
  step,
  title,
  status,
  children,
}: {
  step: string;
  title: string;
  status: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border p-5">
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Rung {step}
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--stamp)]">
          {status}
        </p>
      </div>
      <h3 className="mt-1 font-display text-lg text-foreground">{title}</h3>
      <div className="mt-3 text-sm leading-relaxed text-foreground">
        {children}
      </div>
    </div>
  );
}

export function CapabilityLadder({ data }: { data: CapabilityLadderData }) {
  const { chat, coding, analytics } = data;
  const codingLive = coding.deployed_2025 + coding.pilot_2025;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Rung step="1" title="A chat assistant" status="arrived">
        <p>
          <strong>{chat.llm_access_2025.toLocaleString()}</strong> inventory
          entries give staff general-purpose LLM access — arbitrary prompts,
          approved for internal work. After IFP&apos;s row-by-row review,{" "}
          <strong>{chat.enterprise_agencies_2025.length} agencies</strong>{" "}
          run generative AI enterprise-wide (up from{" "}
          {chat.enterprise_agencies_2024} in 2024):
        </p>
        <p className="mt-2 font-mono text-xs leading-relaxed text-muted-foreground">
          {chat.enterprise_agencies_2025.join(" · ")}
        </p>
        <p className="mt-2 text-muted-foreground">
          StateChat alone reaches ~45,000 active users; VA GPT onboarded
          ~100,000. The pattern of the cycle: a department-wide chatbot,
          rolled out by memo.
        </p>
      </Rung>

      <Rung step="2" title="A coding assistant" status="pending">
        <p>
          Just <strong>{coding.individual_2025}</strong> individually filed
          use cases deploy a developer coding assistant (
          {coding.individual_2024} in 2024) — and only{" "}
          <strong>{codingLive}</strong> of them are past pre-deployment
          ({coding.deployed_2025} deployed, {coding.pilot_2025} pilots).
          Leaders:{" "}
          {coding.top_agencies
            .slice(0, 5)
            .map((a) => `${a.abbreviation} (${a.count})`)
            .join(", ")}
          .
        </p>
        <p className="mt-2 text-muted-foreground">
          Another {coding.appendix_b_checkboxes} agencies checked the
          Appendix-B &ldquo;generating code&rdquo; template box — mostly
          M365 Copilot&apos;s incidental code chat, not a managed rollout
          of GitHub Copilot-class tooling.
        </p>
      </Rung>

      <Rung step="3" title="AI on real agency data" status="opaque">
        <p>
          The inventory format barely surfaces analytic platforms: a
          verified compute environment exists on only{" "}
          <strong>{analytics.env_known_rows}</strong> of ~3,500 rows, and
          those came from targeted research, not agency filings. Where
          analysts do have a place to work — CDC&apos;s EDAV, CMS&apos;s
          IDR Cloud, VA&apos;s VINCI, IRS RAAS — it is bureau
          infrastructure that predates the chatbot wave.
        </p>
        <p className="mt-2 text-muted-foreground">
          A chatbot answers a prompt; an analytics platform holds the data,
          the model, and the authority to act on it. Most agencies have
          shipped the first and not the second.
        </p>
      </Rung>
    </div>
  );
}

export function CapabilityLadderFootnote() {
  return (
    <p className="mt-5 font-mono text-[11px] leading-relaxed text-muted-foreground">
      Counts from IFP&apos;s audited tag layer (row-by-row review with web
      corroboration; see the{" "}
      <Link href="/about" className="underline-offset-2 hover:underline">
        colophon
      </Link>{" "}
      for method). Coding excludes Appendix-B template checkboxes.
      Enterprise-wide list reflects web-verified scope corrections —
      StateChat, VA GPT, DHSChat and peers were under-scoped in the raw
      filings.
    </p>
  );
}
