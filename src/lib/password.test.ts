import { describe, expect, it } from "vitest";
import { MIN_PASSWORD_LENGTH, passwordIssue } from "./password";

describe("passwordIssue", () => {
  it("rejects a password shorter than the minimum", () => {
    expect(passwordIssue("a1" + "b".repeat(MIN_PASSWORD_LENGTH - 3))).toMatch(/at least/i);
  });

  it("rejects a password with only letters", () => {
    expect(passwordIssue("abcdefgh")).toMatch(/mix of letters/i);
  });

  it("rejects a password with only digits", () => {
    expect(passwordIssue("12345678")).toMatch(/mix of letters/i);
  });

  it("accepts a password meeting length and complexity", () => {
    expect(passwordIssue("correcthorse1")).toBeNull();
  });
});
