import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const MODEL = "google/gemini-3.5-flash";
const MAX_POSTINGS = 8;

const matchInput = z.object({
  text: z.string().trim().min(80, "Paste at least one full job posting."),
});

export interface SectionMatch {
  section: string;
  score: number;
  evidence: string[];
  gap: string | null;
}

export interface PostingMatch {
  index: number;
  title: string;
  company: string | null;
  overall: number;
  sections: SectionMatch[];
}

function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()) : [];
}

// Postings are pasted one after another; a line of three or more dashes is the
// documented separator, with a blank-line fallback for very short pastes.
export function splitPostings(text: string): string[] {
  const parts = text
    .split(/^\s*-{3,}\s*$/m)
    .map((p) => p.trim())
    .filter((p) => p.length >= 60);
  if (parts.length > 1) return parts.slice(0, MAX_POSTINGS);
  return text
    .split(/\n\s*\n\s*\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 60)
    .slice(0, MAX_POSTINGS);
}

function buildSections(parsed: Record<string, unknown>, rawText: string) {
  const sections: { name: string; content: string }[] = [];
  const summary = typeof parsed["summary"] === "string" ? parsed["summary"] : "";
  if (summary.trim()) sections.push({ name: "Summary", content: summary });

  const skills = strings(parsed["skills"]).concat(strings(parsed["keywords"]));
  if (skills.length) sections.push({ name: "Skills", content: [...new Set(skills)].join(", ") });

  const titles = strings(parsed["titles"]);
  if (titles.length) sections.push({ name: "Experience & titles", content: titles.join("\n") });

  const achievements = strings(parsed["achievements"]);
  if (achievements.length)
    sections.push({ name: "Achievements", content: achievements.join("\n") });

  const education = Array.isArray(parsed["education"])
    ? (parsed["education"] as Record<string, unknown>[])
        .map((e) => [e["degree"], e["school"], e["year"]].filter(Boolean).join(" · "))
        .filter(Boolean)
    : [];
  if (education.length) sections.push({ name: "Education", content: education.join("\n") });

  if (!sections.length) sections.push({ name: "Resume", content: rawText.slice(0, 6000) });
  return sections;
}

export const matchPostings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => matchInput.parse(input))
  .handler(async ({ data, context }) => {
    const postings = splitPostings(data.text);
    if (!postings.length) throw new Error("Could not read any postings from that text.");

    const { data: resume, error } = await context.supabase
      .from("resumes")
      .select("raw_text, parsed_json")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!resume) throw new Error("Upload your resume first, then search postings.");

    const sections = buildSections(
      (resume.parsed_json ?? {}) as Record<string, unknown>,
      resume.raw_text,
    );

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured");

    const system = `You compare a candidate's resume, section by section, against several job postings.
Score how well EACH resume section supports EACH posting (0-100). Never invent facts.
Return ONLY JSON:
{"postings":[{"index": number, "title": string, "company": string | null, "overall": number,
"sections":[{"section": string, "score": number, "evidence": string[], "gap": string | null}]}]}
"index" is the posting's zero-based order as given. "section" must exactly match a provided
section name, and every posting must include every section. "evidence" holds up to 3 short
phrases quoted or paraphrased from that resume section that the posting asks for.
"gap" is one short phrase the posting wants but the section lacks, or null.`;

    const user = `RESUME SECTIONS:
${sections.map((s) => `### ${s.name}\n${s.content.slice(0, 4000)}`).join("\n\n")}

JOB POSTINGS:
${postings.map((p, i) => `### POSTING ${i}\n${p.slice(0, 6000)}`).join("\n\n")}`;

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
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(payload.choices?.[0]?.message?.content ?? "{}") as Record<string, unknown>;
    } catch {
      throw new Error("The AI returned an unexpected response. Please try again.");
    }

    const clamp = (v: unknown) =>
      typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : 0;

    const rows = Array.isArray(parsed["postings"]) ? (parsed["postings"] as unknown[]) : [];
    const results: PostingMatch[] = rows.slice(0, MAX_POSTINGS).map((row, i) => {
      const r = (row ?? {}) as Record<string, unknown>;
      const idx = typeof r["index"] === "number" ? r["index"] : i;
      const secRows = Array.isArray(r["sections"]) ? (r["sections"] as unknown[]) : [];
      const byName = new Map<string, SectionMatch>();
      for (const s of secRows) {
        const sr = (s ?? {}) as Record<string, unknown>;
        const name = typeof sr["section"] === "string" ? sr["section"] : "";
        if (!name) continue;
        byName.set(name, {
          section: name,
          score: clamp(sr["score"]),
          evidence: strings(sr["evidence"]).slice(0, 3),
          gap: typeof sr["gap"] === "string" && sr["gap"].trim() ? sr["gap"].trim() : null,
        });
      }
      const orderedSections = sections.map(
        (s) =>
          byName.get(s.name) ?? { section: s.name, score: 0, evidence: [], gap: null },
      );
      const overall =
        typeof r["overall"] === "number"
          ? clamp(r["overall"])
          : Math.round(
              orderedSections.reduce((a, s) => a + s.score, 0) / (orderedSections.length || 1),
            );
      return {
        index: idx,
        title: typeof r["title"] === "string" && r["title"].trim() ? r["title"].trim() : `Posting ${idx + 1}`,
        company: typeof r["company"] === "string" && r["company"].trim() ? r["company"].trim() : null,
        overall,
        sections: orderedSections,
      };
    });

    return {
      sections: sections.map((s) => s.name),
      postings: results,
      count: postings.length,
    };
  });
