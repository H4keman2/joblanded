import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { createJobForUser } from "@/lib/jobs.functions";

export const APPLICATION_STATUSES = [
  "saved",
  "applied",
  "interviewing",
  "rejected",
  "offer",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const listApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("applications")
      .select(
        "id, status, date_applied, follow_up_date, notes, created_at, job_id, " +
          "jobs(title, company, location, pay_min, pay_max, source_url)",
      )
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// Lets someone add an application straight from this page (paste a posting)
// instead of going to Jobs first — creates the job and its application together.
const addInput = z.object({
  description: z.string().min(80, "Paste the full job description (at least a paragraph)."),
  sourceUrl: z.string().url().optional().or(z.literal("")),
});

export const addApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => addInput.parse(input))
  .handler(async ({ data, context }) => {
    const job = await createJobForUser(context.supabase, context.userId, data);

    const { data: application, error } = await context.supabase
      .from("applications")
      .select(
        "id, status, date_applied, follow_up_date, notes, created_at, job_id, jobs(title, company, location, pay_min, pay_max, source_url)",
      )
      .eq("user_id", context.userId)
      .eq("job_id", job.id)
      .single();
    if (error) throw new Error(error.message);
    return application;
  });

const updateStatusInput = z.object({
  id: z.string().uuid(),
  status: z.enum(APPLICATION_STATUSES),
});

export const updateApplicationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateStatusInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: existing, error: existingError } = await context.supabase
      .from("applications")
      .select("id, date_applied")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (!existing) throw new Error("Application not found");

    // First time a role moves past "saved", stamp today as the applied date so
    // follow-up tracking has a real anchor without asking the user to enter one.
    const shouldStampApplied = data.status !== "saved" && !existing.date_applied;

    const { data: row, error } = await context.supabase
      .from("applications")
      .update({
        status: data.status,
        ...(shouldStampApplied ? { date_applied: new Date().toISOString().slice(0, 10) } : {}),
      })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("id, status, date_applied, follow_up_date, notes, created_at, job_id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
