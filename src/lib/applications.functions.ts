import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import { addJobInput, createJobForUser } from "@/lib/jobs.functions";

export const APPLICATION_STATUSES = [
  "saved",
  "applied",
  "interviewing",
  "rejected",
  "offer",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

// Adds `days` business days (Mon–Fri) to a "YYYY-MM-DD" date string, skipping
// weekends. Used to auto-suggest a follow-up date once a role is marked
// applied, so the user isn't left to work that out themselves.
export function addBusinessDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  let remaining = days;
  while (remaining > 0) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay(); // 0 = Sunday, 6 = Saturday
    if (day !== 0 && day !== 6) remaining--;
  }
  return d.toISOString().slice(0, 10);
}

const APPLICATION_COLUMNS =
  "id, status, date_applied, follow_up_date, follow_up_sent, notes, created_at, job_id";

type FollowUpBackfillRow = {
  id: string;
  status: string;
  date_applied: string | null;
  follow_up_date: string | null;
};

// updateApplicationStatus only stamps follow_up_date at the moment a role
// first moves past "saved" — so any application that was already marked
// applied before that logic existed (or before the follow_up_date column
// itself did) is stuck with date_applied set and follow_up_date null
// forever, which hides the whole follow-up section on that row. Rather than
// asking the user to run another manual SQL backfill, self-heal it lazily on
// every read: any row that's past "saved", has an applied date, and is
// missing a follow-up date gets one computed and persisted right here.
export async function backfillFollowUpDates<T extends FollowUpBackfillRow>(
  supabase: SupabaseClient<Database>,
  userId: string,
  rows: T[],
): Promise<T[]> {
  const stale = rows.filter((r) => r.status !== "saved" && r.date_applied && !r.follow_up_date);
  if (!stale.length) return rows;

  const computed = new Map(stale.map((r) => [r.id, addBusinessDays(r.date_applied!, 2)]));

  await Promise.all(
    stale.map((r) =>
      supabase
        .from("applications")
        .update({ follow_up_date: computed.get(r.id)! })
        .eq("id", r.id)
        .eq("user_id", userId),
    ),
  );

  return rows.map((r) => (computed.has(r.id) ? { ...r, follow_up_date: computed.get(r.id)! } : r));
}

export const listApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("applications")
      .select(
        `${APPLICATION_COLUMNS}, jobs(title, company, location, pay_min, pay_max, source_url)`,
      )
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return backfillFollowUpDates(context.supabase, context.userId, data ?? []);
  });

// Lets someone add an application straight from this page (paste a posting, or
// just its URL) instead of going to Jobs first — creates the job and its
// application together. Reuses addJob's validator so both flows accept either
// pasted text or a URL the same way.
export const addApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => addJobInput.parse(input))
  .handler(async ({ data, context }) => {
    const job = await createJobForUser(context.supabase, context.userId, data);

    const { data: application, error } = await context.supabase
      .from("applications")
      .select(
        `${APPLICATION_COLUMNS}, jobs(title, company, location, pay_min, pay_max, source_url)`,
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

    // First time a role moves past "saved", stamp today as the applied date
    // and recommend a follow-up 2 business days out, so follow-up tracking
    // has a real anchor without asking the user to enter anything.
    const shouldStampApplied = data.status !== "saved" && !existing.date_applied;
    const appliedDate = new Date().toISOString().slice(0, 10);

    const { data: row, error } = await context.supabase
      .from("applications")
      .update({
        status: data.status,
        ...(shouldStampApplied
          ? { date_applied: appliedDate, follow_up_date: addBusinessDays(appliedDate, 2) }
          : {}),
      })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select(APPLICATION_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const followUpInput = z.object({
  id: z.string().uuid(),
  follow_up_date: z.string().nullable().optional(),
  follow_up_sent: z.boolean().optional(),
});

// Lets the user nudge the suggested follow-up date, or mark the follow-up as
// actually sent (which the UI shows as done rather than as a still-pending
// date). Either field is optional so each control on the page can update just
// the one thing it touched.
export const updateApplicationFollowUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => followUpInput.parse(input))
  .handler(async ({ data, context }) => {
    const values: { follow_up_date?: string | null; follow_up_sent?: boolean } = {};
    if (data.follow_up_date !== undefined) values.follow_up_date = data.follow_up_date;
    if (data.follow_up_sent !== undefined) values.follow_up_sent = data.follow_up_sent;
    if (Object.keys(values).length === 0) throw new Error("Nothing to update");

    const { data: row, error } = await context.supabase
      .from("applications")
      .update(values)
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select(APPLICATION_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
