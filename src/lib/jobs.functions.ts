import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";

const MODEL = "google/gemini-3.5-flash";

async function callAI(system: string, user: string) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (res.status === 429) throw new Error("Too many requests, please try again in a moment.");
  if (res.status === 402) throw new Error("AI credits exhausted. Please top up to continue.");
  if (!res.ok) {
    console.error("AI gateway error", res.status, await res.text());
    throw new Error("The AI service could not complete this request.");
  }

  const payload = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = payload.choices?.[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    throw new Error("The AI returned an unexpected response. Please try again.");
  }
}

export const listJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("jobs")
      .select("id, title, company, location, pay_min, pay_max, source_url, date_added")
      .eq("user_id", context.userId)
      .order("date_added", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getJob = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: job, error } = await context.supabase
      .from("jobs")
      .select("id, title, company, location, pay_min, pay_max, source_url, description, date_added")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!job) throw new Error("Job not found");
    return job;
  });

const addJobInput = z.object({
  description: z.string().min(80, "Paste the full job description (at least a paragraph)."),
  sourceUrl: z.string().url().optional().or(z.literal("")),
});

// Shared by the Jobs page (addJob) and the Applications page (add-application flow):
// extracts metadata from a pasted posting, saves the job, and automatically opens
// an application for it (status "saved") so every saved job shows up on the
// Applications page immediately, without a second manual step.
export async function createJobForUser(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: { description: string; sourceUrl?: string | undefined },
) {
  const extracted = await callAI(
    `Extract job posting metadata. Return ONLY JSON:
{"title": string, "company": string | null, "location": string | null, "pay_min": number | null, "pay_max": number | null}
Pay values are annual USD numbers when stated, otherwise null. Never invent facts.`,
    input.description.slice(0, 30000),
  );

  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : null);

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .insert({
      user_id: userId,
      title: str(extracted["title"]) ?? "Untitled role",
      company: str(extracted["company"]),
      location: str(extracted["location"]),
      pay_min: num(extracted["pay_min"]),
      pay_max: num(extracted["pay_max"]),
      source_url: input.sourceUrl || null,
      description: input.description,
    })
    .select("id, title, company, location, pay_min, pay_max, source_url, date_added")
    .single();
  if (jobError) throw new Error(jobError.message);

  const { error: appError } = await supabase
    .from("applications")
    .insert({ user_id: userId, job_id: job.id, status: "saved" });
  if (appError) throw new Error(appError.message);

  return job;
}

export const addJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => addJobInput.parse(input))
  .handler(async ({ data, context }) => createJobForUser(context.supabase, context.userId, data));

export const deleteJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("jobs")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listDrafts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ jobId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("tailored_documents")
      .select("id, content, created_at")
      .eq("user_id", context.userId)
      .eq("job_id", data.jobId)
      .eq("type", "tailor_version")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      id: r.id,
      created_at: r.created_at,
      content: r.content,
    }));
  });

const DRAFT_SHAPE = `Return ONLY valid JSON with this exact shape:
{
  "angle": string,               // 3-4 word name for the framing, e.g. "Systems & scale"
  "match": {
    "score": number,             // 0-100 overall fit between this candidate and this specific posting
    "note": string                // 1 sentence explaining the score
  },
  "resume": string,              // THE FULL REWRITTEN RESUME as plain text, ready to send. Include every
                                  // section the original resume has (contact line, summary, skills,
                                  // work experience with bullet points, education, certifications, etc.),
                                  // rewritten and reordered to best fit this posting. Use "\\n" for line
                                  // breaks and plain-text section headers (e.g. "EXPERIENCE"). Do not
                                  // truncate or summarize sections, this must be a complete, ready-to-send
                                  // resume the candidate could copy and use as-is.
  "summary": string,             // rewritten 2-3 sentence resume summary, only facts present in the resume
                                  // (this should also be the summary/objective section inside "resume")
  "cover": string,               // 2-3 sentence cover letter opener addressed to this company
  "why": string,                 // 1-2 sentences explaining why this framing was chosen
  "insights": {
    "strengths": string[],       // 3-5 concrete ways this resume already matches what the posting wants
    "gaps": string[],            // 2-4 things the posting wants that are missing or underrepresented
    "suggestions": string[]      // 2-4 concrete, actionable edits to close the gaps (no invented facts)
  },
  "ats": {
    "score": number,             // 0-100 readability/parseability of this text for an ATS
    "note": string,
    "flags": string[]            // 3-5 short parse-friendliness observations
  },
  "keywords": {
    "score": number,             // 0-100 coverage of the posting's important keywords
    "note": string,
    "hits": string[],            // posting keywords present in this draft
    "misses": string[]           // posting keywords absent from this draft
  }
}
Never invent experience, employers, metrics or skills that are not in the resume.`;

const generateInput = z.object({
  jobId: z.string().uuid(),
  optimizeFromId: z.string().uuid().optional(),
});

