"use client";

/**
 * Tiny keyboard-shortcut hook for the /discrepancies triage workbench.
 *
 * Usage:
 *   useKeyboardShortcuts({
 *     j: nextDiscrepancy,
 *     k: prevDiscrepancy,
 *     r: focusReasonSelect,
 *     u: unmark,
 *     "?": toggleDialog,
 *     "g l": goToList,
 *   });
 *
 * Behavior:
 *   - Listens on `window` for `keydown`.
 *   - Skips when `event.target` is an input / textarea / select /
 *     contenteditable — so typing in the note box doesn't trigger j/k.
 *   - Skips when any modifier (ctrl/cmd/alt/meta) is held — we don't
 *     want to clash with browser defaults (cmd+r, ctrl+k, etc.).
 *   - Keys are matched on `event.key.toLowerCase()`.
 *   - Two-key sequences are written as `"g l"` and matched via a
 *     1-second "leader" window: press `g`, then `l` within 1s.
 */
import { useEffect, useRef } from "react";

export type ShortcutHandlers = Record<string, () => void>;

interface Options {
  enabled?: boolean;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

export function useKeyboardShortcuts(
  handlers: ShortcutHandlers,
  opts: Options = {},
): void {
  const { enabled = true } = opts;
  // Keep handlers in a ref so the effect doesn't re-bind on every render.
  // The ref must be updated in an effect (not during render) to satisfy
  // React 19's `react-hooks/refs` rule and to avoid tearing under
  // concurrent rendering. keydown is async from the user's perspective,
  // so a one-commit delay in the ref is invisible in practice.
  const handlersRef = useRef<ShortcutHandlers>(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!enabled) return;

    // Pre-split handler keys into singles and sequences for fast lookup.
    let leader: { key: string; expires: number } | null = null;

    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;

      const key = event.key.toLowerCase();
      const map = handlersRef.current;
      const now = Date.now();

      // 1. If we have an active leader, look for a sequence match first.
      if (leader && now <= leader.expires) {
        const seqKey = `${leader.key} ${key}`;
        const handler = map[seqKey];
        leader = null;
        if (handler) {
          event.preventDefault();
          handler();
          return;
        }
        // No sequence matched — fall through and treat the new key as a
        // potentially-fresh leader or a single-key match.
      } else {
        leader = null;
      }

      // 2. Direct single-key match.
      const direct = map[key];
      if (direct) {
        event.preventDefault();
        direct();
        return;
      }

      // 3. If any registered key starts a sequence ("<key> <something>"),
      // arm the leader for 1 second.
      for (const k of Object.keys(map)) {
        if (k.length > 1 && k.charAt(1) === " " && k.charAt(0) === key) {
          leader = { key, expires: now + 1000 };
          return;
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
