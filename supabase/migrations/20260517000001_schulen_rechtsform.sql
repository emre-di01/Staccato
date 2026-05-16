-- Rechtsform, Vereinsregister, Gemeinnützigkeit für Musikschulen

ALTER TABLE public.schulen
  ADD COLUMN IF NOT EXISTS rechtsform              text
    CHECK (rechtsform IN ('einzelperson','gbr','ev','ggmbh','gmbh','ug','sonstiges')),
  ADD COLUMN IF NOT EXISTS vereinsreg_nr           text,
  ADD COLUMN IF NOT EXISTS vereinsreg_gericht      text,
  ADD COLUMN IF NOT EXISTS ist_gemeinnuetzig       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS finanzamt               text,
  ADD COLUMN IF NOT EXISTS freistellungsbescheid_datum date;

-- Trigger aktualisieren: neue Felder in Rechnungs-Snapshot einschließen
CREATE OR REPLACE FUNCTION public.rechnungsnummer_vergeben()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_schule   record;
  v_schueler record;
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

  IF NEW.empfaenger_snapshot IS NULL AND NEW.schueler_id IS NOT NULL THEN
    SELECT voller_name, adresse
    INTO v_schueler
    FROM public.profiles WHERE id = NEW.schueler_id;

    NEW.empfaenger_snapshot := to_jsonb(v_schueler);
  END IF;

  RETURN NEW;
END;
$$;
