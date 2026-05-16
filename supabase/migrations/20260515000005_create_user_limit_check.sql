-- create_user() mit Plan-Limit-Check für lehrer und schueler

CREATE OR REPLACE FUNCTION public.create_user(
  p_email       text,
  p_passwort    text,
  p_voller_name text,
  p_rolle       public.user_rolle,
  p_schule_id   uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id    uuid := gen_random_uuid();
  v_max_lehrer  int;
  v_max_schueler int;
  v_count       int;
BEGIN
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
$$;
