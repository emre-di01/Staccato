ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS kann_kurse_anlegen boolean NOT NULL DEFAULT false;
