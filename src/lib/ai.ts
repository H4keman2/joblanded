import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { enforceRateLimit } from "@/lib/rate-limit";

const MODEL = "google/gemini-3.5-flash";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export interface AiRateLimit {
  /** Distinguishes this call site's quota from every other bucket. */
  bucket: string;
  limit: number;
  windowMinutes: number;
}

/**
 * Calls the Lovable AI gateway, after first enforcing a per-user rate limit.
 *
 * This used to be copy-pasted (model name, 429/402 handling, JSON parsing,
 * and all) into jobs.functions.ts, resume.functions.ts and
 * postings.functions.ts, with no rate limiting at all — every one of those
 * endpoints ran against one project-billed API key with no per-user cap, so
 * a single account looping calls could run up the bill or exhaust the
 * shared quota for everyone else. Centralizing it here means the limit only
 * needs to be added, audited, or changed in one place.
 */
export async function callAI(
  supabase: SupabaseClient<Database>,
  userId: string,
  system: string,
  user: string,
  rateLimit: AiRateLimit,
): Promise<Record<string, unknown>> {
  await enforceRateLimit(supabase, userId, rateLimit.bucket, rateLimit);

  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured");

  const res = await fetch(GATEWAY_URL, {
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
