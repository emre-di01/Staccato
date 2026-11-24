-- Dateien gelöschter Konten aus dem Speicher entfernen (DSGVO Art. 17). Vorher blieben sie nach „Konto löschen“ liegen.
-- Der Trigger merkt nur die Konto-ID vor (darf das Löschen nie verhindern); das Entfernen läuft über die Storage-API
-- (Function stunden-erinnerung, Aufgabe „dateien“), weil ein DELETE in storage.objects die Dateien selbst nicht entfernt.
-- Betroffen sind nur Buckets, deren erster Ordner die Konto-ID ist.

CREATE TABLE IF NOT EXISTS public.geloeschte_konten (
  konto_id    uuid PRIMARY KEY,
  geloescht_am timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.geloeschte_konten ENABLE ROW LEVEL SECURITY;   -- ohne Policies: nur über die Funktionen unten
REVOKE ALL ON public.geloeschte_konten FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.konto_geloescht_vormerken()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  BEGIN
    INSERT INTO public.geloeschte_konten (konto_id) VALUES (OLD.id) ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Dateien von Konto % nicht vorgemerkt: %', OLD.id, SQLERRM;
  END;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS konto_geloescht_vormerken ON auth.users;
CREATE TRIGGER konto_geloescht_vormerken AFTER DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.konto_geloescht_vormerken();

-- Noch vorhandene Dateien; nie für ein Konto, das es (noch) gibt
CREATE OR REPLACE FUNCTION public.konto_dateien_offen(p_limit integer DEFAULT 500)
 RETURNS TABLE(konto uuid, bucket text, pfad text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.ist_intern() THEN RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  SELECT g.konto_id, o.bucket_id::text, o.name::text
  FROM public.geloeschte_konten g
  JOIN storage.objects o
    ON o.bucket_id IN ('avatare', 'mitglied-dateien', 'schueler-dateien', 'eigene-dateien')
   AND o.name LIKE g.konto_id::text || '/%'
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = g.konto_id)
    AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = g.konto_id)
  LIMIT p_limit;
END;
$function$;

-- Vormerkungen ohne verbleibende Dateien streichen; liefert die Zahl der noch offenen Konten
CREATE OR REPLACE FUNCTION public.konto_dateien_fertig()
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.ist_intern() THEN RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501'; END IF;
  DELETE FROM public.geloeschte_konten g
  WHERE EXISTS (SELECT 1 FROM auth.users u WHERE u.id = g.konto_id)
     OR NOT EXISTS (
          SELECT 1 FROM storage.objects o
          WHERE o.bucket_id IN ('avatare', 'mitglied-dateien', 'schueler-dateien', 'eigene-dateien')
            AND o.name LIKE g.konto_id::text || '/%');
  RETURN (SELECT count(*)::integer FROM public.geloeschte_konten);
END;
$function$;

-- Wie die Stunden-Erinnerung: ohne Vault-Einträge (dev) passiert nichts
SELECT cron.schedule(
  'konto-dateien-loeschen',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url     := b.decrypted_secret || '/functions/v1/stunden-erinnerung',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-secret', s.decrypted_secret),
    body    := '{"aufgabe":"dateien"}'::jsonb,
    timeout_milliseconds := 60000
  )
  FROM vault.decrypted_secrets b, vault.decrypted_secrets s
  WHERE b.name = 'functions_basis' AND s.name = 'internal_secret'
    AND EXISTS (SELECT 1 FROM public.geloeschte_konten)
  $$
);
