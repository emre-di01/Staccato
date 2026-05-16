-- GoBD §239 HGB: Ausgestellte Rechnungen dürfen nicht nachträglich geändert werden.
-- Erlaubt bleiben: bezahlt_am, zahlungsweg, storniert_am, storniert_von.

CREATE OR REPLACE FUNCTION public.rechnung_unveraenderlich()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.rechnungsnummer IS NULL THEN
    RETURN NEW;
  END IF;

  IF (
    NEW.betrag               IS DISTINCT FROM OLD.betrag               OR
    NEW.positionen           IS DISTINCT FROM OLD.positionen           OR
    NEW.steuersatz           IS DISTINCT FROM OLD.steuersatz           OR
    NEW.empfaenger_name      IS DISTINCT FROM OLD.empfaenger_name      OR
    NEW.empfaenger_adresse   IS DISTINCT FROM OLD.empfaenger_adresse   OR
    NEW.empfaenger_snapshot  IS DISTINCT FROM OLD.empfaenger_snapshot  OR
    NEW.schule_snapshot      IS DISTINCT FROM OLD.schule_snapshot      OR
    NEW.schueler_id          IS DISTINCT FROM OLD.schueler_id          OR
    NEW.debitor_id           IS DISTINCT FROM OLD.debitor_id           OR
    NEW.faellig_am           IS DISTINCT FROM OLD.faellig_am           OR
    NEW.zeitraum_von         IS DISTINCT FROM OLD.zeitraum_von         OR
    NEW.zeitraum_bis         IS DISTINCT FROM OLD.zeitraum_bis         OR
    NEW.notizen              IS DISTINCT FROM OLD.notizen              OR
    NEW.typ                  IS DISTINCT FROM OLD.typ
  ) THEN
    RAISE EXCEPTION
      'GoBD §239: Ausgestellte Rechnungen dürfen nicht geändert werden. Nur Bezahlung und Stornierung sind erlaubt. (Rechnung: %)', OLD.rechnungsnummer
      USING ERRCODE = 'raise_exception';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rechnung_unveraenderlich_trigger ON public.rechnungen;
CREATE TRIGGER rechnung_unveraenderlich_trigger
  BEFORE UPDATE ON public.rechnungen
  FOR EACH ROW EXECUTE FUNCTION public.rechnung_unveraenderlich();
