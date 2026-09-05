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

function htmlToText(html: string): string {
  const withoutNonContent = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const withBreaks = withoutNonContent
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<(br|\/p|\/div|\/tr|\/h[1-6])\s*\/?>/gi, "\n");
  const stripped = withBreaks.replace(/<[^>]+>/g, " ");
  const decoded = stripped
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'");
  return decoded
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

// Some job boards embed the full posting as JSON-LD (schema.org JobPosting),
// which reads far cleaner than scraping the visible page markup when it's
// present, so prefer it before falling back to the rendered HTML.
function extractJsonLdDescription(html: string): string | null {
  const blocks = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const match of blocks) {
    try {
      const json = JSON.parse(match[1] ?? "") as unknown;
      const candidates = Array.isArray(json) ? json : [json];
      for (const entry of candidates) {
        const obj = entry as Record<string, unknown>;
        if (obj?.["@type"] === "JobPosting" && typeof obj["description"] === "string") {
          return htmlToText(obj["description"]);
        }
      }
    } catch {
      // Not valid JSON-LD, or not a JobPosting — fall through to HTML scraping.
    }
  }
  return null;
}

async function fetchJobDescriptionFromUrl(url: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; JobLandedBot/1.0; +https://github.com/H4keman2/joblanded)",
        Accept: "text/html",
      },
    });
  } catch {
    throw new Error("Could not reach that posting URL. Paste the description instead.");
  }
  if (!res.ok) {
    throw new Error(
      `Could not load that posting (HTTP ${res.status}). Paste the description instead.`,
    );
  }

  const html = await res.text();
  const text = extractJsonLdDescription(html) ?? htmlToText(html);

  if (text.length < 80) {
    throw new Error(
      "Could not read enough text from that page (some sites need JavaScript to show the posting). Paste the description instead.",
    );
  }
  return text.slice(0, 30000);
}

