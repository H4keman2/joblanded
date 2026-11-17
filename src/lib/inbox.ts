import type { ApplicationStatus } from "./applications.functions";

// The kinds of thing an application email can tell the tracker. Parsed from
// pasted email text by the AI in inbox.functions.ts; everything downstream
// (labels, status suggestions, matching) is deterministic and lives here so
// it can be unit-tested without a model call.
export const APPLICATION_EVENT_TYPES = [
  "confirmation",
  "rejection",
  "interview_invite",
  "assessment",
  "offer",
  "verification_code",
  "other",
] as const;
export type ApplicationEventType = (typeof APPLICATION_EVENT_TYPES)[number];

export const EVENT_LABELS: Record<ApplicationEventType, string> = {
  confirmation: "Application confirmation",
  rejection: "Rejection",
  interview_invite: "Interview invite",
  assessment: "Assessment",
  offer: "Offer",
  verification_code: "Verification code",
  other: "Update",
};

// Which tracker status an event implies, if any. A confirmation means the
// application really was submitted; a rejection or an offer is terminal-ish;
// invites and assessments both mean the process is live. Verification codes
// and unclassifiable mail carry no status signal, so they never move a card.
export function suggestedStatusForEvent(eventType: ApplicationEventType): ApplicationStatus | null {
  switch (eventType) {
    case "confirmation":
      return "applied";
    case "rejection":
      return "rejected";
    case "interview_invite":
    case "assessment":
      return "interviewing";
    case "offer":
      return "offer";
    default:
      return null;
  }
}

export type ParsedEmailEvent = {
  company: string | null;
  roleTitle: string | null;
  eventType: ApplicationEventType;
  eventDate: string | null;
  summary: string;
};

export type MatchCandidate = {
  applicationId: string;
  company: string | null;
  title: string | null;
};

const COMPANY_SUFFIXES = new Set([
  "inc",
  "llc",
  "ltd",
  "corp",
  "corporation",
  "company",
  "co",
  "gmbh",
  "plc",
  "group",
]);

export function normalizeCompany(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0 && !COMPANY_SUFFIXES.has(w))
    .join(" ")
    .trim();
}

function significantTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
}

function tokenOverlapRatio(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared++;
  return shared / Math.min(a.size, b.size);
}

// Scores how likely a parsed email belongs to a tracked application.
// Company identity dominates (60 pts): exact normalized match, containment,
// or strong token overlap. Title overlap adds up to 40. A bare title match
// with no company signal can never reach the confidence threshold on its
// own — "Product Manager" matches half the tracker.
export function scoreMatch(parsed: ParsedEmailEvent, candidate: MatchCandidate): number {
  let score = 0;
  if (parsed.company && candidate.company) {
    const a = normalizeCompany(parsed.company);
    const b = normalizeCompany(candidate.company);
    if (a.length > 0 && b.length > 0) {
      if (a === b) score += 60;
      else if (a.includes(b) || b.includes(a)) score += 45;
      else if (tokenOverlapRatio(significantTokens(a), significantTokens(b)) >= 0.5) score += 30;
    }
  }
  if (parsed.roleTitle && candidate.title) {
    score += Math.round(
      tokenOverlapRatio(significantTokens(parsed.roleTitle), significantTokens(candidate.title)) *
        40,
    );
  }
  return score;
}

export const MATCH_THRESHOLD = 55;

export function bestMatch(
  parsed: ParsedEmailEvent,
  candidates: MatchCandidate[],
): { applicationId: string; score: number } | null {
  let best: { applicationId: string; score: number } | null = null;
  for (const candidate of candidates) {
    const score = scoreMatch(parsed, candidate);
    if (score >= MATCH_THRESHOLD && (!best || score > best.score)) {
      best = { applicationId: candidate.applicationId, score };
    }
  }
  return best;
}
