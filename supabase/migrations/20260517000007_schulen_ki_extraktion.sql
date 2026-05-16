-- Feature-Toggle: KI-Rechnungserkennung (Invoice Capture) pro Schule
ALTER TABLE public.schulen
  ADD COLUMN IF NOT EXISTS hat_ki_extraktion boolean NOT NULL DEFAULT false;
