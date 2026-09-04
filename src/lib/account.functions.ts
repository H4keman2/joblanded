import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, full_name, email, phone")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

const profileInput = z.object({
  full_name: z.string().max(200).nullable(),
  email: z.string().email().nullable().or(z.literal("")),
  phone: z.string().max(50).nullable(),
});

export const saveProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => profileInput.parse(input))
  .handler(async ({ data, context }) => {
    const values = {
      full_name: data.full_name || null,
      email: data.email || null,
      phone: data.phone || null,
    };

    const { data: existing, error: readError } = await context.supabase
      .from("profiles")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);

    if (existing) {
      const { error } = await context.supabase
        .from("profiles")
        .update(values)
        .eq("id", existing.id)
        .eq("user_id", context.userId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase
        .from("profiles")
        .insert({ ...values, user_id: context.userId });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const getActiveApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("applications")
      .select("id, status, follow_up_date, date_applied, jobs(title, company)")
      .eq("user_id", context.userId)
      // "saved" (in process) counts as active too — every saved job opens one
      // automatically now, so excluding it made the dashboard look empty even
      // when there was a real, just-not-submitted-yet application to show.
      .in("status", ["saved", "applied", "interviewing", "offer"])
      .order("follow_up_date", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [resumes, tailored, jobs, applications] = await Promise.all([
      supabase.from("resumes").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase
        .from("tailored_documents")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("type", "tailor_version"),
      supabase.from("jobs").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("applications").select("status").eq("user_id", userId),
    ]);

    if (resumes.error) throw new Error(resumes.error.message);
    if (tailored.error) throw new Error(tailored.error.message);
    if (jobs.error) throw new Error(jobs.error.message);
    if (applications.error) throw new Error(applications.error.message);

    const byStatus = { saved: 0, applied: 0, interviewing: 0, offer: 0, rejected: 0 };
    for (const row of applications.data ?? []) {
      const key = row.status as keyof typeof byStatus;
      if (key in byStatus) byStatus[key] += 1;
    }

    return {
      resumesCount: resumes.count ?? 0,
      tailoredVersionsCount: tailored.count ?? 0,
      jobsCount: jobs.count ?? 0,
      applications: { ...byStatus, total: (applications.data ?? []).length },
    };
  });
