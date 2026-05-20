-- Bugfix: demo_schule_loeschen darf nur User löschen die ausschließlich
-- in dieser Schule sind. User mit Mitgliedschaft in anderen Schulen bleiben erhalten.

CREATE OR REPLACE FUNCTION demo_schule_loeschen(p_schule_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE demo_anfragen SET status = 'archiviert' WHERE schule_id = p_schule_id;

  -- Sessions
  DELETE FROM session_reaktionen
    WHERE session_id IN (SELECT id FROM unterricht_sessions WHERE schule_id = p_schule_id);
  DELETE FROM session_teilnehmer
    WHERE session_id IN (SELECT id FROM unterricht_sessions WHERE schule_id = p_schule_id);
  DELETE FROM unterricht_sessions WHERE schule_id = p_schule_id;

  -- Stunden + Anwesenheit
  DELETE FROM anwesenheit
    WHERE stunde_id IN (
      SELECT s.id FROM stunden s
      JOIN unterricht u ON u.id = s.unterricht_id
      WHERE u.schule_id = p_schule_id
    );
  DELETE FROM stunden_lehrer
    WHERE stunde_id IN (
      SELECT s.id FROM stunden s
      JOIN unterricht u ON u.id = s.unterricht_id
      WHERE u.schule_id = p_schule_id
    );
  DELETE FROM stunden
    WHERE unterricht_id IN (SELECT id FROM unterricht WHERE schule_id = p_schule_id);

  -- Unterricht-Verknüpfungen
  DELETE FROM unterricht_stuecke
    WHERE unterricht_id IN (SELECT id FROM unterricht WHERE schule_id = p_schule_id);
  DELETE FROM unterricht_schueler
    WHERE unterricht_id IN (SELECT id FROM unterricht WHERE schule_id = p_schule_id);
  DELETE FROM unterricht_lehrer
    WHERE unterricht_id IN (SELECT id FROM unterricht WHERE schule_id = p_schule_id);
  DELETE FROM unterricht WHERE schule_id = p_schule_id;

  -- Events
  DELETE FROM event_stuecke
    WHERE event_id IN (SELECT id FROM events WHERE schule_id = p_schule_id);
  DELETE FROM event_teilnehmer
    WHERE event_id IN (SELECT id FROM events WHERE schule_id = p_schule_id);
  DELETE FROM events WHERE schule_id = p_schule_id;

  -- Nachrichten
  DELETE FROM nachricht_gelesen
    WHERE nachricht_id IN (SELECT id FROM nachrichten WHERE schule_id = p_schule_id);
  DELETE FROM nachricht_geloescht
    WHERE nachricht_id IN (SELECT id FROM nachrichten WHERE schule_id = p_schule_id);
  DELETE FROM nachrichten WHERE schule_id = p_schule_id;

  -- Repertoire
  DELETE FROM stueck_dateien
    WHERE stueck_id IN (SELECT id FROM stuecke WHERE schule_id = p_schule_id);
  DELETE FROM event_stuecke
    WHERE stueck_id IN (SELECT id FROM stuecke WHERE schule_id = p_schule_id);
  DELETE FROM stuecke WHERE schule_id = p_schule_id;

  -- Räume, Instrumente, Sonstiges
  DELETE FROM raeume        WHERE schule_id = p_schule_id;
  DELETE FROM instrumente   WHERE schule_id = p_schule_id;
  DELETE FROM interessenten WHERE schule_id = p_schule_id;
  DELETE FROM rechnungen    WHERE schule_id = p_schule_id;
  DELETE FROM dateien       WHERE schule_id = p_schule_id;

  -- Nur User löschen die AUSSCHLIESSLICH in dieser Schule sind
  -- UND keine Superadmins sind (Superadmins werden nie automatisch gelöscht).
  PERFORM delete_auth_user(sm.user_id)
    FROM schul_mitgliedschaften sm
    JOIN public.profiles p ON p.id = sm.user_id
    WHERE sm.schule_id = p_schule_id
      AND p.rolle <> 'superadmin'
      AND NOT EXISTS (
        SELECT 1 FROM schul_mitgliedschaften sm2
        WHERE sm2.user_id = sm.user_id
          AND sm2.schule_id <> p_schule_id
          AND sm2.aktiv = true
      );

  DELETE FROM schulen WHERE id = p_schule_id;
END;
$$;
