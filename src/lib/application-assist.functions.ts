import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { callAI } from "@/lib/ai";

const prepInput = z.object({
  jobId: z.string().uuid(),
  licenseKey: z.string(),
});

const PREP_PROMPT = `You are an interview coach for product management roles. Given the job posting and the candidate's background, generate the most likely interview questions. Return ONLY valid JSON with this exact shape:
{
  "questions": [
    {
      "question": "the likely question",
      "why": "what the interviewer is really testing",
      "angle": "how THIS candidate should answer, referencing their actual experience"
    }
  ],
  "tips": ["2-3 practical tips for this specific interview"]
}
Rules:
- 6 to 8 questions: a mix of behavioral, product sense, and role-specific questions tied to the posting.
- Reference the candidate's real experience in every angle. Do not invent experience they don't have.`;

type PrepResult = {
  questions: { question: string; why: string; angle: string }[];
  tips: string[];
};

/**
 * Pro-only interview prep: likely questions for one of the user's saved
 * postings, each with what the interviewer is testing and how this
 * candidate should answer from their real background.
 */
export const getInterviewPrep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => prepInput.parse(input))
  .handler(async ({ data, context }) => {
    const { requireValidLicense } = await import("@/lib/license.server");
    await requireValidLicense(data.licenseKey);
    const { supabase, userId } = context;

    const [{ data: job, error: jobError }, { data: resume, error: resumeError }] =
      await Promise.all([
        supabase
          .from("jobs")
          .select("title, company, description")
          .eq("id", data.jobId)
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("resumes")
          .select("parsed_json")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
    if (jobError) throw new Error(jobError.message);
    if (resumeError) throw new Error(resumeError.message);
    if (!job) throw new Error("Posting not found");

    const parsed = (resume?.parsed_json ?? {}) as Record<string, unknown>;
    const background = JSON.stringify({
      summary: parsed["summary"] ?? null,
      titles: parsed["titles"] ?? [],
      skills: parsed["skills"] ?? [],
      achievements: parsed["achievements"] ?? [],
      years_experience: parsed["years_experience"] ?? null,
    }).slice(0, 6000);

    const user =
      `Job posting — ${job.title}${job.company ? ` at ${job.company}` : ""}:\n---\n${(job.description ?? "").slice(0, 12000)}\n---\n\n` +
      `Candidate background (JSON):\n${background}`;

    const prep = await callAI(supabase, userId, PREP_PROMPT, user, {
      bucket: "interview-prep",
      limit: 10,
      windowMinutes: 60,
    });
    return { jobTitle: job.title, company: job.company, ...(prep as object) } as PrepResult & {
      jobTitle: string;
      company: string | null;
    };
  });

const offerInput = z.object({
  jobId: z.string().uuid(),
  licenseKey: z.string(),
  base: z.number().int().positive().max(10_000_000),
  bonus: z.string().trim().max(200).optional(),
  equity: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
});

const OFFER_PROMPT = `You are a compensation negotiation advisor. Evaluate this job offer and be direct. Return ONLY valid JSON with this exact shape:
{
  "verdict": "below",
  "verdictSummary": "1-2 sentences",
  "rangeComparison": "how the offer compares to the posted range (or why no comparison is possible)",
  "negotiate": true,
  "negotiateWhy": "1-2 sentences",
  "counterAsk": 165000,
  "script": "2-3 natural sentences the candidate can actually say on the call",
  "watchouts": ["things to verify before signing"]
}
Rules:
- "verdict" is one of "below", "inline", "above" relative to the posted range and the role/level/location.
- If the offer is below the posted range or looks soft for the market, say to negotiate and name a specific counter number.
- "counterAsk" is a base-salary number or null when negotiating makes no sense.
- Keep the script natural, not stiff. 2-4 watchouts max.`;

type OfferResult = {
  verdict: "below" | "inline" | "above";
  verdictSummary: string;
  rangeComparison: string;
  negotiate: boolean;
  negotiateWhy: string;
  counterAsk: number | null;
  script: string;
  watchouts: string[];
};

/**
 * Pro-only offer check: is the offer in line with the posting's range, and
 * should the candidate push for more — with a counter number and a script.
 */
export const getOfferCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => offerInput.parse(input))
  .handler(async ({ data, context }) => {
    const { requireValidLicense } = await import("@/lib/license.server");
    await requireValidLicense(data.licenseKey);
    const { supabase, userId } = context;

    const [{ data: job, error: jobError }, { data: resume, error: resumeError }] =
      await Promise.all([
        supabase
          .from("jobs")
          .select("title, company, location, pay_min, pay_max")
          .eq("id", data.jobId)
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("resumes")
          .select("parsed_json")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
    if (jobError) throw new Error(jobError.message);
    if (resumeError) throw new Error(resumeError.message);
    if (!job) throw new Error("Posting not found");

    const parsed = (resume?.parsed_json ?? {}) as Record<string, unknown>;
    const user =
      `Posting: ${job.title}${job.company ? ` at ${job.company}` : ""}${job.location ? ` (${job.location})` : ""}\n` +
      `Posted pay range: ${job.pay_min ? `$${job.pay_min.toLocaleString()}` : "?"} – ${job.pay_max ? `$${job.pay_max.toLocaleString()}` : "?"}\n` +
      `Offer: base $${data.base.toLocaleString()}/yr` +
      (data.bonus ? `, bonus: ${data.bonus}` : "") +
      (data.equity ? `, equity: ${data.equity}` : "") +
      (data.notes ? `\nCandidate notes: ${data.notes}` : "") +
      `\nCandidate: ${parsed["years_experience"] ?? "?"} years experience; titles: ${JSON.stringify(parsed["titles"] ?? []).slice(0, 500)}`;

    const result = await callAI(supabase, userId, OFFER_PROMPT, user, {
      bucket: "offer-check",
      limit: 10,
      windowMinutes: 60,
    });
    return {
      jobTitle: job.title,
      company: job.company,
      payMin: job.pay_min,
      payMax: job.pay_max,
      offerBase: data.base,
      ...(result as object),
    } as OfferResult & {
      jobTitle: string;
      company: string | null;
      payMin: number | null;
      payMax: number | null;
      offerBase: number;
    };
  });
