-- CRM-Aktivitäts-Timeline für Interessenten

CREATE TABLE IF NOT EXISTS public.interessenten_verlauf (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  interessent_id uuid       NOT NULL REFERENCES public.interessenten(id) ON DELETE CASCADE,
  schule_id     uuid        NOT NULL REFERENCES public.schulen(id) ON DELETE CASCADE,
  typ           text        NOT NULL CHECK (typ IN ('erstellt','status_geaendert','probe_termin','notiz','bearbeitet')),
  inhalt        text,
  alt_wert      text,
  neu_wert      text,
  erstellt_von  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  erstellt_am   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.interessenten_verlauf ENABLE ROW LEVEL SECURITY;

CREATE POLICY "iv: lesen" ON public.interessenten_verlauf
  FOR SELECT USING (schule_id = meine_schule_id() AND meine_rolle() IN ('admin','superadmin','lehrer'));

CREATE POLICY "iv: schreiben" ON public.interessenten_verlauf
  FOR INSERT WITH CHECK (schule_id = meine_schule_id() AND meine_rolle() IN ('admin','superadmin'));

CREATE POLICY "iv: loeschen" ON public.interessenten_verlauf
  FOR DELETE USING (schule_id = meine_schule_id() AND meine_rolle() IN ('admin','superadmin'));

-- Trigger: protokolliert Statuswechsel, Probe-Termin-Änderungen und Feld-Edits automatisch
CREATE OR REPLACE FUNCTION public.log_interessenten_verlauf()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.interessenten_verlauf (interessent_id, schule_id, typ, erstellt_von)
    VALUES (NEW.id, NEW.schule_id, 'erstellt', auth.uid());

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.interessenten_verlauf (interessent_id, schule_id, typ, alt_wert, neu_wert, erstellt_von)
      VALUES (NEW.id, NEW.schule_id, 'status_geaendert', OLD.status::text, NEW.status::text, auth.uid());
    END IF;

    IF OLD.probe_datum IS DISTINCT FROM NEW.probe_datum AND NEW.probe_datum IS NOT NULL THEN
      INSERT INTO public.interessenten_verlauf (interessent_id, schule_id, typ, neu_wert, erstellt_von)
      VALUES (NEW.id, NEW.schule_id, 'probe_termin', NEW.probe_datum::text, auth.uid());
    END IF;

    -- Kontaktdaten-Änderungen (getrennt von Status/Termin)
    IF (OLD.voller_name, OLD.email, OLD.telefon, OLD.notizen, OLD.instrument_id, OLD.wunsch_lehrer, OLD.geburtsdatum)
       IS DISTINCT FROM
       (NEW.voller_name, NEW.email, NEW.telefon, NEW.notizen, NEW.instrument_id, NEW.wunsch_lehrer, NEW.geburtsdatum)
    THEN
      INSERT INTO public.interessenten_verlauf (interessent_id, schule_id, typ, erstellt_von)
      VALUES (NEW.id, NEW.schule_id, 'bearbeitet', auth.uid());
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER interessenten_verlauf_trigger
  AFTER INSERT OR UPDATE ON public.interessenten
  FOR EACH ROW EXECUTE FUNCTION public.log_interessenten_verlauf();

CREATE INDEX IF NOT EXISTS idx_interessenten_verlauf_interessent ON public.interessenten_verlauf(interessent_id, erstellt_am DESC);
