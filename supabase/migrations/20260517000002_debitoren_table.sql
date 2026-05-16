-- Debitorenstamm (Kundenstamm / custtable)
-- Empfänger ausgehender Rechnungen: Mitglieder, externe Firmen, Veranstalter, etc.

CREATE TABLE IF NOT EXISTS public.debitoren (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  schule_id       uuid        NOT NULL REFERENCES public.schulen(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  adresse         text,
  email           text,
  telefon         text,
  ustid           text,        -- USt-IdNr. des Debitors (§14 UStG)
  iban            text,        -- für SEPA-Lastschrift
  bic             text,
  notizen         text,
  profil_id       uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  erstellt_am     timestamptz DEFAULT now(),
  aktualisiert_am timestamptz DEFAULT now()
);

ALTER TABLE public.debitoren ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS debitoren_schule_idx ON public.debitoren(schule_id);
CREATE INDEX IF NOT EXISTS debitoren_profil_idx ON public.debitoren(profil_id);

-- Admin und Superadmin dürfen alles für ihre eigene Schule
CREATE POLICY "debitoren: admin alles" ON public.debitoren
  USING  (schule_id = public.meine_schule_id() AND public.meine_rolle() IN ('admin','superadmin'))
  WITH CHECK (schule_id = public.meine_schule_id() AND public.meine_rolle() IN ('admin','superadmin'));
