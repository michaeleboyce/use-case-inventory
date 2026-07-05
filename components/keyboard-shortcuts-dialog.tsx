"use client";

import { useEffect, useRef } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS: Array<{ keys: string; label: string }> = [
  { keys: "j", label: "Next discrepancy" },
  { keys: "k", label: "Previous discrepancy" },
  { keys: "r", label: "Focus reason dropdown" },
  { keys: "Enter", label: "Submit resolution and advance (when reason focused)" },
  { keys: "u", label: "Unmark resolved" },
  { keys: "g l", label: "Back to list" },
  { keys: "?", label: "Show this dialog" },
];

export function KeyboardShortcutsDialog({ open, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Sync the imperatively-controlled <dialog> with the boolean prop.
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) {
      dlg.showModal();
    } else if (!open && dlg.open) {
      dlg.close();
    }
  }, [open]);

  // Close on Escape (the <dialog> element's built-in cancel event).
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    function onCancel(e: Event) {
      e.preventDefault();
      onClose();
    }
    dlg.addEventListener("cancel", onCancel);
    return () => dlg.removeEventListener("cancel", onCancel);
  }, [onClose]);

  // Backdrop click closes — checks if the click landed on the <dialog>
  // itself (the area outside the inner content box).
  function onClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      onClick={onClick}
      className="border border-border bg-background p-6 backdrop:bg-foreground/30"
    >
      <div className="min-w-[20rem] max-w-md space-y-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-display text-lg text-foreground">
            Keyboard shortcuts
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <dl className="space-y-2 text-sm">
          {SHORTCUTS.map((s) => (
            <div
              key={s.keys}
              className="flex items-baseline justify-between gap-4"
            >
              <dt className="font-mono text-xs text-foreground">
                <kbd className="border border-border bg-muted px-1.5 py-0.5">
                  {s.keys}
                </kbd>
              </dt>
              <dd className="text-foreground">{s.label}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-muted-foreground">
          Shortcuts are ignored while typing in an input, textarea, or select.
        </p>
      </div>
    </dialog>
  );
}
