-- Ab v2.6.0 ist die neue Oberfläche Standard (Schüler, Lehrer). Wer die bisherige
-- Ansicht weiter nutzen will, schaltet sie in den Einstellungen ein („klassisches Design“).
-- `neues_design` (Opt-in) wird nicht mehr gelesen, bleibt aber bestehen.
-- Idempotent: IF NOT EXISTS.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS altes_design boolean NOT NULL DEFAULT false;
