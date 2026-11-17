import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { callAI } from "@/lib/ai";
import { addBusinessDays } from "@/lib/applications.functions";
import {
  APPLICATION_EVENT_TYPES,
  bestMatch,
  suggestedStatusForEvent,
  type ApplicationEventType,
  type ParsedEmailEvent,
} from "@/lib/inbox";

const PARSE_PROMPT = `You read one email from a job application process and extract what happened. Return ONLY valid JSON with this exact shape:
{
  "company": "the employer the candidate applied to (NOT the sending platform — an email from Greenhouse or Workday about a role at Stripe means company is Stripe)",
  "roleTitle": "the role title the email refers to, or null",
  "eventType": "one of: confirmation | rejection | interview_invite | assessment | offer | verification_code | other",
  "eventDate": "the date the email was sent as YYYY-MM-DD if a date appears in the text, else null",
  "summary": "one plain sentence saying what happened, e.g. 'Stripe confirmed receipt of the application.'"
}
Rules:
- confirmation = the employer confirmed receiving the application.
- rejection = the candidate was not selected / the role was filled / they are not moving forward.
- interview_invite = an interview, call, or meeting is being scheduled or invited.
- assessment = a take-home, test, or work sample was assigned or requested.
- offer = an offer of employment was extended.
- verification_code = the email's main purpose is a sign-in or security code.
- If the email does not clearly fit a type, use "other". Never guess a company that is not named.`;

const parseInput = z.object({
  subject: z.string().trim().max(500).default(""),
  body: z.string().trim().min(20).max(20000),
  licenseKey: z.string(),
});

/**
 * Pro-only: reads a pasted application email, works out which tracked
 * application it belongs to, and proposes the status move it implies.
 * Nothing is written here — the user confirms in the UI, and
 * recordApplicationEvent does the writing.
 */
export const parseApplicationEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => parseInput.parse(input))
  .handler(async ({ data, context }) => {
    const { requireValidLicense } = await import("@/lib/license.server");
    await requireValidLicense(data.licenseKey);
    const { supabase, userId } = context;

    const raw = await callAI(
      supabase,
      userId,
      PARSE_PROMPT,
      `Subject: ${data.subject || "(none)"}\n\n${data.body}`,
      { bucket: "inbox-parse", limit: 20, windowMinutes: 60 },
    );

    const eventType = APPLICATION_EVENT_TYPES.includes(raw["eventType"] as ApplicationEventType)
      ? (raw["eventType"] as ApplicationEventType)
      : "other";
    const parsed: ParsedEmailEvent = {
      company: typeof raw["company"] === "string" && raw["company"] ? raw["company"] : null,
      roleTitle: typeof raw["roleTitle"] === "string" && raw["roleTitle"] ? raw["roleTitle"] : null,
      eventType,
      eventDate:
        typeof raw["eventDate"] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw["eventDate"])
          ? raw["eventDate"]
          : null,
      summary: typeof raw["summary"] === "string" ? raw["summary"].slice(0, 300) : "",
    };

    const { data: apps, error } = await supabase
      .from("applications")
      .select("id, jobs(title, company)")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);

    const candidates = (apps ?? []).map((app) => {
      const job = Array.isArray(app.jobs) ? (app.jobs[0] ?? null) : app.jobs;
      return {
        applicationId: app.id,
        company: job?.company ?? null,
        title: job?.title ?? null,
      };
    });
    const match = bestMatch(parsed, candidates);

    return {
      parsed,
      matchedApplicationId: match?.applicationId ?? null,
      suggestedStatus: suggestedStatusForEvent(parsed.eventType),
    };
  });

const recordInput = z.object({
  applicationId: z.string().uuid().nullable(),
  eventType: z.enum(APPLICATION_EVENT_TYPES),
  eventDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  subject: z.string().trim().max(500).default(""),
  summary: z.string().trim().max(1000).default(""),
  applyStatus: z.boolean().default(false),
});

/**
 * Logs a parsed event and — only when the user confirmed the move —
 * updates the application's status to the one the event implies, with the
 * same first-applied stamping as a manual status change.
 */
export const recordApplicationEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => recordInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    if (data.applicationId) {
      const { data: app, error: appError } = await supabase
        .from("applications")
        .select("id, date_applied")
        .eq("id", data.applicationId)
        .eq("user_id", userId)
        .maybeSingle();
      if (appError) throw new Error(appError.message);
      if (!app) throw new Error("Application not found");

      const suggested = suggestedStatusForEvent(data.eventType);
      if (data.applyStatus && suggested) {
        const appliedDate = data.eventDate ?? new Date().toISOString().slice(0, 10);
        const shouldStampApplied = suggested !== "saved" && !app.date_applied;
        const { error: updateError } = await supabase
          .from("applications")
          .update({
            status: suggested,
            ...(shouldStampApplied
              ? { date_applied: appliedDate, follow_up_date: addBusinessDays(appliedDate, 2) }
              : {}),
          })
          .eq("id", data.applicationId)
          .eq("user_id", userId);
        if (updateError) throw new Error(updateError.message);
      }
    }

    const { data: row, error } = await supabase
      .from("application_events")
      .insert({
        user_id: userId,
        application_id: data.applicationId,
        event_type: data.eventType,
        event_date: data.eventDate ?? null,
        subject: data.subject || null,
        summary: data.summary || null,
      })
      .select("id, event_type, event_date, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/** The user's most recent logged email events, newest first. */
export const listApplicationEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("application_events")
      .select("id, application_id, event_type, event_date, subject, summary, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
