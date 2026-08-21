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
      .in("status", ["applied", "interviewing", "offer"])
      .order("follow_up_date", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });
