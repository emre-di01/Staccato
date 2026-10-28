-- Opt-in für die neue Oberfläche („Staccato 2026“). Pro Nutzer, geräteübergreifend.
-- Idempotent: IF NOT EXISTS.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS neues_design boolean NOT NULL DEFAULT false;
