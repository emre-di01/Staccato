-- Rechnungen: Debitor-FK hinzufügen, schueler_id optional machen
-- Bestehende Rechnungen (mit schueler_id) bleiben unberührt (Backward-Compat).

-- 1. schueler_id nullable machen (war NOT NULL)
ALTER TABLE public.rechnungen ALTER COLUMN schueler_id DROP NOT NULL;

-- 2. debitor_id FK zur neuen debitoren-Tabelle
ALTER TABLE public.rechnungen
  ADD COLUMN IF NOT EXISTS debitor_id uuid REFERENCES public.debitoren(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS rechnungen_debitor_idx ON public.rechnungen(debitor_id);

-- 3. Trigger aktualisieren: Snapshot aus debitoren ODER profiles befüllen
CREATE OR REPLACE FUNCTION public.rechnungsnummer_vergeben()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_schule   record;
  v_schueler record;
  v_debitor  record;
BEGIN
  IF NEW.rechnungsnummer IS NULL THEN
    NEW.rechnungsnummer := public.naechste_rechnungsnummer(NEW.schule_id);
  END IF;

  IF NEW.ausgestellt_am IS NULL THEN
    NEW.ausgestellt_am := now();
  END IF;

  IF NEW.schule_snapshot IS NULL THEN
    SELECT name, adresse, email, telefon, steuer_hinweis, steuernummer, ustid,
           rechtsform, vereinsreg_nr, vereinsreg_gericht, ist_gemeinnuetzig, finanzamt
    INTO v_schule
    FROM public.schulen WHERE id = NEW.schule_id;

    NEW.schule_snapshot         := to_jsonb(v_schule);
    NEW.steuer_hinweis_snapshot := v_schule.steuer_hinweis;
  END IF;

  IF NEW.empfaenger_snapshot IS NULL THEN
    IF NEW.debitor_id IS NOT NULL THEN
      SELECT name, adresse, email
      INTO v_debitor
      FROM public.debitoren WHERE id = NEW.debitor_id;
      -- voller_name-Key für Kompatibilität mit druckeRechnung() im Frontend
      NEW.empfaenger_snapshot := jsonb_build_object(
        'voller_name', v_debitor.name,
        'adresse',     v_debitor.adresse,
        'email',       v_debitor.email
      );
    ELSIF NEW.schueler_id IS NOT NULL THEN
      SELECT voller_name, adresse
      INTO v_schueler
      FROM public.profiles WHERE id = NEW.schueler_id;
      NEW.empfaenger_snapshot := to_jsonb(v_schueler);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. RLS: schueler_id kann jetzt NULL sein — Policy absichern
DROP POLICY IF EXISTS "rech: lesen" ON public.rechnungen;

CREATE POLICY "rech: lesen" ON public.rechnungen
  FOR SELECT USING (
    (schueler_id IS NOT NULL AND schueler_id = auth.uid())
    OR (public.meine_rolle() IN ('admin','superadmin') AND schule_id = public.meine_schule_id())
    OR (schueler_id IS NOT NULL AND public.ist_elternteil_von(schueler_id))
  );
