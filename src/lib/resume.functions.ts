import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { callAI } from "@/lib/ai";

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
    const { supabase, userId } = context;

    const parsed = await callAI(supabase, userId, PARSE_PROMPT, data.rawText.slice(0, 40000), {
      bucket: "parse-resume",
      limit: 15,
      windowMinutes: 60,
    });

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
