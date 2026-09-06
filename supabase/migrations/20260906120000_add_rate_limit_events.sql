-- Backs a per-user rolling-window rate limit (see src/lib/rate-limit.ts) on
-- the AI-backed server functions (resume parsing, draft tailoring, posting
-- matching, adding a job). Those all call a shared, project-billed AI
-- gateway key with no prior cost control, so one account looping a call
-- could run up the bill or exhaust the shared quota for every other user.
CREATE TABLE public.rate_limit_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL,
  bucket TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX rate_limit_events_user_bucket_time_idx
  ON public.rate_limit_events (user_id, bucket, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.rate_limit_events TO authenticated;
GRANT ALL ON public.rate_limit_events TO service_role;
ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;

-- Callers can only ever see/insert/prune their own events — the limit is
-- enforced from each request's own RLS-scoped client, no service-role
-- client needed.
CREATE POLICY "own rate limit events" ON public.rate_limit_events
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
