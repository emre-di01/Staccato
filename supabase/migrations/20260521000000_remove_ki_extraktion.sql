-- Entfernt KI-Rechnungserkennung (invoice-extract Feature wurde entfernt)
ALTER TABLE public.schulen DROP COLUMN IF EXISTS hat_ki_extraktion;
ALTER TABLE public.schulen DROP COLUMN IF EXISTS anthropic_api_key;
