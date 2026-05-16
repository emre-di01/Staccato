-- Ausgaben: Kreditor-FK + Lieferanten-Rechnungsdaten hinzufügen

ALTER TABLE public.ausgaben
  ADD COLUMN IF NOT EXISTS kreditor_id              uuid  REFERENCES public.kreditoren(id) ON DELETE SET NULL,
  -- Lieferanten-Rechnungsnummer (die Nummer auf der eingehenden Rechnung)
  ADD COLUMN IF NOT EXISTS lieferanten_rechnung_nr  text,
  -- Rechnungsdatum des Lieferanten (§14 UStG Eingangsdatum)
  ADD COLUMN IF NOT EXISTS rechnungsdatum           date;

CREATE INDEX IF NOT EXISTS ausgaben_kreditor_idx ON public.ausgaben(kreditor_id);
