import { describe, expect, it } from "vitest";
import {
  applyPermutation,
  seriate,
  type CellWeight,
  type Seriation,
} from "@/app/fedramp/coverage/sleeping-services/_seriation";

/** Distance of every non-zero cell from the diagonal under a given ordering.
 *  Lower = tighter block; the metric seriation is meant to minimize. */
function bandwidthScore(matrix: CellWeight[][], order: Seriation): number {
  const nRows = matrix.length;
  const nCols = matrix.reduce((m, r) => Math.max(m, r.length), 0);
  const ratio = nRows / nCols;
  const rowPos = new Array<number>(nRows);
  order.rowOrder.forEach((orig, rank) => (rowPos[orig] = rank));
  const colPos = new Array<number>(nCols);
  order.colOrder.forEach((orig, rank) => (colPos[orig] = rank));
  let score = 0;
  for (let r = 0; r < nRows; r++) {
    for (let c = 0; c < nCols; c++) {
      if ((matrix[r][c] ?? 0) > 0) {
        score += Math.abs(rowPos[r] - colPos[c] * ratio);
      }
    }
  }
  return score;
}

/** The seed ordering seriate() starts from: lines by descending weight,
 *  ties by original index. Lets tests assert the passes actually improve it. */
function seedOrder(matrix: CellWeight[][]): Seriation {
  const nRows = matrix.length;
  const nCols = matrix.reduce((m, r) => Math.max(m, r.length), 0);
  const byWeightDesc = (weights: number[]) =>
    weights.map((_, i) => i).sort((a, b) =>
      weights[a] === weights[b] ? a - b : weights[b] - weights[a],
    );
  const rowWeights = matrix.map((r) =>
    r.reduce<number>((s, v) => s + (v ?? 0), 0),
  );
  const colWeights = Array.from({ length: nCols }, (_, c) =>
    matrix.reduce<number>((s, r) => s + (r[c] ?? 0), 0),
  );
  return { rowOrder: byWeightDesc(rowWeights), colOrder: byWeightDesc(colWeights) };
}

describe("applyPermutation", () => {
  it("reindexes by the given order", () => {
    expect(applyPermutation(["a", "b", "c"], [2, 0, 1])).toEqual(["c", "a", "b"]);
  });
});

describe("seriate — invariants", () => {
  const fixtures: CellWeight[][][] = [
    [
      [0, 2, 0, 2, 0],
      [2, 0, 0, 0, 2],
      [0, 1, 0, 1, 0],
      [1, 0, 0, 0, 1],
    ],
    [
      [0, 0, 2],
      [0, 2, 1],
      [2, 1, 0],
    ],
    [
      [2, 0, 1, 0],
      [0, 1, 0, 2],
      [1, 0, 2, 0],
    ],
  ];

  it("is deterministic — same input twice gives the same output", () => {
    for (const m of fixtures) {
      expect(seriate(m)).toEqual(seriate(m));
    }
  });

  it("returns valid permutations (sorted order == 0..n-1)", () => {
    for (const m of fixtures) {
      const { rowOrder, colOrder } = seriate(m);
      const nCols = m.reduce((x, r) => Math.max(x, r.length), 0);
      expect([...rowOrder].sort((a, b) => a - b)).toEqual(
        Array.from({ length: m.length }, (_, i) => i),
      );
      expect([...colOrder].sort((a, b) => a - b)).toEqual(
        Array.from({ length: nCols }, (_, i) => i),
      );
    }
  });

  it("never increases the bandwidth score vs the seed", () => {
    for (const m of fixtures) {
      expect(bandwidthScore(m, seriate(m))).toBeLessThanOrEqual(
        bandwidthScore(m, seedOrder(m)),
      );
    }
  });

  it("does not throw on an empty matrix or empty rows", () => {
    expect(seriate([])).toEqual({ rowOrder: [], colOrder: [] });
    expect(seriate([[], []])).toEqual({ rowOrder: [0, 1], colOrder: [] });
  });
});

describe("seriate — a scattered off-diagonal block becomes contiguous", () => {
  // Two interleaved groups: rows {0,2} share cols {1,3}; rows {1,3} share
  // cols {0,4}; col 2 is empty. Seriation must separate the two groups.
  const matrix: CellWeight[][] = [
    [0, 2, 0, 2, 0],
    [2, 0, 0, 0, 2],
    [0, 1, 0, 1, 0],
    [1, 0, 0, 0, 1],
  ];

  it("reaches the exact hand-computed ordering", () => {
    expect(seriate(matrix)).toEqual({
      rowOrder: [0, 2, 1, 3],
      colOrder: [1, 3, 0, 4, 2],
    });
  });

  it("renders the two groups as adjacent blocks", () => {
    const { rowOrder, colOrder } = seriate(matrix);
    const reordered = applyPermutation(matrix, rowOrder).map((row) =>
      applyPermutation(row, colOrder),
    );
    // Top-left 2×2 and the next 2×2 down/right each hold one group's mass;
    // the empty column sits last.
    expect(reordered).toEqual([
      [2, 2, 0, 0, 0],
      [1, 1, 0, 0, 0],
      [0, 0, 2, 2, 0],
      [0, 0, 1, 1, 0],
    ]);
    expect(bandwidthScore(matrix, seriate(matrix))).toBeLessThan(
      bandwidthScore(matrix, seedOrder(matrix)),
    );
  });
});
