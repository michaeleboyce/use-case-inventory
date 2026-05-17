import { describe, it, expect } from "vitest";
import { diffWords, type DiffSegment } from "@/lib/diff-words";

function concat(segs: DiffSegment[], filter: (s: DiffSegment) => boolean) {
  return segs.filter(filter).map((s) => s.text).join("");
}

describe("diffWords", () => {
  it("highlights a single replaced word with whitespace preserved", () => {
    const out = diffWords("the quick brown fox", "the slow brown fox");
    expect(out).toEqual([
      { type: "equal", text: "the " },
      { type: "delete", text: "quick" },
      { type: "insert", text: "slow" },
      { type: "equal", text: " brown fox" },
    ]);
  });

  it("treats empty old string as a pure insertion", () => {
    const out = diffWords("", "hello");
    expect(out).toEqual([{ type: "insert", text: "hello" }]);
  });

  it("treats empty new string as a pure deletion", () => {
    const out = diffWords("hello", "");
    expect(out).toEqual([{ type: "delete", text: "hello" }]);
  });

  it("returns a single equal segment when inputs match", () => {
    const out = diffWords("a b c", "a b c");
    expect(out).toEqual([{ type: "equal", text: "a b c" }]);
  });

  it("preserves whitespace: concat of equal+insert reconstructs b", () => {
    const a = "the quick brown fox";
    const b = "the very quick brown red fox";
    const segs = diffWords(a, b);
    const reconstructedB = concat(segs, (s) => s.type === "equal" || s.type === "insert");
    expect(reconstructedB).toBe(b);
    const reconstructedA = concat(segs, (s) => s.type === "equal" || s.type === "delete");
    expect(reconstructedA).toBe(a);
  });

  it("preserves whitespace: concat of equal+delete reconstructs a (pure deletes)", () => {
    const a = "alpha beta gamma delta";
    const b = "alpha gamma";
    const segs = diffWords(a, b);
    const reconstructedA = concat(segs, (s) => s.type === "equal" || s.type === "delete");
    expect(reconstructedA).toBe(a);
    const reconstructedB = concat(segs, (s) => s.type === "equal" || s.type === "insert");
    expect(reconstructedB).toBe(b);
  });

  it("collapses adjacent same-type segments", () => {
    const out = diffWords("a b c d", "x y c d");
    // a and " " and b should collapse into a single delete; x and " " and y into one insert.
    const types = out.map((s) => s.type);
    // No two adjacent segments share a type.
    for (let i = 1; i < types.length; i++) {
      expect(types[i]).not.toBe(types[i - 1]);
    }
  });

  it("handles both inputs empty", () => {
    expect(diffWords("", "")).toEqual([]);
  });
});
