-- rechnungsnummer_vergeben() auf den Stand von 20260517000009 zurücksetzen.
-- deploy.sh hat am 2026-10-27 fälschlich 20260517000001 erneut ausgeführt und damit die ältere
-- Version dieser Trigger-Funktion eingespielt (Fehlalarm bei der Erkennung ausstehender Migrationen).
-- Auf dev ein No-op.

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
