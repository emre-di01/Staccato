-- Live-Stunde: Kurslehrer und Schul-Admins dürfen eine fortgesetzte Sitzung steuern und beenden, nicht nur wer sie gestartet hat.
-- Bisher lief session_beenden für andere Lehrkräfte ohne Fehler ins Leere: Sitzung blieb aktiv, Anwesenheit wurde nicht eingetragen.

CREATE OR REPLACE FUNCTION public.session_beenden(
  p_session_id uuid,
  p_anwesenheit jsonb DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
declare
  v_stunde_id uuid;
begin
  update public.unterricht_sessions us
  set status = 'beendet', beendet_am = now()
  where us.id = p_session_id
    and (us.lehrer_id = auth.uid()
         or public.ist_lehrer_von_unterricht(us.unterricht_id)
         or public.ist_admin_von_schule((select u.schule_id from public.unterricht u where u.id = us.unterricht_id)))
  returning us.stunde_id into v_stunde_id;

  if not found then
    raise exception 'Session nicht gefunden oder keine Berechtigung' using errcode = '42501';
  end if;

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

CREATE OR REPLACE FUNCTION public.session_praesentation_wechseln(
  p_session_id uuid,
  p_ansicht public.praesentation_typ,
  p_stueck_id uuid DEFAULT NULL,
  p_datei_id uuid DEFAULT NULL,
  p_scroll_position integer DEFAULT 0,
  p_youtube_ts integer DEFAULT 0
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
begin
  update public.unterricht_sessions us
  set
    aktuelle_ansicht  = p_ansicht,
    aktuelles_stueck  = p_stueck_id,
    aktuelle_datei    = p_datei_id,
    scroll_position   = p_scroll_position,
    youtube_timestamp = p_youtube_ts
  where us.id = p_session_id
    and (us.lehrer_id = auth.uid()
         or public.ist_lehrer_von_unterricht(us.unterricht_id)
         or public.ist_admin_von_schule((select u.schule_id from public.unterricht u where u.id = us.unterricht_id)));

  if not found then
    raise exception 'Session nicht gefunden oder keine Berechtigung';
  end if;
end;
$$;
