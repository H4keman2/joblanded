-- Records the user's yes/no call on each posting in the Match feed
-- ('liked' = keep it in play, 'passed' = not for me), so decided postings
-- leave the feed queue without touching their tracker status. NULL means
-- the posting hasn't been shown/decided in the feed yet.
ALTER TABLE public.jobs ADD COLUMN feed_decision text;
ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_feed_decision_check CHECK (feed_decision IN ('liked', 'passed'));
