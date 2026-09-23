CREATE OR REPLACE FUNCTION public.create_application_for_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.applications (user_id, job_id, status)
  VALUES (NEW.user_id, NEW.id, 'saved')
  ON CONFLICT (job_id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_application_for_job() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_job_created_add_application ON public.jobs;
CREATE TRIGGER on_job_created_add_application
AFTER INSERT ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.create_application_for_job();

INSERT INTO public.applications (user_id, job_id, status)
SELECT j.user_id, j.id, 'saved'
FROM public.jobs j
WHERE NOT EXISTS (SELECT 1 FROM public.applications a WHERE a.job_id = j.id);