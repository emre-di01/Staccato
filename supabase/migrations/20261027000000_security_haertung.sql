-- Sicherheits-Härtung nach Audit vom 2026-10-27 (siehe docs/security-incident-2026-10-27.md)
--
-- 1. handle_new_user übernimmt keine Rolle mehr aus user_metadata
--    (vorher: öffentliche Registrierung mit {"rolle":"superadmin"} → Superadmin)
-- 2. Trigger profil_schutz: Nutzer können rolle/schule_id/letzte_schule_id/aktiv/kann_kurse_anlegen
--    nicht selbst ändern (vorher: PATCH auf das eigene Profil → Superadmin bzw. fremde Schule).
--    Erlaubt bleiben: superadmin, Admin für Mitglieder seiner Schule, Schulwechsel/Einladung passend
--    zu einer aktiven Mitgliedschaft, interne Aufrufe (ist_intern()).
-- 3. Admin-RPCs prüfen Rolle UND Schule (vorher: create_user, demo_schule_loeschen, dashboard_stats,
--    stunden_generieren usw. ohne Prüfung; vorhandene Prüfungen per NULL-Rolle umgehbar).
--
-- Bewusst KEIN REVOKE EXECUTE: Im Image supabase/postgres 17.6.1.106 stürzt das Backend bei jedem
-- "permission denied for function" mit Segfault ab (getestet 2026-10-27). Ein REVOKE würde jeden
-- Aufruf durch anon in einen DB-Absturz verwandeln. Deshalb lehnen die Funktionen selbst per RAISE ab.
--
-- Idempotent: CREATE OR REPLACE / DROP TRIGGER IF EXISTS.

-- ── Helfer ─────────────────────────────────────────────────────────────────────

-- true bei internen Aufrufen ohne Nutzer-JWT: pg_cron, Trigger-Kontext von GoTrue, service_role (Edge Functions)
CREATE OR REPLACE FUNCTION public.ist_intern()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path = public
AS $function$
  SELECT auth.uid() IS NULL AND COALESCE(auth.role(), '') NOT IN ('anon', 'authenticated');
$function$;

