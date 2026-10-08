import { describe, expect, it } from "vitest";
import { formatDate, todayStr } from "./dates";

describe("todayStr", () => {
  it("returns today's local calendar date in YYYY-MM-DD form", () => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    expect(todayStr()).toBe(`${d.getFullYear()}-${mm}-${dd}`);
  });

  it("always matches the YYYY-MM-DD shape", () => {
    expect(todayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("formatDate", () => {
  it("returns null when there is no date", () => {
    expect(formatDate(null)).toBeNull();
  });

  it("passes through input it cannot parse", () => {
    expect(formatDate("not-a-date")).toBe("not-a-date");
  });

  it("omits the year for a date in the current year", () => {
    const label = formatDate(todayStr());
    expect(label).not.toMatch(/\d{4}/);
    expect(label).toMatch(/[A-Za-z]/);
  });

  it("includes the year for a date in a different year", () => {
    const otherYear = new Date().getFullYear() + 1;
    const label = formatDate(`${otherYear}-01-15`);
    expect(label).toContain(String(otherYear));
    expect(label).toContain("Jan");
  });
});
