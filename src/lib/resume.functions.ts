import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const parseInput = z.object({
  rawText: z.string().min(30, "Resume text is too short"),
  fileUrl: z.string().optional(),
});

const PARSE_PROMPT = `You are a resume parser. Extract structured data from the resume text.
Return ONLY valid JSON matching this shape:
{
  "full_name": string | null,
  "email": string | null,
  "phone": string | null,
  "location": string | null,   // candidate's city and state/region as written on the resume,
                                 // e.g. "Smithtown, NY" — used to find nearby job postings.
                                 // null if no location is stated.
  "skills": string[],
  "titles": string[],
  "years_experience": number | null,
  "education": [{ "school": string, "degree": string, "year": string | null }],
  "achievements": string[],
  "keywords": string[],
  "summary": string
}
Do not invent facts. Use [] or null when unknown.`;

export const parseResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => parseInput.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.5-flash",
        messages: [
          { role: "system", content: PARSE_PROMPT },
          { role: "user", content: data.rawText.slice(0, 40000) },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 429) throw new Error("Too many requests, please try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Please top up to continue.");
    if (!res.ok) {
      console.error("AI gateway error", res.status, await res.text());
      throw new Error("Could not parse the resume right now.");
    }

    const payload = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = payload.choices?.[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content) as Record<string, unknown>;
    } catch {
      throw new Error("The AI returned an unexpected response. Please try again.");
    }

    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("resumes")
      .insert({
        user_id: userId,
        raw_text: data.rawText,
        parsed_json: parsed as never,
        file_url: data.fileUrl ?? null,
      })
      .select("id, raw_text, parsed_json, file_url, created_at")
      .single();

    if (error) throw new Error(error.message);
    return row;
  });

export const getLatestResume = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("resumes")
      .select("id, raw_text, parsed_json, file_url, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

const saveInput = z.object({
  id: z.string().uuid(),
  parsed: z.record(z.unknown()),
});

export const saveParsedResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => saveInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("resumes")
      .update({ parsed_json: data.parsed as never })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
