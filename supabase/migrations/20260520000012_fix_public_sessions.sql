-- Fix public sessions: 3 bugs

-- 1. Drop old session_beitreten(text) overload — replaced by (text, text) in 20260506000001
DROP FUNCTION IF EXISTS session_beitreten(text);

-- 2. Fix session_beenden: exclude guests (profil_id IS NULL) from auto-attendance
CREATE OR REPLACE FUNCTION session_beenden(
  p_session_id uuid,
  p_anwesenheit jsonb DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
declare
  v_stunde_id uuid;
begin
  update public.unterricht_sessions
  set status = 'beendet', beendet_am = now()
  where id = p_session_id and lehrer_id = auth.uid()
  returning stunde_id into v_stunde_id;

  if v_stunde_id is not null then
    if p_anwesenheit is not null then
      perform public.anwesenheit_erfassen(v_stunde_id, p_anwesenheit);
    else
      insert into public.anwesenheit (stunde_id, schueler_id, status, erfasst_von)
      select v_stunde_id, profil_id, 'anwesend', auth.uid()
      from public.session_teilnehmer
      where session_id = p_session_id
        and profil_id is not null
      on conflict (stunde_id, schueler_id) do nothing;

      update public.stunden set status = 'stattgefunden' where id = v_stunde_id;
    end if;
  end if;
end;
$$;

-- 3. Allow anon to read stueck_dateien for the currently presented piece in a public session
DROP POLICY IF EXISTS "sdf: anon öffentlich lesen" ON stueck_dateien;

CREATE POLICY "sdf: anon öffentlich lesen"
  ON stueck_dateien FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM unterricht_sessions
      WHERE aktuelles_stueck = stueck_dateien.stueck_id
        AND oeffentlich = true
        AND status = 'aktiv'
    )
  );
