import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, full_name, phone")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

// Full name and phone only — the account's login email lives in Supabase
// Auth (auth.users), not this table, and is changed via supabase.auth.updateUser
// on the client so the confirmation-email flow applies. Keeping a second,
// separately-editable "email" here would let it drift from the real login
// email, which is exactly the confusing case this schema now avoids.
const profileInput = z.object({
  full_name: z.string().max(200).nullable(),
  phone: z.string().max(50).nullable(),
});

export const saveProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => profileInput.parse(input))
  .handler(async ({ data, context }) => {
    const values = {
      full_name: data.full_name || null,
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

// Bundles everything the account owns into one JSON payload for a
// self-service "download your data" export. Read-only, scoped to the
// caller's own rows via the authenticated (RLS) client.
export const exportAccountData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [profile, resumes, jobs, matches, tailoredDocuments, applications] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("resumes").select("*").eq("user_id", userId),
      supabase.from("jobs").select("*").eq("user_id", userId),
      supabase.from("matches").select("*").eq("user_id", userId),
      supabase.from("tailored_documents").select("*").eq("user_id", userId),
      supabase.from("applications").select("*").eq("user_id", userId),
    ]);
    for (const result of [profile, resumes, jobs, matches, tailoredDocuments, applications]) {
      if (result.error) throw new Error(result.error.message);
    }
    return {
      exported_at: new Date().toISOString(),
      profile: profile.data,
      resumes: resumes.data ?? [],
      jobs: jobs.data ?? [],
      matches: matches.data ?? [],
      tailored_documents: tailoredDocuments.data ?? [],
      applications: applications.data ?? [],
    };
  });

// Permanently deletes everything the account owns, then the Supabase Auth
// user itself. Jobs and resumes are deleted first — matches, tailored
// documents and applications all carry ON DELETE CASCADE foreign keys back
// to jobs/resumes, so removing those two tables clears the rest. Deleting
// the auth user needs the service-role admin client (a normal user token
// can't remove its own auth.users row), imported dynamically per this
// project's convention for *.functions.ts files, which ship to the client
// bundle and so can't safely top-level-import a service-role module.
export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { error: jobsError } = await supabase.from("jobs").delete().eq("user_id", userId);
    if (jobsError) throw new Error(jobsError.message);

    const { error: resumesError } = await supabase.from("resumes").delete().eq("user_id", userId);
    if (resumesError) throw new Error(resumesError.message);

    const { error: profileError } = await supabase.from("profiles").delete().eq("user_id", userId);
    if (profileError) throw new Error(profileError.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authError) throw new Error(authError.message);

    return { ok: true };
  });

export const getApplicationStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // "This week" = the last 7 calendar days including today — gives the
    // stats strip something to say about recent momentum, not just totals.
    const sevenDaysAgo = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10);

    const [resumes, tailored, jobs, applications, jobsThisWeek, applicationsThisWeek] =
      await Promise.all([
        supabase.from("resumes").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase
          .from("tailored_documents")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("type", "tailor_version"),
        supabase.from("jobs").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("applications").select("status").eq("user_id", userId),
        supabase
          .from("jobs")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .gte("date_added", sevenDaysAgo),
        supabase
          .from("applications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .neq("status", "saved")
          .gte("date_applied", sevenDaysAgo),
      ]);

    if (resumes.error) throw new Error(resumes.error.message);
    if (tailored.error) throw new Error(tailored.error.message);
    if (jobs.error) throw new Error(jobs.error.message);
    if (applications.error) throw new Error(applications.error.message);
    if (jobsThisWeek.error) throw new Error(jobsThisWeek.error.message);
    if (applicationsThisWeek.error) throw new Error(applicationsThisWeek.error.message);

    const byStatus = { saved: 0, applied: 0, interviewing: 0, offer: 0, rejected: 0 };
    for (const row of applications.data ?? []) {
      const key = row.status as keyof typeof byStatus;
      if (key in byStatus) byStatus[key] += 1;
    }

    return {
      resumesCount: resumes.count ?? 0,
      tailoredVersionsCount: tailored.count ?? 0,
      jobsCount: jobs.count ?? 0,
      jobsAddedThisWeek: jobsThisWeek.count ?? 0,
      applicationsThisWeek: applicationsThisWeek.count ?? 0,
      applications: { ...byStatus, total: (applications.data ?? []).length },
    };
  });
