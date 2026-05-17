/**
 * Minimal LCS-based word diff. Tokenizes inputs on whitespace boundaries
 * (keeping whitespace tokens) so concatenating segment texts is lossless.
 *
 * Output collapses adjacent same-type segments.
 */

export type DiffSegment =
  | { type: "equal"; text: string }
  | { type: "insert"; text: string }
  | { type: "delete"; text: string };

function tokenize(s: string): string[] {
  if (!s) return [];
  // Split into runs of whitespace and runs of non-whitespace.
  return s.match(/\s+|\S+/g) ?? [];
}

export function diffWords(a: string, b: string): DiffSegment[] {
  if (!a && !b) return [];
  if (!a) return [{ type: "insert", text: b }];
  if (!b) return [{ type: "delete", text: a }];

  const ta = tokenize(a);
  const tb = tokenize(b);
  const n = ta.length;
  const m = tb.length;

  // LCS DP table (n+1) x (m+1).
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = ta[i - 1] === tb[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Walk back to produce reversed segments.
  const rev: DiffSegment[] = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (ta[i - 1] === tb[j - 1]) {
      rev.push({ type: "equal", text: ta[i - 1] });
      i--;
      j--;
    } else if (dp[i][j - 1] >= dp[i - 1][j]) {
      // Prefer consuming from b first so deletions appear before insertions
      // in the final (forward) segment order.
      rev.push({ type: "insert", text: tb[j - 1] });
      j--;
    } else {
      rev.push({ type: "delete", text: ta[i - 1] });
      i--;
    }
  }
  while (i > 0) {
    rev.push({ type: "delete", text: ta[i - 1] });
    i--;
  }
  while (j > 0) {
    rev.push({ type: "insert", text: tb[j - 1] });
    j--;
  }

  // Reverse and collapse adjacent same-type segments.
  const out: DiffSegment[] = [];
  for (let k = rev.length - 1; k >= 0; k--) {
    const seg = rev[k];
    const last = out[out.length - 1];
    if (last && last.type === seg.type) {
      last.text += seg.text;
    } else {
      out.push({ ...seg });
    }
  }
  return out;
}
