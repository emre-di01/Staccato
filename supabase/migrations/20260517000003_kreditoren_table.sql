-- Kreditorenstamm (Lieferantenstamm / vendtable)
-- Absender eingehender Rechnungen: Vermieter, Lehrer (Honorar), Lieferanten, etc.

CREATE TABLE IF NOT EXISTS public.kreditoren (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  schule_id       uuid        NOT NULL REFERENCES public.schulen(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  adresse         text,
  email           text,
  telefon         text,
  ustid           text,
  iban            text,        -- Konto des Lieferanten für Überweisungen
  bic             text,
  kategorie       text        NOT NULL DEFAULT 'sonstiges'
    CHECK (kategorie IN ('gehalt','miete','material','versicherung','sonstiges')),
  notizen         text,
  erstellt_am     timestamptz DEFAULT now(),
  aktualisiert_am timestamptz DEFAULT now()
);

ALTER TABLE public.kreditoren ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS kreditoren_schule_idx ON public.kreditoren(schule_id);

-- Admin und Superadmin dürfen alles für ihre eigene Schule
CREATE POLICY "kreditoren: admin alles" ON public.kreditoren
  USING  (schule_id = public.meine_schule_id() AND public.meine_rolle() IN ('admin','superadmin'))
  WITH CHECK (schule_id = public.meine_schule_id() AND public.meine_rolle() IN ('admin','superadmin'));
