-- Vereinfachte Rechnungen: Empfänger als Freitext + Steuersatz-Feld
ALTER TABLE public.rechnungen
  ADD COLUMN IF NOT EXISTS empfaenger_name    text,
  ADD COLUMN IF NOT EXISTS empfaenger_adresse text,
  ADD COLUMN IF NOT EXISTS steuersatz         numeric(4,2) NOT NULL DEFAULT 0;

-- Trigger erweitern: logo_url im Schul-Snapshot + Freitext-Empfänger-Fallback
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

  -- Schul-Snapshot (inkl. logo_url für reproduzierbares Druckbild)
  IF NEW.schule_snapshot IS NULL THEN
    SELECT name, adresse, email, telefon, steuer_hinweis, steuernummer, ustid,
           rechtsform, vereinsreg_nr, vereinsreg_gericht, ist_gemeinnuetzig, finanzamt, logo_url
    INTO v_schule
    FROM public.schulen WHERE id = NEW.schule_id;

    NEW.schule_snapshot         := to_jsonb(v_schule);
    NEW.steuer_hinweis_snapshot := v_schule.steuer_hinweis;
  END IF;

  -- Empfänger-Snapshot: Debitor > Schüler-Profil > Freitext-Felder
  IF NEW.empfaenger_snapshot IS NULL THEN
    IF NEW.debitor_id IS NOT NULL THEN
      SELECT name, adresse, email, telefon, ustid INTO v_debitor
      FROM public.debitoren WHERE id = NEW.debitor_id;
      NEW.empfaenger_snapshot := jsonb_build_object(
        'name', v_debitor.name, 'adresse', v_debitor.adresse,
        'email', v_debitor.email, 'telefon', v_debitor.telefon, 'ustid', v_debitor.ustid
      );
    ELSIF NEW.schueler_id IS NOT NULL THEN
      SELECT voller_name, adresse INTO v_schueler
      FROM public.profiles WHERE id = NEW.schueler_id;
      NEW.empfaenger_snapshot := jsonb_build_object(
        'name', v_schueler.voller_name, 'adresse', v_schueler.adresse
      );
    ELSIF NEW.empfaenger_name IS NOT NULL THEN
      NEW.empfaenger_snapshot := jsonb_build_object(
        'name', NEW.empfaenger_name,
        'adresse', COALESCE(NEW.empfaenger_adresse, '')
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
