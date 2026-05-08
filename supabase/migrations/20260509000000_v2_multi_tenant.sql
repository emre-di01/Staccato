-- ══════════════════════════════════════════════════════════════
-- V2 Multi-Tenancy Foundation
-- ══════════════════════════════════════════════════════════════

-- ── 1. Profiles: letzte_schule_id ─────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS letzte_schule_id uuid REFERENCES public.schulen(id) ON DELETE SET NULL;

-- Migrate existing: set letzte_schule_id = schule_id
UPDATE public.profiles SET letzte_schule_id = schule_id WHERE schule_id IS NOT NULL AND letzte_schule_id IS NULL;

-- ── 2. schul_mitgliedschaften ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.schul_mitgliedschaften (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  schule_id       uuid        NOT NULL REFERENCES public.schulen(id) ON DELETE CASCADE,
  rolle           public.user_rolle NOT NULL,
  aktiv           boolean     DEFAULT true,
  beigetreten_am  timestamptz DEFAULT now(),
  eingeladen_von  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  UNIQUE (user_id, schule_id)
);

CREATE INDEX IF NOT EXISTS schul_mitgliedschaften_user_idx   ON public.schul_mitgliedschaften (user_id);
CREATE INDEX IF NOT EXISTS schul_mitgliedschaften_schule_idx ON public.schul_mitgliedschaften (schule_id);

-- Migrate existing memberships from profiles.schule_id
INSERT INTO public.schul_mitgliedschaften (user_id, schule_id, rolle, aktiv, beigetreten_am)
SELECT id, schule_id, rolle, aktiv, erstellt_am
FROM public.profiles
WHERE schule_id IS NOT NULL
ON CONFLICT (user_id, schule_id) DO NOTHING;

-- ── 3. schul_einladungen ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.schul_einladungen (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  email          text        NOT NULL,
  schule_id      uuid        NOT NULL REFERENCES public.schulen(id) ON DELETE CASCADE,
  rolle          public.user_rolle NOT NULL,
  token          uuid        DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  eingeladen_von uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  erstellt_am    timestamptz DEFAULT now(),
  ablauf_am      timestamptz DEFAULT now() + interval '7 days',
  status         text        DEFAULT 'offen'
                             CHECK (status = ANY (ARRAY['offen','angenommen','abgelaufen']))
);

CREATE INDEX IF NOT EXISTS schul_einladungen_email_idx  ON public.schul_einladungen (email);
CREATE INDEX IF NOT EXISTS schul_einladungen_token_idx  ON public.schul_einladungen (token);
CREATE INDEX IF NOT EXISTS schul_einladungen_schule_idx ON public.schul_einladungen (schule_id);

-- ── 4. schulen: farbe-Spalte sicherstellen ─────────────────────

ALTER TABLE public.schulen ADD COLUMN IF NOT EXISTS farbe text;

-- ── 5. meine_schule_id() — liest jetzt letzte_schule_id ────────

CREATE OR REPLACE FUNCTION public.meine_schule_id()
  RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS
$$ SELECT COALESCE(letzte_schule_id, schule_id) FROM public.profiles WHERE id = auth.uid(); $$;

CREATE OR REPLACE FUNCTION public.meine_schule()
  RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS
$$ SELECT COALESCE(letzte_schule_id, schule_id) FROM public.profiles WHERE id = auth.uid(); $$;

-- ── 6. create_user() — schreibt auch Mitgliedschaft ────────────

CREATE OR REPLACE FUNCTION public.create_user(
  p_email       text,
  p_passwort    text,
  p_voller_name text,
  p_rolle       public.user_rolle,
  p_schule_id   uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id uuid := gen_random_uuid();
BEGIN
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

-- ── 7. handle_new_user() — setzt auch letzte_schule_id ─────────

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_schule_id uuid;
BEGIN
  v_schule_id := COALESCE(
    (new.raw_user_meta_data->>'schule_id')::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid
  );

  INSERT INTO public.profiles (id, voller_name, rolle, schule_id, letzte_schule_id)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'voller_name', split_part(new.email,'@',1)),
    COALESCE((new.raw_user_meta_data->>'rolle')::public.user_rolle, 'schueler'),
    v_schule_id,
    v_schule_id
  )
  ON CONFLICT (id) DO UPDATE
    SET voller_name      = excluded.voller_name,
        rolle            = excluded.rolle,
        letzte_schule_id = excluded.letzte_schule_id;

  RETURN new;
END;
$$;

-- ── 8. schule_wechseln() ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.schule_wechseln(p_schule_id uuid)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_neue_rolle     public.user_rolle;
  v_aktuelle_rolle public.user_rolle := public.meine_rolle();
