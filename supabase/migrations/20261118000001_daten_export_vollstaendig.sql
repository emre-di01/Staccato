-- DSGVO Art. 15: Export um bisher fehlende personenbezogene Daten ergänzt:
-- E-Mail, Notizen, Zahlungsdaten (IBAN/BIC/Kontoinhaber/...), Erziehungsberechtigte,
-- Benachrichtigungs-Einstellungen, hinterlegte Dokumente, Rechnungen.
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
        'mitgliedsbeitrag',  mitgliedsbeitrag
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
