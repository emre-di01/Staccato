-- 1. Lehrer laden Schüler direkt in ihren Kurs ein (schul_einladungen.unterricht_id,
--    einladung_versenden mit Kurs, Aufnahme in den Kurs beim Annehmen).
-- 2. Mitglied-Dokumente: Admin-Zugriff nur noch auf Mitglieder der eigenen Schule
--    (vorher: jeder Admin jeder Schule), Lehrer dürfen unterschriebene Anträge für
--    ihre Schüler ablegen.

-- ─── 1. Einladungen mit Kurs ──────────────────────────────────
ALTER TABLE public.schul_einladungen
  ADD COLUMN IF NOT EXISTS unterricht_id uuid REFERENCES public.unterricht(id) ON DELETE SET NULL;

-- Neue Signatur mit optionalem Kurs: alte Variante entfernen, sonst ist der
-- PostgREST-Aufruf mit zwei Argumenten mehrdeutig
DROP FUNCTION IF EXISTS public.einladung_versenden(text, public.user_rolle);

CREATE OR REPLACE FUNCTION public.einladung_versenden(p_email text, p_rolle public.user_rolle, p_unterricht_id uuid DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_schule_id        uuid := public.meine_schule_id();
  v_einladender_id   uuid := auth.uid();
  v_admin            boolean := public.ist_admin_von_schule(public.meine_schule_id());
  v_existing_user_id uuid;
  v_token            uuid;
BEGIN
  IF v_einladender_id IS NULL OR v_schule_id IS NULL THEN
    RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501';
  END IF;

  IF p_unterricht_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.unterricht WHERE id = p_unterricht_id AND schule_id = v_schule_id
  ) THEN
    RAISE EXCEPTION 'Kurs nicht gefunden' USING ERRCODE = '42501';
  END IF;

  -- Admins laden beliebige Rollen ein; Lehrer nur Schüler in einen eigenen Kurs
  IF NOT v_admin THEN
    IF public.meine_rolle() <> 'lehrer' OR p_rolle <> 'schueler'
       OR p_unterricht_id IS NULL OR NOT public.ist_lehrer_von_unterricht(p_unterricht_id) THEN
      RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT id INTO v_existing_user_id FROM auth.users WHERE email = lower(trim(p_email));

  -- Schon Mitglied der Schule: direkt in den Kurs aufnehmen
  IF v_existing_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.schul_mitgliedschaften
    WHERE user_id = v_existing_user_id AND schule_id = v_schule_id AND aktiv
  ) THEN
    IF p_unterricht_id IS NULL THEN
      RETURN jsonb_build_object('action', 'already_member');
    END IF;
    INSERT INTO public.unterricht_schueler (unterricht_id, schueler_id, status)
    VALUES (p_unterricht_id, v_existing_user_id, 'aktiv')
    ON CONFLICT (unterricht_id, schueler_id) DO UPDATE SET status = 'aktiv';
    RETURN jsonb_build_object('action', 'in_kurs_aufgenommen', 'user_id', v_existing_user_id);
  END IF;

  -- Bestehendes Konto einer anderen Schule: Admins nehmen direkt auf (wie bisher)
  IF v_existing_user_id IS NOT NULL AND v_admin THEN
    INSERT INTO public.schul_mitgliedschaften (user_id, schule_id, rolle, eingeladen_von)
    VALUES (v_existing_user_id, v_schule_id, p_rolle, v_einladender_id)
    ON CONFLICT (user_id, schule_id) DO UPDATE SET rolle = p_rolle, aktiv = true;

    UPDATE public.profiles
    SET letzte_schule_id = v_schule_id, schule_id = v_schule_id, rolle = p_rolle
    WHERE id = v_existing_user_id AND letzte_schule_id IS NULL;

    IF p_unterricht_id IS NOT NULL THEN
      INSERT INTO public.unterricht_schueler (unterricht_id, schueler_id, status)
      VALUES (p_unterricht_id, v_existing_user_id, 'aktiv')
      ON CONFLICT (unterricht_id, schueler_id) DO UPDATE SET status = 'aktiv';
    END IF;

    RETURN jsonb_build_object('action', 'mitgliedschaft_erstellt', 'user_id', v_existing_user_id);
  END IF;

  -- Sonst (neues Konto, oder Lehrer lädt bestehendes Konto ein): Einladungslink.
  -- Lehrer verraten so nicht, ob zu einer E-Mail bereits ein Konto existiert.
  INSERT INTO public.schul_einladungen (email, schule_id, rolle, eingeladen_von, token, unterricht_id)
  VALUES (lower(trim(p_email)), v_schule_id, p_rolle, v_einladender_id, gen_random_uuid(), p_unterricht_id)
  RETURNING token INTO v_token;

  RETURN jsonb_build_object('action', 'einladung_erstellt', 'token', v_token, 'email', lower(trim(p_email)));
END;
$function$;

