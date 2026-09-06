import { describe, expect, it } from "vitest";
import { addBusinessDays } from "./applications.functions";

describe("addBusinessDays", () => {
  it("adds calendar days when no weekend is crossed", () => {
    // Tuesday 2026-09-08 + 2 business days = Thursday 2026-09-10
    expect(addBusinessDays("2026-09-08", 2)).toBe("2026-09-10");
  });

  it("skips over a weekend", () => {
    // Friday 2026-09-11 + 1 business day = Monday 2026-09-14
    expect(addBusinessDays("2026-09-11", 1)).toBe("2026-09-14");
  });

  it("skips a full weekend when the count spans it", () => {
    // Thursday 2026-09-10 + 2 business days = Monday 2026-09-14
    expect(addBusinessDays("2026-09-10", 2)).toBe("2026-09-14");
  });

  it("returns the same date when adding zero business days", () => {
    expect(addBusinessDays("2026-09-08", 0)).toBe("2026-09-08");
  });

  it("starting on a weekend still counts forward correctly", () => {
    // Saturday 2026-09-12 + 1 business day = Monday 2026-09-14
    expect(addBusinessDays("2026-09-12", 1)).toBe("2026-09-14");
  });
});
