import { describe, expect, it } from "vitest";
import { containsToken, scoreAgainstResume, titleWordsFrom, dedupeSkills } from "./jobs.functions";

describe("containsToken", () => {
  it("matches a whole-word occurrence", () => {
    expect(containsToken("senior product manager", "product")).toBe(true);
  });

  it("does not false-positive match a short token as a substring", () => {
    // "ai" inside "training"/"maintain" used to flood matches before this
    // word-boundary check existed.
    expect(containsToken("we offer training and career growth", "ai")).toBe(false);
    expect(containsToken("please maintain the codebase", "ai")).toBe(false);
  });

  it("matches a short token at a real word boundary", () => {
    expect(containsToken("experience with ai and ml tooling", "ai")).toBe(true);
  });

  it("returns false for an empty token", () => {
    expect(containsToken("anything", "")).toBe(false);
  });
});

describe("titleWordsFrom", () => {
  it("extracts meaningful words and drops short filler words", () => {
    const words = titleWordsFrom(["Senior Product Manager"]);
    expect(words.has("product")).toBe(true);
    expect(words.has("manager")).toBe(true);
    expect(words.has("senior")).toBe(false); // filtered filler word
  });
});

describe("dedupeSkills", () => {
  it("removes case/whitespace-insensitive duplicates", () => {
    expect(dedupeSkills(["Python", "python", " PYTHON ", "SQL"])).toEqual(["Python", "SQL"]);
  });
});

describe("scoreAgainstResume", () => {
  it("returns null fit when there's nothing to compare against", () => {
    const { fit, matched } = scoreAgainstResume("some job text", "Some Title", [], new Set());
    expect(fit).toBeNull();
    expect(matched).toEqual([]);
  });

  it("scores higher when more skills overlap", () => {
    const skills = ["python", "sql", "product management"];
    const titleWords = titleWordsFrom(["Product Manager"]);

    const strong = scoreAgainstResume(
      "Looking for a product manager skilled in python, sql and product management.",
      "Product Manager",
      skills,
      titleWords,
    );
    const weak = scoreAgainstResume(
      "Looking for a warehouse associate.",
      "Warehouse Associate",
      skills,
      titleWords,
    );

    expect(strong.fit).not.toBeNull();
    expect(weak.fit ?? 0).toBeLessThan(strong.fit ?? 0);
  });

  it("caps fit at 100", () => {
    const skills = ["python"];
    const titleWords = titleWordsFrom(["Python Developer"]);
    const { fit } = scoreAgainstResume(
      "Python developer role, python python python python",
      "Python Developer",
      skills,
      titleWords,
    );
    expect(fit).not.toBeNull();
    expect(fit!).toBeLessThanOrEqual(100);
  });
});