-- Beim Annehmen (bestehendes Konto) auch in den Kurs aufnehmen
CREATE OR REPLACE FUNCTION public.einladung_annehmen(p_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_einladung  record;
  v_user_email text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_einladung
  FROM public.schul_einladungen
  WHERE token = p_token AND status = 'offen' AND ablauf_am > now();

  IF v_einladung IS NULL THEN
    RAISE EXCEPTION 'Einladung nicht gefunden oder abgelaufen';
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();

  IF lower(v_user_email) != lower(v_einladung.email) THEN
    RAISE EXCEPTION 'Diese Einladung ist für eine andere E-Mail-Adresse';
  END IF;

  INSERT INTO public.schul_mitgliedschaften (user_id, schule_id, rolle, eingeladen_von)
  VALUES (auth.uid(), v_einladung.schule_id, v_einladung.rolle, v_einladung.eingeladen_von)
  ON CONFLICT (user_id, schule_id) DO UPDATE SET rolle = v_einladung.rolle, aktiv = true;

  -- Wenn noch keine aktive Schule: setze diese als aktiv
  UPDATE public.profiles
  SET letzte_schule_id = v_einladung.schule_id,
      schule_id        = v_einladung.schule_id,
      rolle            = v_einladung.rolle
  WHERE id = auth.uid() AND letzte_schule_id IS NULL;

  IF v_einladung.unterricht_id IS NOT NULL THEN
    INSERT INTO public.unterricht_schueler (unterricht_id, schueler_id, status)
    VALUES (v_einladung.unterricht_id, auth.uid(), 'aktiv')
    ON CONFLICT (unterricht_id, schueler_id) DO UPDATE SET status = 'aktiv';
  END IF;

  UPDATE public.schul_einladungen SET status = 'angenommen' WHERE id = v_einladung.id;

  RETURN jsonb_build_object(
    'ok',       true,
    'schule_id', v_einladung.schule_id,
    'rolle',    v_einladung.rolle
  );
END;
$function$;

-- Lehrer sehen offene Einladungen ihrer Kurse
DO $$ BEGIN
  CREATE POLICY "einladung: lehrer lesen" ON public.schul_einladungen FOR SELECT
    USING (eingeladen_von = auth.uid()
           OR (unterricht_id IS NOT NULL AND public.ist_lehrer_von_unterricht(unterricht_id)));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 2. Mitglied-Dokumente ────────────────────────────────────
-- Admin der aktiven Schule und das Mitglied gehört zu dieser Schule.
-- Text-Parameter, weil Storage den Ordnernamen als Text liefert.
CREATE OR REPLACE FUNCTION public.ist_admin_von_mitglied(p_profil text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.ist_admin_von_schule(public.meine_schule_id())
     AND EXISTS (SELECT 1 FROM public.schul_mitgliedschaften m
                 WHERE m.user_id::text = p_profil AND m.schule_id = public.meine_schule_id());
$function$;

-- Lehrer eines Kurses, in dem das Mitglied ist
CREATE OR REPLACE FUNCTION public.ist_lehrer_von_mitglied(p_profil text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.unterricht_schueler us
    JOIN public.unterricht_lehrer ul ON ul.unterricht_id = us.unterricht_id
    WHERE us.schueler_id::text = p_profil AND ul.lehrer_id = auth.uid()
  );
$function$;

DROP POLICY IF EXISTS admin_alles ON public.mitglied_dateien;
DO $$ BEGIN
  CREATE POLICY "md: admin der schule" ON public.mitglied_dateien FOR ALL
    USING (public.ist_admin_von_mitglied(profil_id::text))
    WITH CHECK (public.ist_admin_von_mitglied(profil_id::text));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "md: lehrer legt ab" ON public.mitglied_dateien FOR INSERT
    WITH CHECK (hochgeladen_von = auth.uid() AND public.ist_lehrer_von_mitglied(profil_id::text));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP POLICY IF EXISTS admin_upload            ON storage.objects;
DROP POLICY IF EXISTS admin_lesen_mitglied    ON storage.objects;
DROP POLICY IF EXISTS admin_loeschen_mitglied ON storage.objects;
DROP POLICY IF EXISTS mitglied_update_mitglied ON storage.objects;

DO $$ BEGIN
  CREATE POLICY "md-storage: admin lesen" ON storage.objects FOR SELECT
    USING (bucket_id = 'mitglied-dateien' AND public.ist_admin_von_mitglied((storage.foldername(name))[1]));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "md-storage: hochladen" ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'mitglied-dateien' AND (
      public.ist_admin_von_mitglied((storage.foldername(name))[1])
      OR public.ist_lehrer_von_mitglied((storage.foldername(name))[1])));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "md-storage: admin aendern" ON storage.objects FOR UPDATE
    USING (bucket_id = 'mitglied-dateien' AND public.ist_admin_von_mitglied((storage.foldername(name))[1]));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "md-storage: admin loeschen" ON storage.objects FOR DELETE
    USING (bucket_id = 'mitglied-dateien' AND public.ist_admin_von_mitglied((storage.foldername(name))[1]));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
