-- Tägliche Unterrichts-Erinnerungen um 17:00 UTC (= 18/19 Uhr DE)
SELECT cron.schedule(
  'stunden-erinnerung-taeglich',
  '0 17 * * *',
  $$
  SELECT net.http_post(
    url     := 'http://localhost:54321/functions/v1/stunden-erinnerung',
    headers := jsonb_build_object(
      'Content-Type',       'application/json',
      'x-internal-secret',  current_setting('app.internal_secret', true)
    ),
    body    := '{}'::jsonb
  )
  $$
);
