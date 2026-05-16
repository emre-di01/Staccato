-- Ausgaben (Kreditoren): Verbindlichkeiten der Musikschule

CREATE TABLE IF NOT EXISTS public.ausgaben (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  schule_id    uuid        NOT NULL REFERENCES public.schulen(id) ON DELETE CASCADE,
  empfaenger   text        NOT NULL,
  betrag       numeric(10,2) NOT NULL CHECK (betrag > 0),
  kategorie    text        NOT NULL DEFAULT 'sonstiges'
    CHECK (kategorie IN ('gehalt','miete','material','versicherung','sonstiges')),
  beschreibung text,
  belegnummer  text,
  faellig_am   date,
  bezahlt_am   date,
  notizen      text,
  storniert_am  timestamptz,
  storniert_von uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  erstellt_von  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  erstellt_am   timestamptz DEFAULT now()
);

ALTER TABLE public.ausgaben ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS ausgaben_schule_idx   ON public.ausgaben(schule_id);
CREATE INDEX IF NOT EXISTS ausgaben_faellig_idx  ON public.ausgaben(faellig_am);
CREATE INDEX IF NOT EXISTS ausgaben_bezahlt_idx  ON public.ausgaben(bezahlt_am);

-- Admin und Superadmin dürfen alles für ihre eigene Schule
CREATE POLICY "ausgaben: admin alles" ON public.ausgaben
  USING  (schule_id = public.meine_schule_id() AND public.meine_rolle() IN ('admin','superadmin'))
  WITH CHECK (schule_id = public.meine_schule_id() AND public.meine_rolle() IN ('admin','superadmin'));
