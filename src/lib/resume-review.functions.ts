import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { callAI } from "@/lib/ai";

const reviewInput = z.object({
  resumeId: z.string().uuid(),
  licenseKey: z.string(),
});

type ReviewResult = {
  skillGroups: { label: string; skills: string[] }[];
  metrics: string[];
  senioritySignals: string[];
  atsScore: number;
  atsNotes: string[];
  suggestions: { priority: string; area: string; issue: string; fix: string }[];
  suggestedSummary: string | null;
};

const REVIEW_PROMPT = `You are an expert resume reviewer for product management roles. Analyze the resume below and return ONLY valid JSON with this exact shape:
{
  "skillGroups": [
    {"label": "Technical", "skills": ["..."]},
    {"label": "Tools & Platforms", "skills": ["..."]},
    {"label": "Leadership & Collaboration", "skills": ["..."]},
    {"label": "Domain Knowledge", "skills": ["..."]}
  ],
  "metrics": ["quantified achievements pulled from the resume, e.g. '$1B downstream revenue enabled'"],
  "senioritySignals": ["signals of seniority and scope, e.g. 'Led 2-year 0-to-1 product launch'"],
  "atsScore": 0,
  "atsNotes": ["short notes explaining the score"],
  "suggestions": [
    {"priority": "high", "area": "Summary", "issue": "what is weak, referencing their actual content", "fix": "concrete 1-2 sentence rewrite guidance"}
  ],
  "suggestedSummary": "a stronger 2-3 sentence professional summary, or null if the current one is already strong"
}
Rules:
- atsScore is 0-100 for ATS parsing-friendliness: clear headings, standard section titles, keyword richness, no dependence on tables or graphics.
- 4 to 7 suggestions, ordered by priority ("high", "medium" or "low"). Be specific and reference their actual content.
- Put every extracted skill into exactly one group. Omit groups that end up empty.
- Do not invent facts. Use null or [] when unknown.`;

/**
 * Pro-only deep resume review: color-coded skill extraction, quantified
 * metrics, seniority signals, an ATS score and prioritized improvements.
 */
export const getResumeReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => reviewInput.parse(input))
  .handler(async ({ data, context }) => {
    const { requireValidLicense } = await import("@/lib/license.server");
    await requireValidLicense(data.licenseKey);
    const { supabase, userId } = context;

    const { data: resume, error } = await supabase
      .from("resumes")
      .select("raw_text, parsed_json")
      .eq("id", data.resumeId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!resume) throw new Error("Resume not found");

    const user = `Resume text:\n---\n${(resume.raw_text ?? "").slice(0, 20000)}\n---\n\nCurrent structured profile (JSON):\n${JSON.stringify(resume.parsed_json ?? {}).slice(0, 8000)}`;

    const review = await callAI(supabase, userId, REVIEW_PROMPT, user, {
      bucket: "resume-review",
      limit: 10,
      windowMinutes: 60,
    });
    return review as unknown as ReviewResult;
  });

const previewInput = z.object({
  resumeId: z.string().uuid(),
  jobId: z.string().uuid(),
  licenseKey: z.string(),
});

type PreviewResult = {
  jobTitle: string;
  company: string | null;
  examples: { original: string; tailored: string; addedKeywords: string[] }[];
  matchNote: string;
};

const PREVIEW_PROMPT = `You are a resume tailoring expert. Given the candidate's highlights and a job posting, show 3 concrete before/after examples of how the resume should be reframed for this posting. Return ONLY valid JSON with this exact shape:
{
  "examples": [
    {
      "original": "a real line from their resume (summary line or achievement)",
      "tailored": "rewritten for this posting — same facts, reframed",
      "addedKeywords": ["keywords from the posting woven into the rewrite"]
    }
  ],
  "matchNote": "1-2 sentences on how well they fit and the single biggest gap to address"
}
Rules:
- Exactly 3 examples. "original" must be a genuine line from their resume below.
- "tailored" keeps every fact true; it reframes wording and emphasis for the posting.
- Do not invent experience the candidate does not have.`;

/**
 * Pro-only tailoring showcase: before/after rewrites of the candidate's own
 * lines for one of their saved postings, so the value of Pro tailoring is
 * concrete instead of abstract.
 */
export const getTailoringPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => previewInput.parse(input))
  .handler(async ({ data, context }) => {
    const { requireValidLicense } = await import("@/lib/license.server");
    await requireValidLicense(data.licenseKey);
    const { supabase, userId } = context;

    const [{ data: resume, error: resumeError }, { data: job, error: jobError }] =
      await Promise.all([
        supabase
          .from("resumes")
          .select("raw_text, parsed_json")
          .eq("id", data.resumeId)
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("jobs")
          .select("title, company, description")
          .eq("id", data.jobId)
          .eq("user_id", userId)
          .maybeSingle(),
      ]);
    if (resumeError) throw new Error(resumeError.message);
    if (jobError) throw new Error(jobError.message);
    if (!resume) throw new Error("Resume not found");
    if (!job) throw new Error("Posting not found");

    const parsed = (resume.parsed_json ?? {}) as Record<string, unknown>;
    const highlights = JSON.stringify({
      summary: parsed["summary"] ?? null,
      titles: parsed["titles"] ?? [],
      skills: parsed["skills"] ?? [],
      achievements: parsed["achievements"] ?? [],
      years_experience: parsed["years_experience"] ?? null,
    }).slice(0, 6000);

    const user =
      `Candidate highlights (JSON):\n${highlights}\n\n` +
      `Resume text (may be truncated):\n---\n${(resume.raw_text ?? "").slice(0, 12000)}\n---\n\n` +
      `Job posting — ${job.title}${job.company ? ` at ${job.company}` : ""}:\n---\n${(job.description ?? "").slice(0, 12000)}\n---`;

    const preview = await callAI(supabase, userId, PREVIEW_PROMPT, user, {
      bucket: "tailoring-preview",
      limit: 10,
      windowMinutes: 60,
    });
    return { jobTitle: job.title, company: job.company, ...preview } as unknown as PreviewResult;
  });
