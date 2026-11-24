-- Abendkasse: keine vergünstigten Tickets; optional eigener, höherer Preis (null = Normalpreis).
-- Vorab reservierte Tickets behalten auch bei Zahlung an der Abendkasse ihren Reservierungspreis.
ALTER TABLE public.ticket_einstellungen ADD COLUMN IF NOT EXISTS preis_abendkasse numeric(8,2);
DO $$ BEGIN
  ALTER TABLE public.ticket_einstellungen ADD CONSTRAINT ticket_einst_abendkasse CHECK (preis_abendkasse IS NULL OR preis_abendkasse >= preis_normal);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
