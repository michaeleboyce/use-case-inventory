/**
 * Deterministic matrix seriation via seeded two-pass barycenter reordering.
 *
 * Reorders the rows and columns of a non-negative weight matrix so that heavy
 * cells cluster toward the diagonal — turning a scattered pattern into a
 * contiguous block. Pure and dependency-free.
 *
 * Determinism contract: every sort — the seed and each barycenter pass —
 * breaks ties by ORIGINAL INDEX ASCENDING, so the result depends only on the
 * matrix values, never on input array identity or a prior ordering. Zero-weight
 * lines carry a +Infinity barycenter and land last (in original order). Running
 * `seriate` twice on equal input therefore yields equal output.
 */

export type CellWeight = 0 | 1 | 2;

export interface Seriation {
  /** Permutation of row indices into the original matrix. */
  rowOrder: number[];
  /** Permutation of column indices into the original matrix. */
  colOrder: number[];
}

/** Reindex `arr` by `order`: `applyPermutation(a, [2,0,1])` → `[a[2],a[0],a[1]]`. */
export function applyPermutation<T>(arr: T[], order: number[]): T[] {
  return order.map((i) => arr[i]);
}

export function seriate(matrix: CellWeight[][], passes = 2): Seriation {
  const nRows = matrix.length;
  const nCols = matrix.reduce((m, row) => Math.max(m, row.length), 0);

  const identity = (n: number) => Array.from({ length: n }, (_, i) => i);
  if (nRows === 0 || nCols === 0) {
    return { rowOrder: identity(nRows), colOrder: identity(nCols) };
  }

  const w = (r: number, c: number): number => matrix[r][c] ?? 0;

  // Seed: heaviest lines first, ties by original index ascending.
  let rowOrder = byDescWeight(nRows, (r) => sum(nCols, (c) => w(r, c)));
  let colOrder = byDescWeight(nCols, (c) => sum(nRows, (r) => w(r, c)));

  for (let p = 0; p < passes; p++) {
    // (a) columns by barycenter of the CURRENT row positions.
    const rowPos = positionOf(rowOrder);
    colOrder = byBarycenter(nCols, (c) =>
      barycenter(nRows, (r) => w(r, c), rowPos),
    );
    // (b) rows by barycenter of the JUST-UPDATED column positions.
    const colPos = positionOf(colOrder);
    rowOrder = byBarycenter(nRows, (r) =>
      barycenter(nCols, (c) => w(r, c), colPos),
    );
  }

  return { rowOrder, colOrder };
}

function sum(n: number, value: (i: number) => number): number {
  let s = 0;
  for (let i = 0; i < n; i++) s += value(i);
  return s;
}

/** `position[originalIndex]` = its rank within `order`. */
function positionOf(order: number[]): number[] {
  const pos = new Array<number>(order.length);
  order.forEach((orig, rank) => {
    pos[orig] = rank;
  });
  return pos;
}

function byDescWeight(n: number, weight: (i: number) => number): number[] {
  const w = Array.from({ length: n }, (_, i) => weight(i));
  return Array.from({ length: n }, (_, i) => i).sort((a, b) =>
    w[a] === w[b] ? a - b : w[b] - w[a],
  );
}

/**
 * Weighted mean of `pos[k]` over indices k with weight(k) > 0.
 * Returns +Infinity for an all-zero line so it sorts last.
 */
function barycenter(
  n: number,
  weight: (k: number) => number,
  pos: number[],
): number {
  let num = 0;
  let den = 0;
  for (let k = 0; k < n; k++) {
    const wk = weight(k);
    if (wk > 0) {
      num += wk * pos[k];
      den += wk;
    }
  }
  return den === 0 ? Infinity : num / den;
}

function byBarycenter(n: number, bary: (i: number) => number): number[] {
  const b = Array.from({ length: n }, (_, i) => bary(i));
  return Array.from({ length: n }, (_, i) => i).sort((a, c) =>
    // Equal barycenters (including two +Infinity lines) fall to original index.
    b[a] === b[c] ? a - c : b[a] - b[c],
  );
}
