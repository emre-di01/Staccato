-- Die tägliche Erinnerung kam nie an: localhost im DB-Container ist nicht das Gateway, und app.internal_secret war nie gesetzt.
-- Adresse und Kennwort stehen jetzt je Instanz im Vault (functions_basis, internal_secret), nicht in der Migration.
-- Fehlt einer der beiden Einträge (z.B. dev), passiert nichts.
SELECT cron.schedule(
  'stunden-erinnerung-taeglich',
  '0 17 * * *',
  $$
  SELECT net.http_post(
    url     := b.decrypted_secret || '/functions/v1/stunden-erinnerung',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-secret', s.decrypted_secret),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  )
  FROM vault.decrypted_secrets b, vault.decrypted_secrets s
  WHERE b.name = 'functions_basis' AND s.name = 'internal_secret'
  $$
);
