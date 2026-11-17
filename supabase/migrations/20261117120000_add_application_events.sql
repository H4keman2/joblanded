-- Living tracker: structured events parsed out of application emails
-- (confirmations, rejections, interview invites, offers…), so the tracker
-- can show what actually happened on each application and when, instead of
-- relying on the user to keep every status current by hand.
CREATE TABLE public.application_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('confirmation','rejection','interview_invite','assessment','offer','verification_code','other')),
  event_date DATE,
  subject TEXT,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX application_events_user_application_idx
  ON public.application_events (user_id, application_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_events TO authenticated;
GRANT ALL ON public.application_events TO service_role;
ALTER TABLE public.application_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own application events" ON public.application_events FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
