-- Job-search preferences captured in the Account page's "Job preferences"
-- section. The Match feed reads them back: pay_floor hides postings whose
-- stated pay tops out below it, and preferred_location / work_style flag
-- cards that don't line up. All nullable — no preferences set means the
-- feed behaves exactly as before.
ALTER TABLE public.profiles
  ADD COLUMN target_roles text,
  ADD COLUMN pay_floor integer,
  ADD COLUMN preferred_location text,
  ADD COLUMN work_style text,
  ADD COLUMN willing_to_relocate boolean NOT NULL DEFAULT false;
