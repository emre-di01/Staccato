CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Bereinigt alte Session-Daten:
--   • beendete Sessions nach 30 Tagen
--   • verwaiste "aktiv"-Sessions nach 24 Stunden (Lehrer hat nie beendet)
-- session_teilnehmer + session_reaktionen kaskadieren automatisch.

CREATE OR REPLACE FUNCTION public.session_bereinigen()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM public.unterricht_sessions
  WHERE
    (status = 'beendet'  AND beendet_am  < now() - interval '30 days')
    OR
    (status = 'aktiv'    AND gestartet_am < now() - interval '24 hours');

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

ALTER FUNCTION public.session_bereinigen() OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.session_bereinigen() TO service_role;

-- pg_cron: täglich um 03:00 UTC
SELECT cron.schedule(
  'session-cleanup',
  '0 3 * * *',
  $$SELECT public.session_bereinigen()$$
);
