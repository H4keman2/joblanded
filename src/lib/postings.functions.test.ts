import { describe, expect, it } from "vitest";
import { splitPostings } from "./postings.functions";

const LONG_ENOUGH = "x".repeat(60);

describe("splitPostings", () => {
  it("splits on a dashed separator line", () => {
    const text = [`First posting. ${LONG_ENOUGH}`, "---", `Second posting. ${LONG_ENOUGH}`].join(
      "\n",
    );
    const result = splitPostings(text);
    expect(result).toHaveLength(2);
    expect(result[0]).toContain("First posting");
    expect(result[1]).toContain("Second posting");
  });

  it("falls back to blank-line separation when there's no dashed separator", () => {
    const text = [`First posting. ${LONG_ENOUGH}`, "", "", `Second posting. ${LONG_ENOUGH}`].join(
      "\n",
    );
    const result = splitPostings(text);
    expect(result).toHaveLength(2);
  });

  it("drops fragments shorter than the minimum length", () => {
    const text = [`Real posting. ${LONG_ENOUGH}`, "---", "too short"].join("\n");
    const result = splitPostings(text);
    expect(result).toHaveLength(1);
  });

  it("caps the number of postings returned", () => {
    const many = Array.from({ length: 12 }, (_, i) => `Posting ${i}. ${LONG_ENOUGH}`).join(
      "\n---\n",
    );
    const result = splitPostings(many);
    expect(result.length).toBeLessThanOrEqual(8);
  });

  it("returns nothing for input with no postings of usable length", () => {
    expect(splitPostings("too short\n\n\nalso short")).toEqual([]);
  });
});
