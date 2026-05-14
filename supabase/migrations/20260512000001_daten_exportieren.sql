-- DSGVO Art. 15: Recht auf Auskunft — User can export all their stored personal data
CREATE OR REPLACE FUNCTION meine_daten_exportieren()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
        'voller_name',  voller_name,
        'rolle',        rolle,
        'sprache',      sprache,
        'telefon',      telefon,
        'adresse',      adresse,
        'geburtsdatum', geburtsdatum,
        'erstellt_am',  erstellt_am
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
$$;

REVOKE ALL ON FUNCTION meine_daten_exportieren() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION meine_daten_exportieren() TO authenticated;
