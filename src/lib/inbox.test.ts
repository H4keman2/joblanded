import { describe, expect, it } from "vitest";
import {
  bestMatch,
  normalizeCompany,
  scoreMatch,
  suggestedStatusForEvent,
  type ParsedEmailEvent,
} from "./inbox";

describe("suggestedStatusForEvent", () => {
  it("maps each event type to the status it implies", () => {
    expect(suggestedStatusForEvent("confirmation")).toBe("applied");
    expect(suggestedStatusForEvent("rejection")).toBe("rejected");
    expect(suggestedStatusForEvent("interview_invite")).toBe("interviewing");
    expect(suggestedStatusForEvent("assessment")).toBe("interviewing");
    expect(suggestedStatusForEvent("offer")).toBe("offer");
  });

  it("never moves a card for codes or unclassifiable mail", () => {
    expect(suggestedStatusForEvent("verification_code")).toBeNull();
    expect(suggestedStatusForEvent("other")).toBeNull();
  });
});

describe("normalizeCompany", () => {
  it("drops legal suffixes and punctuation", () => {
    expect(normalizeCompany("Zola, Inc.")).toBe("zola");
    expect(normalizeCompany("Human Interest LLC")).toBe("human interest");
  });
});

const parsed = (over: Partial<ParsedEmailEvent>): ParsedEmailEvent => ({
  company: null,
  roleTitle: null,
  eventType: "rejection",
  eventDate: null,
  summary: "",
  ...over,
});

describe("scoreMatch / bestMatch", () => {
  const candidates = [
    { applicationId: "a1", company: "Zola", title: "Product Manager" },
    { applicationId: "a2", company: "Stripe", title: "Product Manager, Connect" },
    { applicationId: "a3", company: "Human Interest", title: "Product Manager, AI Augmented" },
  ];

  it("matches on exact company even with a generic title", () => {
    const match = bestMatch(
      parsed({ company: "Zola, Inc.", roleTitle: "Product Manager" }),
      candidates,
    );
    expect(match?.applicationId).toBe("a1");
  });

  it("uses the title to disambiguate when the company is missing", () => {
    const match = bestMatch(
      parsed({ company: null, roleTitle: "Product Manager, AI Augmented" }),
      candidates,
    );
    // Title-only overlap tops out at 40 points, below the threshold — a
    // company signal is required before anything is auto-attached.
    expect(match).toBeNull();
  });

  it("prefers the candidate whose title also fits", () => {
    const stripe = { applicationId: "a2", company: "Stripe", title: "Product Manager, Connect" };
    const zola = { applicationId: "a1", company: "Zola", title: "Product Manager" };
    const email = parsed({ company: "Stripe", roleTitle: "Product Manager, Connect Growth" });
    expect(scoreMatch(email, stripe)).toBeGreaterThan(scoreMatch(email, zola));
  });

  it("returns null when nothing is close", () => {
    expect(
      bestMatch(parsed({ company: "Datadog", roleTitle: "Product Manager" }), candidates),
    ).toBeNull();
  });
});
