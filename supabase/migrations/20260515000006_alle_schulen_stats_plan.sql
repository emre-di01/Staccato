-- alle_schulen_stats() mit Plan-Feldern erweitern

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
    s.id,
    s.name,
    s.logo_url,
    s.farbe,
    (SELECT count(*)::bigint FROM public.schul_mitgliedschaften sm
     WHERE sm.schule_id = s.id AND sm.aktiv = true),
    (SELECT max(p.aktualisiert_am) FROM public.profiles p WHERE p.schule_id = s.id),
    s.aktiv,
    s.ist_demo,
    s.demo_expires_at,
    s.plan,
    s.max_lehrer,
    s.max_schueler,
    s.max_storage_mb,
    s.hat_vorstand,
    s.hat_inventar,
    s.abo_status,
    s.abo_bis,
    s.verein_verifiziert
  FROM public.schulen s
  ORDER BY s.name;
END;
$$;
