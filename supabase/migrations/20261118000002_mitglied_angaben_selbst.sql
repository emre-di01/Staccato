-- Mitglieder tragen ihre Angaben (inkl. Bankverbindung) selbst ein.
-- 1. sepa_mandat_am: Zeitpunkt der online erteilten SEPA-Zustimmung (vom Server gesetzt)
-- 2. profil_schutz: Mitglieder dürfen Beitrag, Zahlungsrhythmus und Notizen nicht
--    selbst ändern; Zeitstempel der SEPA-Zustimmung wird serverseitig gesetzt und bei
--    IBAN-Wechsel ohne neue Zustimmung zurückgesetzt.
-- 3. View mitglieder_mit_email + Datenexport um sepa_mandat_am ergänzt.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sepa_mandat_am timestamptz;

CREATE OR REPLACE FUNCTION public.profil_schutz()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rolle public.user_rolle := public.meine_rolle();
BEGIN
  -- Interne Aufrufe (service_role, GoTrue, cron) und superadmin nicht einschränken
  IF public.ist_intern() OR v_rolle = 'superadmin' THEN
    RETURN NEW;
  END IF;

  -- Eigenes Profil (kein Admin der Schule): schulseitige Felder sind tabu
  IF TG_OP = 'UPDATE' AND NEW.id = auth.uid() AND NOT public.ist_admin_von_schule(OLD.schule_id) THEN
    IF NEW.mitgliedsbeitrag IS DISTINCT FROM OLD.mitgliedsbeitrag
       OR NEW.zahlungsrhythmus IS DISTINCT FROM OLD.zahlungsrhythmus
       OR NEW.notizen          IS DISTINCT FROM OLD.notizen THEN
      RAISE EXCEPTION 'Beitrag, Zahlungsrhythmus und Notizen legt die Musikschule fest' USING ERRCODE = '42501';
    END IF;
    -- SEPA-Zustimmung: Zeitpunkt setzt der Server; neue IBAN ohne neue Zustimmung → Zustimmung verfällt
    IF NEW.sepa_mandat_am IS DISTINCT FROM OLD.sepa_mandat_am AND NEW.sepa_mandat_am IS NOT NULL THEN
      NEW.sepa_mandat_am := now();
    ELSIF NEW.iban IS DISTINCT FROM OLD.iban THEN
      NEW.sepa_mandat_am := NULL;
    END IF;
  END IF;

  -- Keine geschützte Spalte geändert → normales Profil-Update
  IF TG_OP = 'UPDATE'
     AND NEW.rolle              IS NOT DISTINCT FROM OLD.rolle
     AND NEW.schule_id          IS NOT DISTINCT FROM OLD.schule_id
     AND NEW.letzte_schule_id   IS NOT DISTINCT FROM OLD.letzte_schule_id
     AND NEW.aktiv              IS NOT DISTINCT FROM OLD.aktiv
     AND NEW.kann_kurse_anlegen IS NOT DISTINCT FROM OLD.kann_kurse_anlegen THEN
    RETURN NEW;
  END IF;

  IF NEW.rolle = 'superadmin' OR (TG_OP = 'UPDATE' AND OLD.rolle = 'superadmin') THEN
    RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501';
  END IF;

  -- Admin verwaltet Mitglieder seiner Schule
  IF NEW.id <> auth.uid()
     AND public.ist_admin_von_schule(NEW.schule_id)
     AND (TG_OP = 'INSERT' OR public.ist_admin_von_schule(OLD.schule_id)) THEN
    RETURN NEW;
  END IF;

  -- Schulwechsel / Einladung annehmen: Rolle + Schule passen zu einer aktiven Mitgliedschaft
  IF TG_OP = 'UPDATE' AND NEW.id = auth.uid()
     AND NEW.aktiv              IS NOT DISTINCT FROM OLD.aktiv
     AND NEW.kann_kurse_anlegen IS NOT DISTINCT FROM OLD.kann_kurse_anlegen
     AND EXISTS (SELECT 1 FROM public.schul_mitgliedschaften m
                 WHERE m.user_id = NEW.id AND m.aktiv
                   AND m.schule_id = COALESCE(NEW.letzte_schule_id, NEW.schule_id)
                   AND m.rolle = NEW.rolle) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Keine Berechtigung, Rolle/Schule/Status zu ändern' USING ERRCODE = '42501';
END;
$function$;

-- View: Spalte hinten anhängen (CREATE OR REPLACE VIEW erlaubt nur neue Spalten am Ende)
CREATE OR REPLACE VIEW public.mitglieder_mit_email
WITH (security_invoker = false)
AS
SELECT
  p.id, p.voller_name, p.rolle, p.schule_id, p.sprache, p.telefon, p.adresse,
  p.geburtsdatum, p.aktiv, p.notizen, p.avatar_url, p.kann_kurse_anlegen,
  p.iban, p.bic, p.kontoinhaber, p.zahlungsweise, p.zahlungsrhythmus, p.mitgliedsbeitrag,
  p.erziehungsberechtigter_name, p.erziehungsberechtigter_telefon, p.erziehungsberechtigter_email,
  p.aktualisiert_am, p.erstellt_am,
  u.email,
  p.sepa_mandat_am
FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.id
WHERE p.schule_id = public.meine_schule_id()
  AND (
    p.id = auth.uid()
    OR public.meine_rolle() IN ('admin', 'superadmin')
    OR public.ist_lehrer_von_schueler(p.id)
  );

CREATE OR REPLACE FUNCTION public.meine_daten_exportieren()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Nicht authentifiziert';
  END IF;

  SELECT jsonb_build_object(
    'exportiert_am', now(),
    'profil', (
      SELECT jsonb_build_object(
        'voller_name',   p.voller_name,
        'email',         u.email,
        'rolle',         p.rolle,
        'sprache',       p.sprache,
        'telefon',       p.telefon,
        'adresse',       p.adresse,
        'geburtsdatum',  p.geburtsdatum,
        'avatar_url',    p.avatar_url,
        'notizen',       p.notizen,
        'email_benachrichtigungen', p.email_benachrichtigungen,
        'erstellt_am',   p.erstellt_am,
        'aktualisiert_am', p.aktualisiert_am
      )
      FROM profiles p LEFT JOIN auth.users u ON u.id = p.id
      WHERE p.id = v_uid
    ),
    'zahlungsdaten', (
      SELECT jsonb_build_object(
        'kontoinhaber',      kontoinhaber,
        'iban',              iban,
        'bic',               bic,
        'zahlungsweise',     zahlungsweise,
        'zahlungsrhythmus',  zahlungsrhythmus,
        'mitgliedsbeitrag',  mitgliedsbeitrag,
        'sepa_zustimmung_am', sepa_mandat_am
      ) FROM profiles WHERE id = v_uid
    ),
    'erziehungsberechtigte', (
      SELECT jsonb_build_object(
        'name',     erziehungsberechtigter_name,
        'telefon',  erziehungsberechtigter_telefon,
        'email',    erziehungsberechtigter_email
      ) FROM profiles WHERE id = v_uid
    ),
    'kursmitgliedschaften', (
      SELECT jsonb_agg(jsonb_build_object(
        'kurs',   u.name,
        'typ',    u.typ,
        'status', us.status
      ))
      FROM unterricht_schueler us
      JOIN unterricht u ON u.id = us.unterricht_id
      WHERE us.schueler_id = v_uid
    ),
    'anwesenheiten', (
      SELECT jsonb_agg(jsonb_build_object(
        'datum',  s.beginn,
        'kurs',   u.name,
        'status', a.status
      ) ORDER BY s.beginn DESC)
      FROM anwesenheit a
      JOIN stunden s ON s.id = a.stunde_id
      JOIN unterricht u ON u.id = s.unterricht_id
      WHERE a.schueler_id = v_uid
    ),
    'dokumente', (
      SELECT jsonb_agg(jsonb_build_object(
        'name',           name,
        'typ',            typ,
        'hochgeladen_am', hochgeladen_am
      ) ORDER BY hochgeladen_am DESC)
      FROM mitglied_dateien
      WHERE profil_id = v_uid
    ),
    'rechnungen', (
      SELECT jsonb_agg(jsonb_build_object(
        'rechnungsnummer', rechnungsnummer,
        'ausgestellt_am',  ausgestellt_am,
        'betrag',          betrag,
        'positionen',      positionen,
        'faellig_am',      faellig_am,
        'bezahlt_am',      bezahlt_am,
        'zahlungsweg',     zahlungsweg,
        'storniert_am',    storniert_am,
        'empfaenger',      empfaenger_snapshot
      ) ORDER BY ausgestellt_am DESC)
      FROM rechnungen
      WHERE schueler_id = v_uid
    ),
    'nachrichten_gesendet', (
      SELECT jsonb_agg(jsonb_build_object(
        'betreff',    betreff,
        'inhalt',     inhalt,
        'typ',        typ,
        'gesendet_am', gesendet_am
      ))
      FROM nachrichten
      WHERE gesendet_von = v_uid
    ),
    'nachrichten_empfangen', (
      SELECT jsonb_agg(jsonb_build_object(
        'betreff',    betreff,
        'inhalt',     inhalt,
        'typ',        typ,
        'gesendet_am', gesendet_am
      ))
      FROM nachrichten
      WHERE empfaenger_id = v_uid
    ),
    'event_teilnahmen', (
      SELECT jsonb_agg(jsonb_build_object(
        'event',   e.titel,
        'datum',   e.beginn,
        'zusage',  et.zusage
      ))
      FROM event_teilnehmer et
      JOIN events e ON e.id = et.event_id
      WHERE et.profil_id = v_uid
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;