-- true, wenn der Aufrufer superadmin ist oder admin der angegebenen Schule
CREATE OR REPLACE FUNCTION public.ist_admin_von_schule(p_schule_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public
AS $function$
  SELECT CASE public.meine_rolle()
    WHEN 'superadmin' THEN true
    WHEN 'admin' THEN p_schule_id IS NOT NULL AND (
         p_schule_id = public.meine_schule_id()
      OR EXISTS (SELECT 1 FROM public.schul_mitgliedschaften m
                 WHERE m.user_id = auth.uid() AND m.schule_id = p_schule_id
                   AND m.aktiv AND m.rolle IN ('admin', 'superadmin')))
    ELSE false
  END;
$function$;

-- true, wenn der Aufrufer Passwort/E-Mail/Konto des Nutzers verwalten darf
-- (superadmin: alle; admin: Nicht-Superadmins mit Profil oder Mitgliedschaft in seiner Schule)
CREATE OR REPLACE FUNCTION public.darf_nutzer_verwalten(p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public
AS $function$
  SELECT CASE public.meine_rolle()
    WHEN 'superadmin' THEN true
    WHEN 'admin' THEN EXISTS (
      SELECT 1 FROM public.profiles t
      WHERE t.id = p_user_id AND t.rolle <> 'superadmin'
        AND (public.ist_admin_von_schule(t.schule_id)
             OR EXISTS (SELECT 1 FROM public.schul_mitgliedschaften m
                        WHERE m.user_id = t.id AND public.ist_admin_von_schule(m.schule_id))))
    ELSE false
  END;
$function$;

-- ── Funktionen mit Berechtigungsprüfung (Logik unverändert, Prüfung direkt nach BEGIN) ──

-- create_user
CREATE OR REPLACE FUNCTION public.create_user(p_email text, p_passwort text, p_voller_name text, p_rolle user_rolle, p_schule_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_user_id    uuid := gen_random_uuid();
  v_max_lehrer  int;
  v_max_schueler int;
  v_count       int;
BEGIN
  IF NOT public.ist_admin_von_schule(p_schule_id)
     OR (p_rolle = 'superadmin' AND public.meine_rolle() IS DISTINCT FROM 'superadmin') THEN
    RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501';
  END IF;
  -- Plan-Limits prüfen (nur für lehrer und schueler)
  SELECT max_lehrer, max_schueler
    INTO v_max_lehrer, v_max_schueler
    FROM public.schulen
   WHERE id = p_schule_id;

  IF p_rolle = 'lehrer' AND v_max_lehrer IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count
      FROM public.profiles
     WHERE schule_id = p_schule_id AND rolle = 'lehrer' AND aktiv = true;
    IF v_count >= v_max_lehrer THEN
      RAISE EXCEPTION 'PLAN_LIMIT_LEHRER:%', v_max_lehrer;
    END IF;
  END IF;

  IF p_rolle = 'schueler' AND v_max_schueler IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count
      FROM public.profiles
     WHERE schule_id = p_schule_id AND rolle = 'schueler' AND aktiv = true;
    IF v_count >= v_max_schueler THEN
      RAISE EXCEPTION 'PLAN_LIMIT_SCHUELER:%', v_max_schueler;
    END IF;
  END IF;

  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    role, aud,
    confirmation_token, recovery_token,
    email_change_token_new, email_change, phone_change
  ) VALUES (
    v_user_id, '00000000-0000-0000-0000-000000000000',
    p_email, extensions.crypt(p_passwort, extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('voller_name', p_voller_name, 'rolle', p_rolle, 'schule_id', p_schule_id),
    'authenticated', 'authenticated',
    '', '', '', '', ''
  );

  INSERT INTO public.profiles (id, voller_name, rolle, schule_id, letzte_schule_id)
  VALUES (v_user_id, p_voller_name, p_rolle, p_schule_id, p_schule_id)
  ON CONFLICT (id) DO UPDATE
    SET voller_name = p_voller_name, rolle = p_rolle,
        schule_id = p_schule_id, letzte_schule_id = p_schule_id;

  INSERT INTO public.schul_mitgliedschaften (user_id, schule_id, rolle, eingeladen_von)
  VALUES (v_user_id, p_schule_id, p_rolle, auth.uid())
  ON CONFLICT (user_id, schule_id) DO UPDATE SET rolle = p_rolle, aktiv = true;

  RETURN v_user_id;
END;
$function$;

-- admin_set_password
CREATE OR REPLACE FUNCTION public.admin_set_password(p_user_id uuid, p_passwort text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  IF NOT public.darf_nutzer_verwalten(p_user_id) THEN RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501'; END IF;
  if meine_rolle() not in ('admin','superadmin') then
    raise exception 'Keine Berechtigung';
  end if;
  update auth.users
  set encrypted_password = extensions.crypt(p_passwort, extensions.gen_salt('bf')),
      updated_at = now()
  where id = p_user_id;
end;
$function$;

-- admin_set_email
CREATE OR REPLACE FUNCTION public.admin_set_email(p_user_id uuid, p_email text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  IF NOT public.darf_nutzer_verwalten(p_user_id) THEN RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501'; END IF;
  if meine_rolle() not in ('admin','superadmin') then
    raise exception 'Keine Berechtigung';
  end if;
  update auth.users
  set email              = p_email,
      email_confirmed_at = now(),
      updated_at         = now()
  where id = p_user_id;
end;
$function$;

-- delete_auth_user
CREATE OR REPLACE FUNCTION public.delete_auth_user(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'auth', 'public'
AS $function$
DECLARE
  v_rolle public.user_rolle;
BEGIN
  IF NOT public.darf_nutzer_verwalten(p_user_id) THEN RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501'; END IF;
  SELECT rolle INTO v_rolle FROM public.profiles WHERE id = auth.uid();
  IF v_rolle NOT IN ('admin', 'superadmin') THEN
    RAISE EXCEPTION 'Nicht autorisiert';
  END IF;
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$function$;

-- mitgliedschaft_setzen
CREATE OR REPLACE FUNCTION public.mitgliedschaft_setzen(p_user_id uuid, p_schule_id uuid, p_rolle user_rolle)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF public.meine_rolle() IS DISTINCT FROM 'superadmin' THEN RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501'; END IF;
  IF public.meine_rolle() != 'superadmin' THEN
    RAISE EXCEPTION 'Nur Superadmin';
  END IF;

  INSERT INTO public.schul_mitgliedschaften (user_id, schule_id, rolle, eingeladen_von, aktiv)
  VALUES (p_user_id, p_schule_id, p_rolle, auth.uid(), true)
  ON CONFLICT (user_id, schule_id) DO UPDATE SET rolle = p_rolle, aktiv = true;

  -- Wenn der Nutzer noch keine aktive Schule hat, diese als primäre setzen
  UPDATE public.profiles
  SET schule_id = p_schule_id, letzte_schule_id = p_schule_id, rolle = p_rolle
  WHERE id = p_user_id AND schule_id IS NULL;
END;
$function$;

-- mitgliedschaft_entfernen
CREATE OR REPLACE FUNCTION public.mitgliedschaft_entfernen(p_user_id uuid, p_schule_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF public.meine_rolle() IS DISTINCT FROM 'superadmin' THEN RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501'; END IF;
  IF public.meine_rolle() != 'superadmin' THEN
    RAISE EXCEPTION 'Nur Superadmin';
  END IF;

  DELETE FROM public.schul_mitgliedschaften
  WHERE user_id = p_user_id AND schule_id = p_schule_id;
END;
$function$;

-- schule_anlegen
CREATE OR REPLACE FUNCTION public.schule_anlegen(p_name text, p_adresse text DEFAULT ''::text, p_email text DEFAULT ''::text, p_telefon text DEFAULT ''::text, p_farbe text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE v_id uuid;
BEGIN
  IF public.meine_rolle() IS DISTINCT FROM 'superadmin' THEN RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501'; END IF;
  IF public.meine_rolle() != 'superadmin' THEN
    RAISE EXCEPTION 'Nur Superadmin';
  END IF;

  INSERT INTO public.schulen (name, adresse, email, telefon, farbe, aktiv)
  VALUES (p_name, p_adresse, p_email, p_telefon, p_farbe, true)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

-- alle_schulen_stats
CREATE OR REPLACE FUNCTION public.alle_schulen_stats()
 RETURNS TABLE(schule_id uuid, name text, logo_url text, farbe text, mitglieder_anzahl bigint, letzte_aktivitaet timestamp with time zone, aktiv boolean, ist_demo boolean, demo_expires_at timestamp with time zone, plan text, max_lehrer integer, max_schueler integer, max_storage_mb integer, hat_vorstand boolean, hat_inventar boolean, abo_status text, abo_bis date, verein_verifiziert boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
  IF public.meine_rolle() IS DISTINCT FROM 'superadmin' THEN RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501'; END IF;
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
$function$;

-- nutzer_schulen
CREATE OR REPLACE FUNCTION public.nutzer_schulen(p_user_id uuid)
 RETURNS TABLE(schule_id uuid, name text, logo_url text, farbe text, rolle user_rolle, aktiv boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
  IF public.meine_rolle() IS DISTINCT FROM 'superadmin' THEN RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501'; END IF;
  IF public.meine_rolle() != 'superadmin' THEN
    RAISE EXCEPTION 'Nur Superadmin';
  END IF;
  RETURN QUERY
  SELECT sm.schule_id, s.name, s.logo_url, s.farbe, sm.rolle, sm.aktiv
  FROM public.schul_mitgliedschaften sm
  JOIN public.schulen s ON s.id = sm.schule_id
  WHERE sm.user_id = p_user_id
  ORDER BY s.name;
END;
$function$;

-- einladung_versenden
CREATE OR REPLACE FUNCTION public.einladung_versenden(p_email text, p_rolle user_rolle)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_schule_id        uuid := public.meine_schule_id();
  v_einladender_id   uuid := auth.uid();
  v_existing_user_id uuid;
  v_token            uuid;
BEGIN
  IF NOT public.ist_admin_von_schule(public.meine_schule_id()) THEN RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501'; END IF;
  IF public.meine_rolle() NOT IN ('admin', 'superadmin') THEN
    RAISE EXCEPTION 'Nicht berechtigt';
  END IF;

  -- Existierenden Auth-User suchen
  SELECT id INTO v_existing_user_id FROM auth.users WHERE email = lower(p_email);

  IF v_existing_user_id IS NOT NULL THEN
    -- Bereits Mitglied?
    IF EXISTS (
      SELECT 1 FROM public.schul_mitgliedschaften
      WHERE user_id = v_existing_user_id AND schule_id = v_schule_id
    ) THEN
      RETURN jsonb_build_object('action', 'already_member');
    END IF;

    -- Mitgliedschaft direkt anlegen
    INSERT INTO public.schul_mitgliedschaften (user_id, schule_id, rolle, eingeladen_von)
    VALUES (v_existing_user_id, v_schule_id, p_rolle, v_einladender_id)
    ON CONFLICT (user_id, schule_id) DO UPDATE SET rolle = p_rolle, aktiv = true;

    -- Wenn noch keine aktive Schule: setze diese als aktiv
    UPDATE public.profiles
    SET letzte_schule_id = v_schule_id, schule_id = v_schule_id, rolle = p_rolle
    WHERE id = v_existing_user_id AND letzte_schule_id IS NULL;

    RETURN jsonb_build_object(
      'action',  'mitgliedschaft_erstellt',
      'user_id', v_existing_user_id
    );
  ELSE
    -- Einladung erstellen
    INSERT INTO public.schul_einladungen (email, schule_id, rolle, eingeladen_von, token)
    VALUES (lower(p_email), v_schule_id, p_rolle, v_einladender_id, gen_random_uuid())
    RETURNING token INTO v_token;

    RETURN jsonb_build_object(
      'action', 'einladung_erstellt',
      'token',  v_token,
      'email',  lower(p_email)
    );
  END IF;
END;
$function$;

-- einladung_annehmen
CREATE OR REPLACE FUNCTION public.einladung_annehmen(p_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
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

  UPDATE public.schul_einladungen SET status = 'angenommen' WHERE id = v_einladung.id;

  RETURN jsonb_build_object(
    'ok',       true,
    'schule_id', v_einladung.schule_id,
    'rolle',    v_einladung.rolle
  );
END;
$function$;

-- raum_belegung
CREATE OR REPLACE FUNCTION public.raum_belegung(p_raum_id uuid, p_von date DEFAULT CURRENT_DATE, p_bis date DEFAULT (CURRENT_DATE + 7))
 RETURNS TABLE(stunde_id uuid, unterricht_name text, beginn timestamp with time zone, ende timestamp with time zone, lehrer_namen text[])
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  IF auth.uid() IS NULL AND NOT public.ist_intern() THEN RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501'; END IF;
  return query
  select s.id, u.name, s.beginn, s.ende,
    array(select p.voller_name from public.stunden_lehrer sl join public.profiles p on p.id=sl.lehrer_id where sl.stunde_id=s.id)
  from public.stunden s
  join public.unterricht u on u.id=s.unterricht_id
  where s.raum_id=p_raum_id
  and s.beginn::date between p_von and p_bis
  and s.status != 'abgesagt'
  order by s.beginn;
end;
$function$;

-- demo_schule_loeschen
CREATE OR REPLACE FUNCTION public.demo_schule_loeschen(p_schule_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF NOT public.ist_intern() AND public.meine_rolle() IS DISTINCT FROM 'superadmin' THEN RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501'; END IF;
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
$function$;

-- demo_bereinigen
CREATE OR REPLACE FUNCTION public.demo_bereinigen()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_schule_id uuid;
  v_count     integer := 0;
BEGIN
  IF NOT public.ist_intern() AND public.meine_rolle() IS DISTINCT FROM 'superadmin' THEN RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501'; END IF;
  FOR v_schule_id IN
    SELECT id FROM schulen
    WHERE ist_demo = true AND demo_expires_at < now()
  LOOP
    PERFORM demo_schule_loeschen(v_schule_id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$function$;

-- naechste_rechnungsnummer
CREATE OR REPLACE FUNCTION public.naechste_rechnungsnummer(p_schule_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_zaehler integer;
  v_prefix  text;
BEGIN
  IF NOT public.ist_intern() AND NOT public.ist_admin_von_schule(p_schule_id) THEN RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501'; END IF;
  UPDATE public.schulen
  SET    rechnungen_zaehler = rechnungen_zaehler + 1
  WHERE  id = p_schule_id
  RETURNING rechnungen_zaehler, rechnungen_prefix INTO v_zaehler, v_prefix;

  RETURN COALESCE(v_prefix, 'RG')
    || '-' || to_char(now() AT TIME ZONE 'Europe/Berlin', 'YYYY')
    || '-' || lpad(v_zaehler::text, 4, '0');
END;
$function$;

-- dashboard_stats
CREATE OR REPLACE FUNCTION public.dashboard_stats(p_schule_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare v jsonb;
begin
  IF NOT public.ist_intern() AND NOT public.ist_admin_von_schule(p_schule_id) THEN RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501'; END IF;
  select jsonb_build_object(
    'schueler_gesamt',    (select count(*) from public.profiles where schule_id=p_schule_id and rolle='schueler' and aktiv=true),
    'lehrer_gesamt',      (select count(*) from public.profiles where schule_id=p_schule_id and rolle='lehrer' and aktiv=true),
    'unterricht_aktiv',   (select count(*) from public.unterricht where schule_id=p_schule_id and aktiv=true),
    'stunden_heute',      (select count(*) from public.stunden s join public.unterricht u on u.id=s.unterricht_id where u.schule_id=p_schule_id and s.beginn::date=current_date),
    'stunden_woche',      (select count(*) from public.stunden s join public.unterricht u on u.id=s.unterricht_id where u.schule_id=p_schule_id and date_trunc('week',s.beginn)=date_trunc('week',now())),
    'interessenten',      (select count(*) from public.interessenten where schule_id=p_schule_id and status in ('interessent','probe')),
    'einnahmen_monat',    (select coalesce(sum(betrag),0) from public.rechnungen where schule_id=p_schule_id and date_trunc('month',erstellt_am)=date_trunc('month',now()) and bezahlt_am is not null),
    'anwesenheit_quote',  (select round(100.0*count(*) filter(where a.status='anwesend')/nullif(count(*),0),1) from public.anwesenheit a join public.stunden s on s.id=a.stunde_id join public.unterricht u on u.id=s.unterricht_id where u.schule_id=p_schule_id and s.beginn>=now()-interval '30 days'),
    'naechste_events',    (select coalesce(jsonb_agg(jsonb_build_object('id',id,'titel',titel,'beginn',beginn,'typ',typ)),'[]'::jsonb) from (select id,titel,beginn,typ from public.events where schule_id=p_schule_id and beginn>now() order by beginn limit 5) e)
  ) into v;
  return v;
end;
$function$;

-- stunden_generieren
CREATE OR REPLACE FUNCTION public.stunden_generieren(p_unterricht_id uuid, p_von date, p_bis date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_u     record;
  v_tz    text;
  v_datum date;
  v_ziel  integer;
  v_count integer := 0;
  v_sid   uuid;
begin
  IF NOT public.ist_intern()
     AND NOT public.ist_admin_von_schule((SELECT schule_id FROM public.unterricht WHERE id = p_unterricht_id))
     AND NOT public.ist_lehrer_von_unterricht(p_unterricht_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501';
  END IF;
  select * into v_u from public.unterricht where id = p_unterricht_id;
  if v_u.wochentag is null or v_u.uhrzeit_von is null then
    raise exception 'Kein Wochentag/Uhrzeit definiert';
  end if;

  select coalesce(zeitzone, 'Europe/Berlin') into v_tz
  from public.schulen where id = v_u.schule_id;

  v_ziel := case v_u.wochentag
    when 'mo' then 1 when 'di' then 2 when 'mi' then 3
    when 'do' then 4 when 'fr' then 5 when 'sa' then 6 when 'so' then 7
  end;

  v_datum := p_von;
  while extract(isodow from v_datum) != v_ziel loop
    v_datum := v_datum + 1;
  end loop;

  while v_datum <= p_bis loop
    if not exists (
      select 1 from public.stunden
      where unterricht_id = p_unterricht_id
      and date_trunc('day', beginn at time zone v_tz) = v_datum
    ) then
      insert into public.stunden (id, unterricht_id, raum_id, beginn, ende)
      values (
        uuid_generate_v4(), p_unterricht_id, v_u.raum_id,
        (v_datum::text || ' ' || v_u.uhrzeit_von::text)::timestamp at time zone v_tz,
        (v_datum::text || ' ' || v_u.uhrzeit_bis::text)::timestamp at time zone v_tz
      ) returning id into v_sid;

      insert into public.stunden_lehrer (stunde_id, lehrer_id, rolle)
      select v_sid, lehrer_id, rolle
      from public.unterricht_lehrer where unterricht_id = p_unterricht_id;

      v_count := v_count + 1;
    end if;
    v_datum := v_datum + 7;
  end loop;

  return v_count;
end;
$function$;

-- create_unterricht
CREATE OR REPLACE FUNCTION public.create_unterricht(p_name text, p_typ unterricht_typ, p_instrument_id uuid, p_lehrer_ids uuid[], p_raum_id uuid DEFAULT NULL::uuid, p_wochentag wochentag DEFAULT NULL::wochentag, p_uhrzeit_von time without time zone DEFAULT NULL::time without time zone, p_uhrzeit_bis time without time zone DEFAULT NULL::time without time zone, p_abrechnungs_typ abrechnungs_typ DEFAULT 'einzeln'::abrechnungs_typ, p_preis numeric DEFAULT NULL::numeric, p_schule_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_id    uuid;
  v_lid   uuid;
  v_idx   integer := 0;
begin
  IF NOT public.ist_intern()
     AND NOT public.ist_admin_von_schule(p_schule_id)
     AND NOT (public.meine_rolle() = 'lehrer'
              AND p_schule_id = public.meine_schule_id()
              AND COALESCE((SELECT kann_kurse_anlegen FROM public.profiles WHERE id = auth.uid()), false)) THEN
    RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501';
  END IF;
  insert into public.unterricht (
    name, typ, instrument_id, raum_id,
    wochentag, uhrzeit_von, uhrzeit_bis,
    abrechnungs_typ, preis_pro_stunde, schule_id
  ) values (
    p_name, p_typ, p_instrument_id, p_raum_id,
    p_wochentag, p_uhrzeit_von, p_uhrzeit_bis,
    p_abrechnungs_typ, p_preis, p_schule_id
  ) returning id into v_id;

  foreach v_lid in array p_lehrer_ids loop
    insert into public.unterricht_lehrer (unterricht_id, lehrer_id, rolle) values (
      v_id, v_lid,
      case when v_idx = 0 then 'hauptlehrer'::lehrer_rolle_typ else 'co_lehrer'::lehrer_rolle_typ end
    );
    v_idx := v_idx + 1;
  end loop;

  return v_id;
end;
$function$;

-- anwesenheit_erfassen
CREATE OR REPLACE FUNCTION public.anwesenheit_erfassen(p_stunde_id uuid, p_schueler jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_e jsonb;
begin
  IF NOT public.ist_intern() AND NOT EXISTS (
       SELECT 1 FROM public.stunden s JOIN public.unterricht u ON u.id = s.unterricht_id
       WHERE s.id = p_stunde_id
         AND (public.ist_admin_von_schule(u.schule_id)
              OR public.ist_lehrer_von_unterricht(u.id)
              OR EXISTS (SELECT 1 FROM public.stunden_lehrer sl WHERE sl.stunde_id = s.id AND sl.lehrer_id = auth.uid())))
  THEN
    RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501';
  END IF;
  for v_e in select * from jsonb_array_elements(p_schueler) loop
    insert into public.anwesenheit (stunde_id, schueler_id, status, notiz, fortschritt, erfasst_von)
    values (
      p_stunde_id,
      (v_e->>'id')::uuid,
      coalesce((v_e->>'status')::anwesenheit_status, 'anwesend'),
      v_e->>'notiz',
      (v_e->>'fortschritt')::lernfortschritt,
      auth.uid()
    )
    on conflict (stunde_id, schueler_id) do update
      set status      = excluded.status,
          notiz       = excluded.notiz,
          fortschritt = excluded.fortschritt,
          erfasst_von = excluded.erfasst_von,
          erfasst_am  = now();
  end loop;
  update public.stunden set status = 'stattgefunden' where id = p_stunde_id;
end;
$function$;

-- paket_stunde_verbrauchen
CREATE OR REPLACE FUNCTION public.paket_stunde_verbrauchen(p_schueler_id uuid, p_unterricht_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare v_id uuid;
begin
  IF NOT public.ist_intern()
     AND NOT public.ist_admin_von_schule((SELECT schule_id FROM public.unterricht WHERE id = p_unterricht_id))
     AND NOT public.ist_lehrer_von_unterricht(p_unterricht_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501';
  END IF;
  select id into v_id from public.pakete
  where schueler_id = p_schueler_id
  and unterricht_id = p_unterricht_id
  and stunden_genutzt < stunden_gesamt
  and (gueltig_bis is null or gueltig_bis >= current_date)
  order by gekauft_am limit 1;

  if v_id is null then return false; end if;
  update public.pakete set stunden_genutzt = stunden_genutzt + 1 where id = v_id;
  return true;
end;
$function$;

-- handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_schule_id uuid;
BEGIN
  -- Rolle nie aus user_metadata übernehmen: die ist bei der öffentlichen Registrierung frei wählbar.
  -- Alle Stellen, die Nutzer anlegen (create_user, accept-invitation, demo-genehmigen), setzen die Rolle danach selbst.
  v_schule_id := COALESCE(
    (new.raw_user_meta_data->>'schule_id')::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid
  );

  INSERT INTO public.profiles (id, voller_name, rolle, schule_id, letzte_schule_id)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'voller_name', split_part(new.email,'@',1)),
    'schueler'::public.user_rolle,
    v_schule_id,
    v_schule_id
  )
  ON CONFLICT (id) DO UPDATE
    SET voller_name = excluded.voller_name;

  RETURN new;
END;
$function$;

-- ── Profil-Schutz ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.profil_schutz()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_rolle public.user_rolle := public.meine_rolle();
BEGIN
  -- Interne Aufrufe (service_role, GoTrue, cron) und superadmin nicht einschränken
  IF public.ist_intern() OR v_rolle = 'superadmin' THEN
    RETURN NEW;
  END IF;

  -- Keine geschützte Spalte geändert → normales Profil-Update
  IF TG_OP = 'UPDATE'
     AND NEW.rolle              IS NOT DISTINCT FROM OLD.rolle
     AND NEW.schule_id          IS NOT DISTINCT FROM OLD.schule_id
     AND NEW.letzte_schule_id   IS NOT DISTINCT FROM OLD.letzte_schule_id
     AND NEW.aktiv              IS NOT DISTINCT FROM OLD.aktiv
     AND NEW.kann_kurse_anlegen IS NOT DISTINCT FROM OLD.kann_kurse_anlegen THEN
    RETURN NEW;
  END IF;

  IF NEW.rolle = 'superadmin' OR (TG_OP = 'UPDATE' AND OLD.rolle = 'superadmin') THEN
    RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501';
  END IF;

  -- Admin verwaltet Mitglieder seiner Schule
  IF NEW.id <> auth.uid()
     AND public.ist_admin_von_schule(NEW.schule_id)
     AND (TG_OP = 'INSERT' OR public.ist_admin_von_schule(OLD.schule_id)) THEN
    RETURN NEW;
  END IF;

  -- Schulwechsel / Einladung annehmen: Rolle + Schule passen zu einer aktiven Mitgliedschaft
  IF TG_OP = 'UPDATE' AND NEW.id = auth.uid()
     AND NEW.aktiv              IS NOT DISTINCT FROM OLD.aktiv
     AND NEW.kann_kurse_anlegen IS NOT DISTINCT FROM OLD.kann_kurse_anlegen
     AND EXISTS (SELECT 1 FROM public.schul_mitgliedschaften m
                 WHERE m.user_id = NEW.id AND m.aktiv
                   AND m.schule_id = COALESCE(NEW.letzte_schule_id, NEW.schule_id)
                   AND m.rolle = NEW.rolle) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Keine Berechtigung, Rolle/Schule/Status zu ändern' USING ERRCODE = '42501';
END;
$function$;

DROP TRIGGER IF EXISTS profil_schutz_trigger ON public.profiles;
CREATE TRIGGER profil_schutz_trigger
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profil_schutz();
