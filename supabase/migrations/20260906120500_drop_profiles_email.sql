-- profiles.email has been dead since the app settled on auth.users.email as
-- the single source of truth for login email (see the comment above
-- getProfile/saveProfile in src/lib/account.functions.ts): nothing reads or
-- writes this column anymore. Leaving it in place is a latent trap — a
-- future feature could read from it by mistake and silently show a stale
-- address that drifted from the real login email.
--
-- handle_new_user() (added in the initial migration) still writes to it on
-- every signup, so that has to change first or every new signup will start
-- failing once the column is gone.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

ALTER TABLE public.profiles DROP COLUMN email;
