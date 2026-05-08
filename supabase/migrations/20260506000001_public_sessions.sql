-- Public sessions: allow unauthenticated (guest) participants

-- 1. Add oeffentlich flag to unterricht_sessions
ALTER TABLE unterricht_sessions ADD COLUMN IF NOT EXISTS oeffentlich boolean DEFAULT false;

-- 2. Restructure session_teilnehmer to allow guests (profil_id nullable)
--    Drop old PK (session_id, profil_id) and replace with uuid PK
ALTER TABLE session_teilnehmer DROP CONSTRAINT session_teilnehmer_pkey;
ALTER TABLE session_teilnehmer DROP CONSTRAINT session_teilnehmer_profil_id_fkey;
ALTER TABLE session_teilnehmer ALTER COLUMN profil_id DROP NOT NULL;
ALTER TABLE session_teilnehmer ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE session_teilnehmer ADD CONSTRAINT session_teilnehmer_pkey PRIMARY KEY (id);
ALTER TABLE session_teilnehmer ADD CONSTRAINT session_teilnehmer_profil_id_fkey
  FOREIGN KEY (profil_id) REFERENCES profiles(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX session_teilnehmer_session_profil_unique
  ON session_teilnehmer(session_id, profil_id) WHERE profil_id IS NOT NULL;

-- 3. Update session_starten to accept p_oeffentlich
CREATE OR REPLACE FUNCTION session_starten(
  p_unterricht_id uuid,
  p_stunde_id uuid DEFAULT NULL,
  p_oeffentlich boolean DEFAULT false
) RETURNS TABLE(session_id uuid, join_code text)
LANGUAGE plpgsql SECURITY DEFINER AS $$
declare
  v_id   uuid;
  v_code text;
begin
  update public.unterricht_sessions
  set status = 'beendet', beendet_am = now()
  where unterricht_id = p_unterricht_id
    and lehrer_id = auth.uid()
    and status = 'aktiv';

  insert into public.unterricht_sessions (
    unterricht_id, stunde_id, lehrer_id, schule_id, status, oeffentlich
  ) values (
    p_unterricht_id, p_stunde_id, auth.uid(),
    (select schule_id from public.profiles where id = auth.uid()),
    'aktiv', p_oeffentlich
  ) returning unterricht_sessions.id, unterricht_sessions.join_code into v_id, v_code;

  return query select v_id, v_code;
end;
$$;

-- 4. Update session_beitreten to allow guests in public sessions
CREATE OR REPLACE FUNCTION session_beitreten(
  p_join_code text,
  p_gast_name text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
declare
  v_session_id  uuid;
  v_oeffentlich boolean;
  v_user_id     uuid;
begin
  v_user_id := auth.uid();

  select id, oeffentlich into v_session_id, v_oeffentlich
  from public.unterricht_sessions
  where upper(join_code) = upper(p_join_code)
    and status = 'aktiv';

  if v_session_id is null then
    raise exception 'Session nicht gefunden oder nicht aktiv';
  end if;

  if v_user_id is null and not v_oeffentlich then
    raise exception 'Diese Session erfordert einen Login';
  end if;

  if v_user_id is null and (p_gast_name is null or trim(p_gast_name) = '') then
    raise exception 'Bitte gib deinen Namen ein';
  end if;

  if v_user_id is not null then
    insert into public.session_teilnehmer (session_id, profil_id, gast_name)
    values (v_session_id, v_user_id, null)
    on conflict (session_id, profil_id) where profil_id is not null
    do update set zuletzt_aktiv = now();
  else
    insert into public.session_teilnehmer (session_id, profil_id, gast_name)
    values (v_session_id, null, trim(p_gast_name));
  end if;

  return v_session_id;
end;
$$;

-- 5. Grant anon role permission to call session_beitreten
GRANT EXECUTE ON FUNCTION session_beitreten(text, text) TO anon;

-- 6. RLS policies for anon access

-- Allow anon to read active public sessions (needed for realtime + state reads)
CREATE POLICY "sess: anon öffentlich lesen"
  ON unterricht_sessions FOR SELECT TO anon
  USING (oeffentlich = true AND status = 'aktiv');

-- Allow anon to read pieces in active public sessions
CREATE POLICY "stk: anon öffentlich lesen"
  ON stuecke FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM unterricht_stuecke us
      JOIN unterricht_sessions sess ON sess.unterricht_id = us.unterricht_id
      WHERE us.stueck_id = stuecke.id
        AND sess.oeffentlich = true
        AND sess.status = 'aktiv'
    )
  );

-- Allow anon to send reactions in public sessions
CREATE POLICY "reak: anon senden"
  ON session_reaktionen FOR INSERT TO anon
  WITH CHECK (
    profil_id IS NULL AND
    EXISTS (
      SELECT 1 FROM unterricht_sessions
      WHERE id = session_id AND oeffentlich = true AND status = 'aktiv'
    )
  );

-- Allow anon to read participants of public sessions (for realtime)
CREATE POLICY "steil: anon öffentlich lesen"
  ON session_teilnehmer FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM unterricht_sessions
      WHERE id = session_teilnehmer.session_id AND oeffentlich = true
    )
  );
