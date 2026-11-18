-- QR-Einchecken: Schüler scannen in der App einen Raum-Code (Aufkleber im Raum) oder den wechselnden
-- Code aus Live-Unterricht/Beamer und sind damit für die Stunde anwesend.
--
-- Raum-Codes:     fest pro Raum, neu erzeugbar; gültig nur 15 min vor bis 20 min nach Stundenbeginn.
-- Wechselnde Codes: von der Lehrkraft im Live-Unterricht alle 30 s neu erzeugt, je 90 s gültig.
-- Beide Tabellen haben RLS ohne Policies: Zugriff nur über die SECURITY-DEFINER-Funktionen unten,
-- sonst könnten Schüler den Raum-Code per API lesen und von zu Hause einchecken.
-- Die Lehrkraft hat das letzte Wort: anwesenheit_erfassen() überschreibt Check-ins, eingecheckt_am bleibt als Hinweis.

ALTER TABLE public.anwesenheit ADD COLUMN IF NOT EXISTS eingecheckt_am timestamptz;

CREATE TABLE IF NOT EXISTS public.raum_checkin (
  raum_id  uuid PRIMARY KEY REFERENCES public.raeume(id) ON DELETE CASCADE,
  token    text NOT NULL UNIQUE,
  erstellt_am timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.raum_checkin ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.stunde_checkin_codes (
  token       text PRIMARY KEY,
  stunde_id   uuid NOT NULL REFERENCES public.stunden(id) ON DELETE CASCADE,
  gueltig_bis timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS stunde_checkin_codes_gueltig_idx ON public.stunde_checkin_codes (gueltig_bis);
ALTER TABLE public.stunde_checkin_codes ENABLE ROW LEVEL SECURITY;

-- Raum-Code lesen bzw. neu erzeugen (nur Admins der Schule des Raums)
CREATE OR REPLACE FUNCTION public.raum_checkin_token(p_raum_id uuid, p_neu boolean DEFAULT false)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
  v_schule uuid;
  v_token text;
begin
  select schule_id into v_schule from public.raeume where id = p_raum_id;
  if v_schule is null or not public.ist_admin_von_schule(v_schule) then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  if not p_neu then
    select token into v_token from public.raum_checkin where raum_id = p_raum_id;
    if v_token is not null then return v_token; end if;
  end if;
  v_token := replace(gen_random_uuid()::text, '-', '');
  insert into public.raum_checkin (raum_id, token) values (p_raum_id, v_token)
  on conflict (raum_id) do update set token = excluded.token, erstellt_am = now();
  return v_token;
end;
$$;

-- Wechselnden Code für eine Stunde erzeugen (Kurslehrer, Co-Lehrer der Stunde, Admins)
CREATE OR REPLACE FUNCTION public.checkin_code_erzeugen(p_stunde_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
  v_unterricht uuid;
  v_schule uuid;
  v_token text;
begin
  select s.unterricht_id, u.schule_id into v_unterricht, v_schule
  from public.stunden s join public.unterricht u on u.id = s.unterricht_id
  where s.id = p_stunde_id;
  if v_unterricht is null or not (
       public.ist_lehrer_von_unterricht(v_unterricht)
    or exists (select 1 from public.stunden_lehrer sl where sl.stunde_id = p_stunde_id and sl.lehrer_id = auth.uid())
    or public.ist_admin_von_schule(v_schule)) then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  delete from public.stunde_checkin_codes where gueltig_bis < now();
  v_token := replace(gen_random_uuid()::text, '-', '');
  insert into public.stunde_checkin_codes (token, stunde_id, gueltig_bis) values (v_token, p_stunde_id, now() + interval '90 seconds');
  return v_token;
end;
$$;

-- Einchecken. p_art: 'raum' (fester Raum-Code) oder 'stunde' (wechselnder Code).
-- Ergebnis: { ok, grund?, status?, kurs?, beginn?, stunde_id?, schon? }
-- grund: ungueltig | abgelaufen | keine_stunde | nicht_im_kurs | schon_erfasst
CREATE OR REPLACE FUNCTION public.einchecken(p_art text, p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
  v_ich uuid := auth.uid();
  v_raum uuid;
  v_stunde record;
  v_vorhanden record;
  v_status anwesenheit_status;
begin
  if v_ich is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;

  if p_art = 'raum' then
    select raum_id into v_raum from public.raum_checkin where token = p_token;
    if v_raum is null then return jsonb_build_object('ok', false, 'grund', 'ungueltig'); end if;

    -- Stunden in diesem Raum im Zeitfenster; eigene Kurse zuerst, dann die nächstliegende
    select s.id, s.beginn, s.ende, u.name,
           exists (select 1 from public.unterricht_schueler us
                   where us.unterricht_id = u.id and us.schueler_id = v_ich and us.status in ('aktiv', 'probe')) as im_kurs
      into v_stunde
    from public.stunden s
    join public.unterricht u on u.id = s.unterricht_id
    join public.raeume r on r.id = v_raum
    where coalesce(s.raum_id, u.raum_id) = v_raum
      and u.schule_id = r.schule_id
      and s.status in ('geplant', 'stattgefunden')
      and now() between s.beginn - interval '15 minutes' and least(s.beginn + interval '20 minutes', s.ende)
    order by 5 desc, abs(extract(epoch from (s.beginn - now())))
    limit 1;
    if not found then return jsonb_build_object('ok', false, 'grund', 'keine_stunde'); end if;

  elsif p_art = 'stunde' then
    select s.id, s.beginn, s.ende, u.name,
           exists (select 1 from public.unterricht_schueler us
                   where us.unterricht_id = u.id and us.schueler_id = v_ich and us.status in ('aktiv', 'probe')) as im_kurs,
           c.gueltig_bis
      into v_stunde
    from public.stunde_checkin_codes c
    join public.stunden s on s.id = c.stunde_id
    join public.unterricht u on u.id = s.unterricht_id
    where c.token = p_token;
    if not found then return jsonb_build_object('ok', false, 'grund', 'ungueltig'); end if;
    if v_stunde.gueltig_bis < now() then return jsonb_build_object('ok', false, 'grund', 'abgelaufen'); end if;
    if now() < v_stunde.beginn - interval '15 minutes' or now() > v_stunde.ende then
      return jsonb_build_object('ok', false, 'grund', 'keine_stunde');
    end if;

  else
    return jsonb_build_object('ok', false, 'grund', 'ungueltig');
  end if;

  if not v_stunde.im_kurs then
    return jsonb_build_object('ok', false, 'grund', 'nicht_im_kurs', 'kurs', v_stunde.name);
  end if;

  v_status := case when now() > v_stunde.beginn + interval '10 minutes' then 'zu_spaet' else 'anwesend' end;

  select status, erfasst_von, eingecheckt_am into v_vorhanden
  from public.anwesenheit where stunde_id = v_stunde.id and schueler_id = v_ich;

  if found then
    -- Schon eingecheckt: nichts ändern
    if v_vorhanden.eingecheckt_am is not null then
      return jsonb_build_object('ok', true, 'schon', true, 'status', v_vorhanden.status, 'kurs', v_stunde.name, 'beginn', v_stunde.beginn, 'stunde_id', v_stunde.id);
    end if;
    -- Von Lehrkraft oder Live-Stunde erfasst: deren Eintrag bleibt
    if v_vorhanden.erfasst_von is not null and v_vorhanden.erfasst_von <> v_ich then
      return jsonb_build_object('ok', false, 'grund', 'schon_erfasst', 'status', v_vorhanden.status, 'kurs', v_stunde.name);
    end if;
    -- Eigene Absage: doch gekommen
    update public.anwesenheit set status = v_status, eingecheckt_am = now(), erfasst_am = now()
    where stunde_id = v_stunde.id and schueler_id = v_ich;
  else
    insert into public.anwesenheit (stunde_id, schueler_id, status, eingecheckt_am)
    values (v_stunde.id, v_ich, v_status, now());
  end if;

  return jsonb_build_object('ok', true, 'status', v_status, 'kurs', v_stunde.name, 'beginn', v_stunde.beginn, 'stunde_id', v_stunde.id);
end;
$$;
