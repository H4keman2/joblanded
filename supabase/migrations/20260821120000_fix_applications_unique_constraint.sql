-- The original UNIQUE (job_id) constraint on applications assumes every job
-- row belongs to exactly one user, which holds today (users paste their own
-- job postings) but breaks the moment jobs become shared rows pulled from a
-- job board API and multiple users can apply to the same job_id. Scoping the
-- uniqueness to (job_id, user_id) keeps "one application per job per user"
-- correct under both models.

ALTER TABLE public.applications
  DROP CONSTRAINT applications_job_id_key;

ALTER TABLE public.applications
  ADD CONSTRAINT applications_job_id_user_id_key UNIQUE (job_id, user_id);
