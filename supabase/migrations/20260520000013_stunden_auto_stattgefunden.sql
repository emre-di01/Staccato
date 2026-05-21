-- Vergangene Stunden automatisch auf stattgefunden setzen
-- Nur geplant→stattgefunden wenn ende < NOW() und kein manuelles abgesagt/verschoben

CREATE OR REPLACE FUNCTION stunden_status_aktualisieren()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE stunden
  SET status = 'stattgefunden'
  WHERE status = 'geplant'
    AND ende < NOW();
END;
$$;

-- Bestehende Daten sofort korrigieren
SELECT stunden_status_aktualisieren();

-- Stündlich ausführen
SELECT cron.schedule(
  'stunden-status-aktualisieren',
  '0 * * * *',
  $$SELECT stunden_status_aktualisieren()$$
);