BEGIN
  IF v_aktuelle_rolle = 'superadmin' THEN
    -- Superadmin kann zu jeder Schule wechseln
    UPDATE public.profiles
    SET letzte_schule_id = p_schule_id, schule_id = p_schule_id
    WHERE id = auth.uid();
  ELSE
    SELECT rolle INTO v_neue_rolle
    FROM public.schul_mitgliedschaften
    WHERE user_id = auth.uid() AND schule_id = p_schule_id AND aktiv = true;

    IF v_neue_rolle IS NULL THEN
      RAISE EXCEPTION 'Keine aktive Mitgliedschaft in dieser Schule';
    END IF;

    UPDATE public.profiles
    SET letzte_schule_id = p_schule_id,
        schule_id        = p_schule_id,
        rolle            = v_neue_rolle
    WHERE id = auth.uid();
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.schule_wechseln(uuid) TO authenticated;

-- ── 9. meine_schulen() ────────────────────────────────────────

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

-- ── 10. einladung_details() — öffentlich per Token ────────────

CREATE OR REPLACE FUNCTION public.einladung_details(p_token uuid)
  RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_row record;
BEGIN
  SELECT
    ei.id, ei.email, ei.status, ei.ablauf_am, ei.rolle,
    s.name  AS schule_name,
    s.logo_url
  INTO v_row
  FROM public.schul_einladungen ei
  JOIN public.schulen s ON s.id = ei.schule_id
  WHERE ei.token = p_token;

  IF v_row IS NULL THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'id',          v_row.id,
    'email',       v_row.email,
    'status',      v_row.status,
    'ablauf_am',   v_row.ablauf_am,
    'rolle',       v_row.rolle,
    'schule_name', v_row.schule_name,
    'logo_url',    v_row.logo_url
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.einladung_details(uuid) TO anon, authenticated;

-- ── 11. einladung_versenden() ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.einladung_versenden(p_email text, p_rolle public.user_rolle)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_schule_id        uuid := public.meine_schule_id();
  v_einladender_id   uuid := auth.uid();
  v_existing_user_id uuid;
  v_token            uuid;
BEGIN
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
$$;

GRANT EXECUTE ON FUNCTION public.einladung_versenden(text, public.user_rolle) TO authenticated;

-- ── 12. einladung_annehmen() — für eingeloggte User ───────────

CREATE OR REPLACE FUNCTION public.einladung_annehmen(p_token uuid)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_einladung  record;
  v_user_email text;
BEGIN
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
$$;

GRANT EXECUTE ON FUNCTION public.einladung_annehmen(uuid) TO authenticated;

-- ── 13. alle_schulen_stats() — nur Superadmin ─────────────────

CREATE OR REPLACE FUNCTION public.alle_schulen_stats()
  RETURNS TABLE(
    schule_id          uuid,
    name               text,
    logo_url           text,
    farbe              text,
    mitglieder_anzahl  bigint,
    letzte_aktivitaet  timestamptz,
    aktiv              boolean
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
    s.aktiv
  FROM public.schulen s
  ORDER BY s.name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.alle_schulen_stats() TO authenticated;

-- ── 14. schule_anlegen() — nur Superadmin ─────────────────────

CREATE OR REPLACE FUNCTION public.schule_anlegen(
  p_name    text,
  p_adresse text DEFAULT '',
  p_email   text DEFAULT '',
  p_telefon text DEFAULT '',
  p_farbe   text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_id uuid;
BEGIN
  IF public.meine_rolle() != 'superadmin' THEN
    RAISE EXCEPTION 'Nur Superadmin';
  END IF;

  INSERT INTO public.schulen (name, adresse, email, telefon, farbe, aktiv)
  VALUES (p_name, p_adresse, p_email, p_telefon, p_farbe, true)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.schule_anlegen(text, text, text, text, text) TO authenticated;

-- ── 15. RLS: schul_mitgliedschaften ───────────────────────────

ALTER TABLE public.schul_mitgliedschaften ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sm: lesen" ON public.schul_mitgliedschaften
  FOR SELECT USING (
    user_id = auth.uid()
    OR (public.meine_rolle() IN ('admin','superadmin') AND schule_id = public.meine_schule_id())
  );

-- Schreibzugriff nur via SECURITY DEFINER Funktionen — keine direkten DML-Policies nötig

-- ── 16. RLS: schul_einladungen ────────────────────────────────

ALTER TABLE public.schul_einladungen ENABLE ROW LEVEL SECURITY;

-- Admin/Superadmin kann Einladungen ihrer Schule sehen
CREATE POLICY "einladung: admin lesen" ON public.schul_einladungen
  FOR SELECT USING (
    public.meine_rolle() IN ('admin','superadmin')
    AND schule_id = public.meine_schule_id()
  );

-- Superadmin kann alles sehen
CREATE POLICY "einladung: superadmin" ON public.schul_einladungen
  FOR SELECT USING (public.meine_rolle() = 'superadmin');
