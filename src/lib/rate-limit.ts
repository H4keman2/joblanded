import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export class RateLimitError extends Error {}

/**
 * Enforces a rolling-window per-user rate limit on a named bucket, backed by
 * the rate_limit_events table (see the migration adding it). Throws
 * RateLimitError once the caller has already made `limit` calls to this
 * bucket within the last `windowMinutes`.
 *
 * Runs entirely against the caller's own RLS-scoped Supabase client, so it
 * can only ever see or write the calling user's own rows — no service-role
 * client needed, and no risk of one user's limit affecting another's.
 */
export async function enforceRateLimit(
  supabase: SupabaseClient<Database>,
  userId: string,
  bucket: string,
  { limit, windowMinutes }: { limit: number; windowMinutes: number },
): Promise<void> {
  const windowStart = new Date(Date.now() - windowMinutes * 60_000).toISOString();

  const { count, error } = await supabase
    .from("rate_limit_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("bucket", bucket)
    .gte("created_at", windowStart);
  if (error) throw new Error(error.message);

  if ((count ?? 0) >= limit) {
    throw new RateLimitError(
      `You've hit the limit for this action (${limit} per ${windowMinutes} minute${
        windowMinutes === 1 ? "" : "s"
      }). Please try again shortly.`,
    );
  }

  const { error: insertError } = await supabase
    .from("rate_limit_events")
    .insert({ user_id: userId, bucket });
  if (insertError) throw new Error(insertError.message);

  // Best-effort housekeeping so this table doesn't grow unbounded without a
  // separate cron job — never block the caller on this.
  void supabase
    .from("rate_limit_events")
    .delete()
    .eq("user_id", userId)
    .eq("bucket", bucket)
    .lt("created_at", new Date(Date.now() - 24 * 60 * 60_000).toISOString())
    .then(undefined, () => undefined);
}