export const addJobInput = z
  .object({
    description: z.string().default(""),
    sourceUrl: z.string().url().optional().or(z.literal("")),
  })
  .refine((v) => v.description.trim().length >= 80 || !!v.sourceUrl, {
    message: "Paste the full job description (at least a paragraph), or provide a posting URL.",
    path: ["description"],
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
  const description =
    input.description.trim().length >= 80
      ? input.description
      : await fetchJobDescriptionFromUrl(input.sourceUrl!);

  const extracted = await callAI(
    `Extract job posting metadata. Return ONLY JSON:
{"title": string, "company": string | null, "location": string | null, "pay_min": number | null, "pay_max": number | null}
Pay values are annual USD numbers when stated, otherwise null. Never invent facts.`,
    description.slice(0, 30000),
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
      description,
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

    const [{ data: job, error: jobError }, { data: resume, error: resumeError }] =
      await Promise.all([
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
    if (!resume)
      throw new Error("Upload and parse your resume first, then come back to tailor it.");

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

// --- Role suggestions: score jobs (saved or fetched) against the parsed resume ---

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9+#. ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const strings = (v: unknown) =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 1)
    : [];

function titleWordsFrom(titles: string[]): Set<string> {
  return new Set(
    titles
      .flatMap((t) => norm(t).split(" "))
      .filter((w) => w.length > 2 && !["the", "and", "for", "senior", "lead"].includes(w)),
  );
}

// Word-boundary-aware "does haystack contain this token" check. A plain
// haystack.includes(token) lets short skills/keywords (e.g. "AI", "PM", "BI")
// false-positive match as substrings of ordinary words — "ai" inside
// "training", "maintain", "certain" — which was flooding recommendations
// (especially "any title" mode's much larger, unfiltered pool) with
// completely unrelated postings that just happened to contain those letters.
function containsToken(haystack: string, token: string): boolean {
  if (!token) return false;
  const isWordChar = (c: string | undefined) => !!c && /[a-z0-9]/.test(c);
  let idx = haystack.indexOf(token);
  while (idx !== -1) {
    if (!isWordChar(haystack[idx - 1]) && !isWordChar(haystack[idx + token.length])) return true;
    idx = haystack.indexOf(token, idx + 1);
  }
  return false;
}

// Shared skills/title overlap scorer: no AI call, so it's fast and free enough
// to run against every result of an external job search, not just the handful
// of postings a user has manually saved.
function scoreAgainstResume(
  haystackRaw: string,
  titleRaw: string,
  skills: string[],
  titleWords: Set<string>,
): { fit: number | null; matched: string[] } {
  if (!skills.length && !titleWords.size) return { fit: null, matched: [] };

  const haystack = norm(haystackRaw);
  const titleHay = norm(titleRaw);

  const matched = skills.filter((s) => containsToken(haystack, norm(s))).slice(0, 40);
  const skillScore = skills.length ? matched.length / skills.length : 0;

  const titleHits = [...titleWords].filter((w) => containsToken(titleHay, w)).length;
  const titleScore = titleWords.size ? titleHits / titleWords.size : 0;

  const fit = Math.max(0, Math.min(100, Math.round((skillScore * 0.6 + titleScore * 0.4) * 130)));
  return { fit, matched: matched.slice(0, 6) };
}

export const rankRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [{ data: jobs, error: jobsError }, { data: resume, error: resumeError }] =
      await Promise.all([
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
    const skills = strings(parsed["skills"]).concat(strings(parsed["keywords"]));
    const titles = strings(parsed["titles"]);
    const titleWords = titleWordsFrom(titles);

    return (jobs ?? []).map((j) => {
      const { fit, matched } = scoreAgainstResume(
        `${j.title} ${j.company ?? ""} ${j.description}`,
        j.title,
        skills,
        titleWords,
      );
      return { id: j.id, fit, matched };
    });
  });

// --- Recommendations: pull live postings from the Adzuna job search API and
// rank them against the resume. Requires ADZUNA_APP_ID / ADZUNA_APP_KEY —
// free at https://developer.adzuna.com — set as secrets in the Lovable
// project (not committed to .env). Crawling job boards directly isn't done
// here: it violates most boards' terms of service and breaks constantly
// against bot detection, so a proper aggregator API is used instead.

const RECOMMEND_RESULTS = 12;

const recommendInput = z.object({
  keyword: z.string().trim().max(200).optional(),
  // When true, ignore keyword entirely (both the caller's and the resume's
  // top title) and browse broadly by location/salary only, ranking purely
  // on fit score — for "don't make me pick a title, just show my best
  // matches" rather than searching one role at a time.
  anyTitle: z.boolean().optional(),
  location: z.string().trim().max(200).optional(),
  salaryMin: z.number().int().positive().max(10_000_000).optional(),
  salaryMax: z.number().int().positive().max(10_000_000).optional(),
});

interface AdzunaResult {
  id?: string;
  title?: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  salary_min?: number;
  salary_max?: number;
  description?: string;
  redirect_url?: string;
}

export const getRecommendedJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => recommendInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const appId = process.env["ADZUNA_APP_ID"];
    const appKey = process.env["ADZUNA_APP_KEY"];
    if (!appId || !appKey) {
      throw new Error(
        "Job recommendations aren't set up yet. Add ADZUNA_APP_ID and ADZUNA_APP_KEY (free at developer.adzuna.com) as secrets in your Lovable project, then reload this page.",
      );
    }

    const [{ data: resume, error: resumeError }, { data: savedJobs, error: savedError }] =
      await Promise.all([
        supabase
          .from("resumes")
          .select("parsed_json")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from("jobs").select("source_url").eq("user_id", userId),
      ]);
    if (resumeError) throw new Error(resumeError.message);
    if (savedError) throw new Error(savedError.message);

    const parsed = (resume?.parsed_json ?? {}) as Record<string, unknown>;
    const skills = strings(parsed["skills"]).concat(strings(parsed["keywords"]));
    const titles = strings(parsed["titles"]);
    const titleWords = titleWordsFrom(titles);
    const parsedLocation =
      typeof parsed["location"] === "string" ? (parsed["location"] as string) : "";

    const keyword = data.anyTitle ? "" : data.keyword || titles[0] || "";
    const location = data.location || parsedLocation;

    // Without a keyword, Adzuna's own relevance ranking has nothing to go
    // on, so pull a bigger, freshness-sorted pool and lean entirely on our
    // own fit score to pick the winners out of it.
    const pageSize = data.anyTitle ? RECOMMEND_RESULTS * 4 : RECOMMEND_RESULTS * 2;

    const params = new URLSearchParams({
      app_id: appId,
      app_key: appKey,
      "content-type": "application/json",
      results_per_page: String(pageSize), // fetch extra — some get filtered out as already-saved
    });
    if (keyword) params.set("what", keyword);
    if (!keyword) params.set("sort_by", "date");
    if (location) {
      params.set("where", location);
      params.set("distance", "50"); // km — "relatively close" rather than an exact city match only
    }
    if (data.salaryMin) params.set("salary_min", String(data.salaryMin));
    if (data.salaryMax) params.set("salary_max", String(data.salaryMax));

    let res: Response;
    try {
      res = await fetch(`https://api.adzuna.com/v1/api/jobs/us/search/1?${params.toString()}`);
    } catch {
      throw new Error("Could not reach the job search service. Try again in a moment.");
    }
    if (!res.ok) {
      console.error("Adzuna error", res.status, await res.text());
      throw new Error(
        res.status === 401
          ? "Job recommendations are misconfigured (Adzuna rejected the API credentials)."
          : "The job search service could not complete this request.",
      );
    }

    const payload = (await res.json()) as { results?: AdzunaResult[] };
    const savedUrls = new Set(
      (savedJobs ?? []).map((j) => j.source_url).filter((u): u is string => !!u),
    );

    // A soft bar for what counts as a strong "recommendation" rather than
    // noise. Preferred, but never enforced so hard that it can zero out the
    // whole panel — a search with no strong overlap should still surface its
    // best available matches (ranked honestly) rather than "No matches
    // found", so a hard floor is applied only when something actually clears
    // it further down.
    const MIN_FIT = 15;
    // Bonus weight for a posting that aligns with filters the user actually
    // set — otherwise adding a location or salary range only narrows which
    // postings get fetched, without ever showing up in the match itself.
    const FILTER_BONUS = 8;

    const scored = (payload.results ?? [])
      .filter((r) => r.redirect_url && !savedUrls.has(r.redirect_url))
      .map((r) => {
        const title = r.title?.trim() || "Untitled role";
        const company = r.company?.display_name?.trim() || null;
        const snippet = (r.description ?? "").trim();
        const jobLocation = r.location?.display_name?.trim() || null;
        const { fit: baseFit, matched } = scoreAgainstResume(
          `${title} ${company ?? ""} ${snippet}`,
          title,
          skills,
          titleWords,
        );

        const locationMatched = !!(
          location &&
          jobLocation &&
          (norm(jobLocation).includes(norm(location)) || norm(location).includes(norm(jobLocation)))
        );
        const jobMin = r.salary_min ?? r.salary_max;
        const jobMax = r.salary_max ?? r.salary_min;
        const salaryMatched =
          (!!data.salaryMin || !!data.salaryMax) &&
          typeof jobMin === "number" &&
          typeof jobMax === "number" &&
          jobMax >= (data.salaryMin ?? 0) &&
          jobMin <= (data.salaryMax ?? Number.MAX_SAFE_INTEGER);

        const bonus = (locationMatched ? FILTER_BONUS : 0) + (salaryMatched ? FILTER_BONUS : 0);
        const fit = baseFit === null ? bonus || null : Math.min(100, baseFit + bonus);

        const reasonParts: string[] = [];
        if (matched.length) reasonParts.push(`Overlaps on ${matched.slice(0, 3).join(", ")}`);
        else if (baseFit && baseFit > 0) reasonParts.push("Similar title to your resume");
        if (locationMatched) reasonParts.push("matches your location");
        if (salaryMatched) reasonParts.push("fits your salary range");
        const reason = reasonParts.length ? reasonParts.join(" · ") : "Based on your search";

        return {
          id: r.id ?? r.redirect_url!,
          title,
          company,
          location: jobLocation,
          salaryMin: typeof r.salary_min === "number" ? Math.round(r.salary_min) : null,
          salaryMax: typeof r.salary_max === "number" ? Math.round(r.salary_max) : null,
          snippet: snippet.slice(0, 220),
          url: r.redirect_url!,
          fit,
          reason,
        };
      })
      .sort((a, b) => (b.fit ?? -1) - (a.fit ?? -1));

    const strongMatches = scored.filter((job) => (job.fit ?? 0) >= MIN_FIT);
    return (strongMatches.length ? strongMatches : scored).slice(0, RECOMMEND_RESULTS);
  });
