-- Rechtskonforme Rechnungen: Rechnungsnummer (§14 UStG), Stornierung (GoBD), Steuerhinweis

-- 1. Neue Spalten auf rechnungen
ALTER TABLE public.rechnungen
  ADD COLUMN IF NOT EXISTS rechnungsnummer text,
  ADD COLUMN IF NOT EXISTS storniert_am    timestamptz,
  ADD COLUMN IF NOT EXISTS storniert_von   uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Keine zwei identischen Nummern pro Schule
CREATE UNIQUE INDEX IF NOT EXISTS rechnungen_nummer_schule_unique
  ON public.rechnungen(schule_id, rechnungsnummer)
  WHERE rechnungsnummer IS NOT NULL;

-- 2. Neue Spalten auf schulen
ALTER TABLE public.schulen
  ADD COLUMN IF NOT EXISTS rechnungen_prefix  text    NOT NULL DEFAULT 'RG',
  ADD COLUMN IF NOT EXISTS rechnungen_zaehler integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS steuer_hinweis      text;

-- 3. Atomare Funktion: nächste Rechnungsnummer (kein Race Condition durch UPDATE ... RETURNING)
CREATE OR REPLACE FUNCTION public.naechste_rechnungsnummer(p_schule_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_zaehler integer;
  v_prefix  text;
BEGIN
  UPDATE public.schulen
  SET    rechnungen_zaehler = rechnungen_zaehler + 1
  WHERE  id = p_schule_id
  RETURNING rechnungen_zaehler, rechnungen_prefix INTO v_zaehler, v_prefix;

  RETURN COALESCE(v_prefix, 'RG')
    || '-' || to_char(now() AT TIME ZONE 'Europe/Berlin', 'YYYY')
    || '-' || lpad(v_zaehler::text, 4, '0');
END;
$$;

-- 4. Trigger: Rechnungsnummer automatisch bei INSERT vergeben
CREATE OR REPLACE FUNCTION public.rechnungsnummer_vergeben()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.rechnungsnummer IS NULL THEN
    NEW.rechnungsnummer := public.naechste_rechnungsnummer(NEW.schule_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rechnungsnummer_trigger ON public.rechnungen;
CREATE TRIGGER rechnungsnummer_trigger
  BEFORE INSERT ON public.rechnungen
  FOR EACH ROW EXECUTE FUNCTION public.rechnungsnummer_vergeben();
