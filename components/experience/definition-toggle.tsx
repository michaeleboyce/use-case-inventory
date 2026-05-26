"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  GENAI_DEFINITION_LABELS,
  GENAI_DEFINITION_SHORT,
  GENAI_DEFINITION_SOURCE,
  type GenAiDefinition,
} from "@/lib/experience-shared";

const ORDER: GenAiDefinition[] = [
  "omb",
  "ifp_genai",
  "ifp_llm_access",
  "ifp_enterprise",
];

/**
 * Pill row letting the reader flip between the four GenAI definitions. The
 * label "GenAI" is genuinely contested — OMB's filed classification and IFP's
 * post-hoc tagging disagree on hundreds of use cases. The toggle makes the
 * disagreement visible instead of hiding it behind one editor's choice.
 */
export function DefinitionToggle({
  value,
  onChange,
}: {
  value: GenAiDefinition;
  onChange: (d: GenAiDefinition) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="font-mono uppercase tracking-[0.14em] text-muted-foreground">
        Definition:
      </span>
      {ORDER.map((d) => {
        const active = value === d;
        const source = GENAI_DEFINITION_SOURCE[d];
        return (
          <Button
            key={d}
            variant={active ? "default" : "outline"}
            size="sm"
            onClick={() => onChange(d)}
            title={GENAI_DEFINITION_LABELS[d]}
            className="font-mono text-[11px]"
          >
            <span
              aria-hidden
              className={
                source === "omb"
                  ? "mr-1 text-muted-foreground"
                  : "mr-1 text-[var(--stamp)]"
              }
            >
              {source === "omb" ? "OMB" : "IFP"}
            </span>
            {GENAI_DEFINITION_SHORT[d]}
          </Button>
        );
      })}
    </div>
  );
}
