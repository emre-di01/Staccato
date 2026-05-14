ALTER TABLE public.stuecke
  ADD COLUMN IF NOT EXISTS liedtext_md boolean NOT NULL DEFAULT true;
