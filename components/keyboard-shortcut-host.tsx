"use client";

/**
 * Detail-page keyboard host for /discrepancies/[auditId].
 *
 * Wires j/k/r/u/?/gl shortcuts to navigation + form actions. Mounted as
 * a child of the server component, but only when `canWrite` is true —
 * Vercel (read-only mode) gets no host at all.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { unmarkResolved } from "@/app/discrepancies/actions";
import { KeyboardShortcutsDialog } from "@/components/keyboard-shortcuts-dialog";
import { useKeyboardShortcuts } from "@/lib/use-keyboard-shortcuts";

interface Props {
  auditId: number;
  agency: string;
  name: string;
  resolved: boolean;
  orderedAuditIds: number[];
}

export function KeyboardShortcutHost({
  auditId,
  agency,
  name,
  resolved,
  orderedAuditIds,
}: Props) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [, startTransition] = useTransition();

  const idx = orderedAuditIds.indexOf(auditId);

  function goNext() {
    if (idx >= 0 && idx + 1 < orderedAuditIds.length) {
      router.push(`/discrepancies/${orderedAuditIds[idx + 1]}`);
    }
  }
  function goPrev() {
    if (idx > 0) {
      router.push(`/discrepancies/${orderedAuditIds[idx - 1]}`);
    }
  }
  function focusReason() {
    const el = document.getElementById("resolution-reason");
    if (el instanceof HTMLSelectElement) {
      el.focus();
    }
  }
  function doUnmark() {
    if (!resolved) return;
    const fd = new FormData();
    fd.set("auditId", String(auditId));
    fd.set("agency", agency);
    fd.set("name", name);
    startTransition(async () => {
      await unmarkResolved(fd);
      router.refresh();
    });
  }
  function goList() {
    router.push("/discrepancies");
  }
  function toggleDialog() {
    setDialogOpen((v) => !v);
  }

  useKeyboardShortcuts({
    j: goNext,
    k: goPrev,
    r: focusReason,
    u: doUnmark,
    "?": toggleDialog,
    "g l": goList,
  });

  return (
    <KeyboardShortcutsDialog
      open={dialogOpen}
      onClose={() => setDialogOpen(false)}
    />
  );
}
