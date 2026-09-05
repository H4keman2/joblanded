-- Tracks whether the recommended follow-up email has actually been sent,
-- separately from follow_up_date (when it's due). Lets the Applications and
-- Dashboard pages show "follow up due" vs "follow-up sent" instead of just a
-- date with no way to mark it done.
ALTER TABLE public.applications ADD COLUMN follow_up_sent BOOLEAN NOT NULL DEFAULT false;