export const generateDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => generateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const [{ data: job, error: jobError }, { data: resume, error: resumeError }] = await Promise.all([
      supabase
        .from("jobs")
        .select("id, title, company, description")
        .eq("id", data.jobId)
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("resumes")
        .select("id, raw_text, parsed_json")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (jobError) throw new Error(jobError.message);
    if (resumeError) throw new Error(resumeError.message);
    if (!job) throw new Error("Job not found");
    if (!resume) throw new Error("Upload and parse your resume first, then come back to tailor it.");

    const { data: existing, error: existingError } = await supabase
      .from("tailored_documents")
      .select("id, content")
      .eq("user_id", userId)
      .eq("job_id", data.jobId)
      .eq("type", "tailor_version")
      .order("created_at", { ascending: true });
    if (existingError) throw new Error(existingError.message);

    const previousAngles = (existing ?? [])
      .map((r) => {
        try {
          return (JSON.parse(r.content) as { angle?: string }).angle ?? "";
        } catch {
          return "";
        }
      })
      .filter(Boolean);

    const optimizeSource = data.optimizeFromId
      ? (existing ?? []).find((r) => r.id === data.optimizeFromId)
      : undefined;

    const system = optimizeSource
      ? `You are an ATS optimization editor. You are given a resume, a job posting, and an existing tailored draft
(including its full rewritten resume text).
Rewrite the full resume so it fixes its weakest readability flags and works its missing keywords back in naturally,
keeping the same angle, evidence and section order. Recompute the match score and insights for the new version.
Prefix the "angle" with "ATS-optimized · ".
${DRAFT_SHAPE}`
      : `You are an expert resume writer and career coach.
Write ONE tailored, complete resume for this candidate and job posting, using a distinct framing angle: reorder and
re-emphasize sections, rewrite bullet points around this posting's language, and surface the most relevant
experience first. Then score how well the result matches the posting and explain the comparison.
${previousAngles.length ? `Angles already produced (choose a genuinely different one): ${previousAngles.join("; ")}.` : ""}
${DRAFT_SHAPE}`;

    const user = [
      `JOB TITLE: ${job.title}`,
      `COMPANY: ${job.company ?? "Unknown"}`,
      `JOB POSTING:\n${job.description.slice(0, 20000)}`,
      `RESUME:\n${resume.raw_text.slice(0, 20000)}`,
      optimizeSource ? `EXISTING DRAFT TO OPTIMIZE:\n${optimizeSource.content}` : "",
    ]
      .filter(Boolean)
      .join("\n\n---\n\n");

    const draft = await callAI(system, user);

    const { data: row, error } = await supabase
      .from("tailored_documents")
      .insert({
        user_id: userId,
        job_id: job.id,
        resume_id: resume.id,
        type: "tailor_version",
        content: JSON.stringify(draft),
      })
      .select("id, content, created_at")
      .single();
    if (error) throw new Error(error.message);

    return { id: row.id, created_at: row.created_at, content: row.content };
  });

export const deleteDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("tailored_documents")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// --- Role suggestions: score saved roles against the parsed resume ---

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9+#. ]/g, " ").replace(/\s+/g, " ").trim();

export const rankRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [{ data: jobs, error: jobsError }, { data: resume, error: resumeError }] = await Promise.all([
      supabase
        .from("jobs")
        .select("id, title, company, description")
        .eq("user_id", userId)
        .order("date_added", { ascending: false }),
      supabase
        .from("resumes")
        .select("parsed_json")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (jobsError) throw new Error(jobsError.message);
    if (resumeError) throw new Error(resumeError.message);

    const parsed = (resume?.parsed_json ?? {}) as Record<string, unknown>;
    const strings = (v: unknown) =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 1) : [];
    const skills = strings(parsed["skills"]).concat(strings(parsed["keywords"]));
    const titles = strings(parsed["titles"]);

    if (!skills.length && !titles.length) {
      return (jobs ?? []).map((j) => ({ id: j.id, fit: null as number | null, matched: [] as string[] }));
    }

    const titleWords = new Set(
      titles.flatMap((t) => norm(t).split(" ")).filter((w) => w.length > 2 && !["the", "and", "for", "senior", "lead"].includes(w)),
    );

    return (jobs ?? []).map((j) => {
      const haystack = norm(`${j.title} ${j.company ?? ""} ${j.description}`);
      const titleHay = norm(j.title);

      const matched = skills.filter((s) => haystack.includes(norm(s))).slice(0, 40);
      const skillScore = skills.length ? matched.length / skills.length : 0;

      const titleHits = [...titleWords].filter((w) => titleHay.includes(w)).length;
      const titleScore = titleWords.size ? titleHits / titleWords.size : 0;

      const fit = Math.max(0, Math.min(100, Math.round((skillScore * 0.6 + titleScore * 0.4) * 130)));
      return { id: j.id, fit, matched: matched.slice(0, 6) };
    });
  });
