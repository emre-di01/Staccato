-- Band-Feature vollständig entfernen

-- 1. pg_cron Job
DO $$ BEGIN
  PERFORM cron.unschedule('band-trials-ablaufen');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 2. Funktionen
DROP FUNCTION IF EXISTS public.band_trials_ablaufen();
DROP FUNCTION IF EXISTS public.band_session_starten(uuid);
DROP FUNCTION IF EXISTS public.band_erstellen(text, text);

-- 3. unterricht_sessions bereinigen (FK auf setlists zuerst entfernen)
ALTER TABLE public.unterricht_sessions
  DROP CONSTRAINT IF EXISTS sessions_context_check;

ALTER TABLE public.unterricht_sessions
  DROP COLUMN IF EXISTS setlist_id;

-- 4. Setlist-Tabellen
DROP TABLE IF EXISTS public.setlist_stuecke;
DROP TABLE IF EXISTS public.setlists;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.unterricht_sessions WHERE unterricht_id IS NULL) THEN
    ALTER TABLE public.unterricht_sessions
      ALTER COLUMN unterricht_id SET NOT NULL;
  END IF;
END $$;

-- 5. schulen.typ Spalte
ALTER TABLE public.schulen
  DROP COLUMN IF EXISTS typ;

-- 6. meine_schulen() ohne typ
DROP FUNCTION IF EXISTS public.meine_schulen();
CREATE OR REPLACE FUNCTION public.meine_schulen()
  RETURNS TABLE(
    schule_id uuid, name text, logo_url text, farbe text,
    rolle public.user_rolle, aktiv boolean
  ) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT sm.schule_id, s.name, s.logo_url, s.farbe, sm.rolle, sm.aktiv
  FROM public.schul_mitgliedschaften sm
  JOIN public.schulen s ON s.id = sm.schule_id
  WHERE sm.user_id = auth.uid() AND sm.aktiv = true
  ORDER BY s.name;
$$;
GRANT EXECUTE ON FUNCTION public.meine_schulen() TO authenticated;

-- 7. alle_schulen_stats() ohne typ
DROP FUNCTION IF EXISTS public.alle_schulen_stats();
CREATE OR REPLACE FUNCTION public.alle_schulen_stats()
  RETURNS TABLE(
    schule_id           uuid,
    name                text,
    logo_url            text,
    farbe               text,
    mitglieder_anzahl   bigint,
    letzte_aktivitaet   timestamptz,
    aktiv               boolean,
    ist_demo            boolean,
    demo_expires_at     timestamptz,
    plan                text,
    max_lehrer          int,
    max_schueler        int,
    max_storage_mb      int,
    hat_vorstand        boolean,
    hat_inventar        boolean,
    abo_status          text,
    abo_bis             date,
    verein_verifiziert  boolean
  ) LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  IF public.meine_rolle() != 'superadmin' THEN
    RAISE EXCEPTION 'Nur Superadmin';
  END IF;

  RETURN QUERY
  SELECT
    s.id, s.name, s.logo_url, s.farbe,
    (SELECT count(*)::bigint FROM public.schul_mitgliedschaften sm
     WHERE sm.schule_id = s.id AND sm.aktiv = true),
    (SELECT max(p.aktualisiert_am) FROM public.profiles p WHERE p.schule_id = s.id),
    s.aktiv, s.ist_demo, s.demo_expires_at,
    s.plan, s.max_lehrer, s.max_schueler, s.max_storage_mb,
    s.hat_vorstand, s.hat_inventar,
    s.abo_status, s.abo_bis, s.verein_verifiziert
  FROM public.schulen s
  ORDER BY s.name;
END;
$$;
GRANT EXECUTE ON FUNCTION public.alle_schulen_stats() TO authenticated;
