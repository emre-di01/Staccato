-- GoBD & §14 UStG Compliance: Rechnungen unveränderlich + vollständige Pflichtangaben

-- 1. Steuerliche Pflichtangaben auf schulen
ALTER TABLE public.schulen
  ADD COLUMN IF NOT EXISTS steuernummer text,
  ADD COLUMN IF NOT EXISTS ustid        text;

-- 2. Neue Spalten auf rechnungen
ALTER TABLE public.rechnungen
  -- Ausstellungsdatum (§14 Abs. 4 Nr. 3 UStG)
  ADD COLUMN IF NOT EXISTS ausgestellt_am         timestamptz,
  -- Snapshot der Schuldaten zum Ausstellungszeitpunkt (GoBD: Unveränderlichkeit)
  ADD COLUMN IF NOT EXISTS steuer_hinweis_snapshot text,
  ADD COLUMN IF NOT EXISTS schule_snapshot         jsonb,
  ADD COLUMN IF NOT EXISTS empfaenger_snapshot     jsonb,
  -- Zahlungsweg (Dokumentation der Zahlung)
  ADD COLUMN IF NOT EXISTS zahlungsweg             text
    CHECK (zahlungsweg IN ('ueberweisung','sepa','bar','sonstiges'));

-- Backfill: ausgestellt_am für bestehende Rechnungen
UPDATE public.rechnungen SET ausgestellt_am = erstellt_am WHERE ausgestellt_am IS NULL;

-- 3. Zahlungsweg auf ausgaben
ALTER TABLE public.ausgaben
  ADD COLUMN IF NOT EXISTS zahlungsweg text
    CHECK (zahlungsweg IN ('ueberweisung','sepa','bar','sonstiges'));

-- 4. Trigger: Snapshot bei INSERT (GoBD §239: Unveränderlichkeit von Buchungsbelegen)
CREATE OR REPLACE FUNCTION public.rechnungsnummer_vergeben()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_schule   record;
  v_schueler record;
BEGIN
  -- Rechnungsnummer
  IF NEW.rechnungsnummer IS NULL THEN
    NEW.rechnungsnummer := public.naechste_rechnungsnummer(NEW.schule_id);
  END IF;

  -- Ausstellungsdatum
  IF NEW.ausgestellt_am IS NULL THEN
    NEW.ausgestellt_am := now();
  END IF;

  -- Schul-Snapshot (enthält Steuerdaten zum Ausstellungszeitpunkt)
  IF NEW.schule_snapshot IS NULL THEN
    SELECT name, adresse, email, telefon, steuer_hinweis, steuernummer, ustid
    INTO v_schule
    FROM public.schulen WHERE id = NEW.schule_id;

    NEW.schule_snapshot         := to_jsonb(v_schule);
    NEW.steuer_hinweis_snapshot := v_schule.steuer_hinweis;
  END IF;

  -- Empfänger-Snapshot
  IF NEW.empfaenger_snapshot IS NULL AND NEW.schueler_id IS NOT NULL THEN
    SELECT voller_name, adresse
    INTO v_schueler
    FROM public.profiles WHERE id = NEW.schueler_id;

    NEW.empfaenger_snapshot := to_jsonb(v_schueler);
  END IF;

  RETURN NEW;
END;
$$;

-- 5. GoBD §239: Rechnungen dürfen nicht gelöscht werden — nur storniert
-- Alte Blanket-Policy entfernen und durch granulare Policies ohne DELETE ersetzen
DROP POLICY IF EXISTS "rech: admin" ON public.rechnungen;
DROP POLICY IF EXISTS "rech: lesen" ON public.rechnungen;

-- SELECT: Schüler sehen eigene, Eltern sehen Kind-Rechnungen, Admin sieht Schulrechnungen
CREATE POLICY "rech: lesen" ON public.rechnungen
  FOR SELECT USING (
    schueler_id = auth.uid()
    OR (public.meine_rolle() IN ('admin','superadmin') AND schule_id = public.meine_schule_id())
    OR public.ist_elternteil_von(schueler_id)
  );

-- INSERT: Admin nur für eigene Schule
CREATE POLICY "rech: admin insert" ON public.rechnungen
  FOR INSERT WITH CHECK (
    schule_id = public.meine_schule_id()
    AND public.meine_rolle() IN ('admin','superadmin')
  );

-- UPDATE: Admin nur für eigene Schule (für Bezahlt-Markierung und Stornierung)
CREATE POLICY "rech: admin update" ON public.rechnungen
  FOR UPDATE
  USING  (schule_id = public.meine_schule_id() AND public.meine_rolle() IN ('admin','superadmin'))
  WITH CHECK (schule_id = public.meine_schule_id() AND public.meine_rolle() IN ('admin','superadmin'));

-- Kein DELETE — GoBD §239 verbietet rückwirkende Löschung von Buchungsbelegen

-- 6. GoBD: Ausgaben dürfen nicht gelöscht werden
DROP POLICY IF EXISTS "ausgaben: admin alles" ON public.ausgaben;

CREATE POLICY "ausgaben: admin select" ON public.ausgaben
  FOR SELECT USING (
    schule_id = public.meine_schule_id()
    AND public.meine_rolle() IN ('admin','superadmin')
  );

CREATE POLICY "ausgaben: admin insert" ON public.ausgaben
  FOR INSERT WITH CHECK (
    schule_id = public.meine_schule_id()
    AND public.meine_rolle() IN ('admin','superadmin')
  );

CREATE POLICY "ausgaben: admin update" ON public.ausgaben
  FOR UPDATE
  USING  (schule_id = public.meine_schule_id() AND public.meine_rolle() IN ('admin','superadmin'))
  WITH CHECK (schule_id = public.meine_schule_id() AND public.meine_rolle() IN ('admin','superadmin'));

-- Kein DELETE
