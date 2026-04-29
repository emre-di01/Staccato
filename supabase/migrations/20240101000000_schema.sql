


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."abrechnungs_typ" AS ENUM (
    'einzeln',
    'paket',
    'pauschale'
);


ALTER TYPE "public"."abrechnungs_typ" OWNER TO "postgres";


CREATE TYPE "public"."anwesenheit_status" AS ENUM (
    'anwesend',
    'abwesend',
    'entschuldigt',
    'zu_spaet'
);


ALTER TYPE "public"."anwesenheit_status" OWNER TO "postgres";


CREATE TYPE "public"."datei_typ" AS ENUM (
    'noten',
    'akkorde',
    'audio',
    'video',
    'dokument',
    'sonstiges'
);


ALTER TYPE "public"."datei_typ" OWNER TO "postgres";


CREATE TYPE "public"."event_typ" AS ENUM (
    'konzert',
    'vorspiel',
    'pruefung',
    'veranstaltung',
    'sonstiges'
);


ALTER TYPE "public"."event_typ" OWNER TO "postgres";


CREATE TYPE "public"."lehrer_rolle_typ" AS ENUM (
    'hauptlehrer',
    'co_lehrer',
    'vertretung'
);


ALTER TYPE "public"."lehrer_rolle_typ" OWNER TO "postgres";


CREATE TYPE "public"."lernfortschritt" AS ENUM (
    'sehr_gut',
    'gut',
    'befriedigend',
    'ausreichend',
    'mangelhaft'
);


ALTER TYPE "public"."lernfortschritt" OWNER TO "postgres";


CREATE TYPE "public"."nachricht_typ" AS ENUM (
    'broadcast',
    'direkt'
);


ALTER TYPE "public"."nachricht_typ" OWNER TO "postgres";


CREATE TYPE "public"."praesentation_typ" AS ENUM (
    'noten',
    'liedtext',
    'akkorde',
    'youtube',
    'dateiverwaltung'
);


ALTER TYPE "public"."praesentation_typ" OWNER TO "postgres";


CREATE TYPE "public"."reaktion_typ" AS ENUM (
    'daumen_hoch',
    'daumen_runter',
    'hand_hoch',
    'herz',
    'verwirrung'
);


ALTER TYPE "public"."reaktion_typ" OWNER TO "postgres";


CREATE TYPE "public"."schueler_status" AS ENUM (
    'interessent',
    'probe',
    'aktiv',
    'pausiert',
    'abgemeldet'
);


ALTER TYPE "public"."schueler_status" OWNER TO "postgres";


CREATE TYPE "public"."session_status" AS ENUM (
    'wartend',
    'aktiv',
    'beendet'
);


ALTER TYPE "public"."session_status" OWNER TO "postgres";


CREATE TYPE "public"."sprache" AS ENUM (
    'de',
    'en',
    'tr'
);


ALTER TYPE "public"."sprache" OWNER TO "postgres";


CREATE TYPE "public"."stimmgruppe_typ" AS ENUM (
    'sopran',
    'alt',
    'tenor',
    'bass',
    'keine'
);


ALTER TYPE "public"."stimmgruppe_typ" OWNER TO "postgres";


CREATE TYPE "public"."termin_status" AS ENUM (
    'geplant',
    'stattgefunden',
    'abgesagt',
    'verschoben'
);


ALTER TYPE "public"."termin_status" OWNER TO "postgres";


CREATE TYPE "public"."unterricht_typ" AS ENUM (
    'einzel',
    'gruppe',
    'chor',
    'ensemble'
);


ALTER TYPE "public"."unterricht_typ" OWNER TO "postgres";


CREATE TYPE "public"."user_rolle" AS ENUM (
    'superadmin',
    'admin',
    'lehrer',
    'schueler',
    'eltern'
);


ALTER TYPE "public"."user_rolle" OWNER TO "postgres";


CREATE TYPE "public"."wochentag" AS ENUM (
    'mo',
    'di',
    'mi',
    'do',
    'fr',
    'sa',
    'so'
);


ALTER TYPE "public"."wochentag" OWNER TO "postgres";


CREATE TYPE "public"."zusage_status" AS ENUM (
    'offen',
    'zugesagt',
    'abgesagt'
);


ALTER TYPE "public"."zusage_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_set_password"("p_user_id" "uuid", "p_passwort" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  if meine_rolle() not in ('admin','superadmin') then
    raise exception 'Keine Berechtigung';
  end if;
  update auth.users
  set encrypted_password = extensions.crypt(p_passwort, extensions.gen_salt('bf')),
      updated_at = now()
  where id = p_user_id;
end;
$$;


ALTER FUNCTION "public"."admin_set_password"("p_user_id" "uuid", "p_passwort" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."anwesenheit_erfassen"("p_stunde_id" "uuid", "p_schueler" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_e jsonb;
begin
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
$$;


ALTER FUNCTION "public"."anwesenheit_erfassen"("p_stunde_id" "uuid", "p_schueler" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_unterricht"("p_name" "text", "p_typ" "public"."unterricht_typ", "p_instrument_id" "uuid", "p_lehrer_ids" "uuid"[], "p_raum_id" "uuid" DEFAULT NULL::"uuid", "p_wochentag" "public"."wochentag" DEFAULT NULL::"public"."wochentag", "p_uhrzeit_von" time without time zone DEFAULT NULL::time without time zone, "p_uhrzeit_bis" time without time zone DEFAULT NULL::time without time zone, "p_abrechnungs_typ" "public"."abrechnungs_typ" DEFAULT 'einzeln'::"public"."abrechnungs_typ", "p_preis" numeric DEFAULT NULL::numeric, "p_schule_id" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_id    uuid;
  v_lid   uuid;
  v_idx   integer := 0;
begin
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
$$;


ALTER FUNCTION "public"."create_unterricht"("p_name" "text", "p_typ" "public"."unterricht_typ", "p_instrument_id" "uuid", "p_lehrer_ids" "uuid"[], "p_raum_id" "uuid", "p_wochentag" "public"."wochentag", "p_uhrzeit_von" time without time zone, "p_uhrzeit_bis" time without time zone, "p_abrechnungs_typ" "public"."abrechnungs_typ", "p_preis" numeric, "p_schule_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_user"("p_email" "text", "p_passwort" "text", "p_voller_name" "text", "p_rolle" "public"."user_rolle", "p_schule_id" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_user_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    role, aud,
    confirmation_token, recovery_token,
    email_change_token_new, email_change, phone_change
  ) values (
    v_user_id, '00000000-0000-0000-0000-000000000000',
    p_email, extensions.crypt(p_passwort, extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('voller_name',p_voller_name,'rolle',p_rolle,'schule_id',p_schule_id),
    'authenticated','authenticated',
    '','','','',''
  );
  insert into public.profiles (id, voller_name, rolle, schule_id)
  values (v_user_id, p_voller_name, p_rolle, p_schule_id)
  on conflict (id) do update
    set voller_name = p_voller_name, rolle = p_rolle, schule_id = p_schule_id;
  return v_user_id;
end;
$$;


ALTER FUNCTION "public"."create_user"("p_email" "text", "p_passwort" "text", "p_voller_name" "text", "p_rolle" "public"."user_rolle", "p_schule_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dashboard_stats"("p_schule_id" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare v jsonb;
begin
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
$$;


ALTER FUNCTION "public"."dashboard_stats"("p_schule_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_auth_user"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'auth', 'public'
    AS $$
DECLARE
  v_rolle public.user_rolle;
BEGIN
  SELECT rolle INTO v_rolle FROM public.profiles WHERE id = auth.uid();
  IF v_rolle NOT IN ('admin', 'superadmin') THEN
    RAISE EXCEPTION 'Nicht autorisiert';
  END IF;
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."delete_auth_user"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_kalender_token"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare v_token text;
begin
  select token into v_token from public.kalender_tokens where user_id=auth.uid();
  if v_token is null then
    insert into public.kalender_tokens (user_id) values (auth.uid()) returning token into v_token;
  end if;
  return v_token;
end;
$$;


ALTER FUNCTION "public"."get_or_create_kalender_token"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.profiles (id, voller_name, rolle, schule_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'voller_name', split_part(new.email,'@',1)),
    coalesce((new.raw_user_meta_data->>'rolle')::user_rolle,'schueler'),
    coalesce((new.raw_user_meta_data->>'schule_id')::uuid,'00000000-0000-0000-0000-000000000001')
  )
  on conflict (id) do update set voller_name=excluded.voller_name, rolle=excluded.rolle;
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ist_elternteil_von"("p_schueler_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  select exists (
    select 1 from public.eltern_schueler
    where eltern_id = auth.uid() and schueler_id = p_schueler_id
  );
$$;


ALTER FUNCTION "public"."ist_elternteil_von"("p_schueler_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ist_lehrer_von_schueler"("p_schueler_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  select exists (
    select 1 from public.unterricht_schueler us
    join public.unterricht_lehrer ul on ul.unterricht_id = us.unterricht_id
    where us.schueler_id = p_schueler_id and ul.lehrer_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."ist_lehrer_von_schueler"("p_schueler_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ist_lehrer_von_unterricht"("p_unterricht_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  select exists (
    select 1 from public.unterricht_lehrer
    where unterricht_id = p_unterricht_id and lehrer_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."ist_lehrer_von_unterricht"("p_unterricht_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mein_stundenplan"("p_von" "date" DEFAULT CURRENT_DATE, "p_bis" "date" DEFAULT (CURRENT_DATE + 30)) RETURNS TABLE("stunde_id" "uuid", "unterricht_id" "uuid", "unterricht_name" "text", "typ" "public"."unterricht_typ", "beginn" timestamp with time zone, "ende" timestamp with time zone, "raum_name" "text", "lehrer_namen" "text"[], "status" "public"."termin_status", "instrument_icon" "text", "hausaufgaben" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  return query
  select s.id, u.id, u.name, u.typ, s.beginn, s.ende, r.name,
    array(select p.voller_name from public.stunden_lehrer sl join public.profiles p on p.id=sl.lehrer_id where sl.stunde_id=s.id),
    s.status, i.icon, s.hausaufgaben
  from public.stunden s
  join public.unterricht u on u.id=s.unterricht_id
  left join public.raeume r on r.id=s.raum_id
  left join public.instrumente i on i.id=u.instrument_id
  where s.beginn::date between p_von and p_bis
  and (
    meine_rolle() in ('admin','superadmin')
    or exists (select 1 from public.stunden_lehrer sl where sl.stunde_id=s.id and sl.lehrer_id=auth.uid())
    or exists (select 1 from public.unterricht_schueler us where us.unterricht_id=u.id and us.schueler_id=auth.uid())
    or exists (select 1 from public.unterricht_schueler us join public.eltern_schueler es on es.schueler_id=us.schueler_id where us.unterricht_id=u.id and es.eltern_id=auth.uid())
  )
  order by s.beginn;
end;
$$;


ALTER FUNCTION "public"."mein_stundenplan"("p_von" "date", "p_bis" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."meine_rolle"() RETURNS "public"."user_rolle"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  select rolle from public.profiles where id = auth.uid();
$$;


ALTER FUNCTION "public"."meine_rolle"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."meine_schule"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  select schule_id from public.profiles where id = auth.uid();
$$;


ALTER FUNCTION "public"."meine_schule"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."paket_stunde_verbrauchen"("p_schueler_id" "uuid", "p_unterricht_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare v_id uuid;
begin
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
$$;


ALTER FUNCTION "public"."paket_stunde_verbrauchen"("p_schueler_id" "uuid", "p_unterricht_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."raum_belegung"("p_raum_id" "uuid", "p_von" "date" DEFAULT CURRENT_DATE, "p_bis" "date" DEFAULT (CURRENT_DATE + 7)) RETURNS TABLE("stunde_id" "uuid", "unterricht_name" "text", "beginn" timestamp with time zone, "ende" timestamp with time zone, "lehrer_namen" "text"[])
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
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
$$;


ALTER FUNCTION "public"."raum_belegung"("p_raum_id" "uuid", "p_von" "date", "p_bis" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."session_beenden"("p_session_id" "uuid", "p_anwesenheit" "jsonb" DEFAULT NULL::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_stunde_id uuid;
begin
  -- Session beenden
  update public.unterricht_sessions
  set status = 'beendet', beendet_am = now()
  where id = p_session_id and lehrer_id = auth.uid()
  returning stunde_id into v_stunde_id;

  -- Anwesenheit automatisch aus Teilnehmern erfassen
  if v_stunde_id is not null then
    if p_anwesenheit is not null then
      -- Manuell übergebene Anwesenheit
      perform public.anwesenheit_erfassen(v_stunde_id, p_anwesenheit);
    else
      -- Automatisch: alle Teilnehmer = anwesend
      insert into public.anwesenheit (stunde_id, schueler_id, status, erfasst_von)
      select v_stunde_id, profil_id, 'anwesend', auth.uid()
      from public.session_teilnehmer
      where session_id = p_session_id
      on conflict (stunde_id, schueler_id) do nothing;

      update public.stunden set status = 'stattgefunden' where id = v_stunde_id;
    end if;
  end if;
end;
$$;


ALTER FUNCTION "public"."session_beenden"("p_session_id" "uuid", "p_anwesenheit" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."session_beitreten"("p_join_code" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_session_id uuid;
begin
  select id into v_session_id
  from public.unterricht_sessions
  where upper(join_code) = upper(p_join_code)
  and status = 'aktiv';

  if v_session_id is null then
    raise exception 'Session nicht gefunden oder nicht aktiv';
  end if;

  insert into public.session_teilnehmer (session_id, profil_id)
  values (v_session_id, auth.uid())
  on conflict (session_id, profil_id) do update
    set zuletzt_aktiv = now();

  return v_session_id;
end;
$$;


ALTER FUNCTION "public"."session_beitreten"("p_join_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."session_praesentation_wechseln"("p_session_id" "uuid", "p_ansicht" "public"."praesentation_typ", "p_stueck_id" "uuid" DEFAULT NULL::"uuid", "p_datei_id" "uuid" DEFAULT NULL::"uuid", "p_scroll_position" integer DEFAULT 0, "p_youtube_ts" integer DEFAULT 0) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  update public.unterricht_sessions
  set
    aktuelle_ansicht  = p_ansicht,
    aktuelles_stueck  = p_stueck_id,
    aktuelle_datei    = p_datei_id,
    scroll_position   = p_scroll_position,
    youtube_timestamp = p_youtube_ts
  where id = p_session_id
  and lehrer_id = auth.uid();

  if not found then
    raise exception 'Session nicht gefunden oder keine Berechtigung';
  end if;
end;
$$;


ALTER FUNCTION "public"."session_praesentation_wechseln"("p_session_id" "uuid", "p_ansicht" "public"."praesentation_typ", "p_stueck_id" "uuid", "p_datei_id" "uuid", "p_scroll_position" integer, "p_youtube_ts" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."session_starten"("p_unterricht_id" "uuid", "p_stunde_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("session_id" "uuid", "join_code" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
    unterricht_id, stunde_id, lehrer_id, schule_id, status
  ) values (
    p_unterricht_id, p_stunde_id, auth.uid(),
    (select schule_id from public.profiles where id = auth.uid()),
    'aktiv'
  ) returning unterricht_sessions.id, unterricht_sessions.join_code into v_id, v_code;

  return query select v_id, v_code;
end;
$$;


ALTER FUNCTION "public"."session_starten"("p_unterricht_id" "uuid", "p_stunde_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."stunden_generieren"("p_unterricht_id" "uuid", "p_von" "date", "p_bis" "date") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_u       record;
  v_datum   date;
  v_ziel    integer;
  v_count   integer := 0;
  v_sid     uuid;
begin
  select * into v_u from public.unterricht where id = p_unterricht_id;
  if v_u.wochentag is null or v_u.uhrzeit_von is null then
    raise exception 'Kein Wochentag/Uhrzeit definiert';
  end if;

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
      and date_trunc('day', beginn) = v_datum::timestamptz
    ) then
      insert into public.stunden (id, unterricht_id, raum_id, beginn, ende)
      values (
        uuid_generate_v4(), p_unterricht_id, v_u.raum_id,
        (v_datum::text||' '||v_u.uhrzeit_von::text)::timestamptz,
        (v_datum::text||' '||v_u.uhrzeit_bis::text)::timestamptz
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
$$;


ALTER FUNCTION "public"."stunden_generieren"("p_unterricht_id" "uuid", "p_von" "date", "p_bis" "date") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."anwesenheit" (
    "stunde_id" "uuid" NOT NULL,
    "schueler_id" "uuid" NOT NULL,
    "status" "public"."anwesenheit_status" DEFAULT 'anwesend'::"public"."anwesenheit_status",
    "fortschritt" "public"."lernfortschritt",
    "notiz" "text",
    "erfasst_von" "uuid",
    "erfasst_am" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."anwesenheit" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dateien" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "schule_id" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid" NOT NULL,
    "name" "text" NOT NULL,
    "beschreibung" "text",
    "bucket_pfad" "text" NOT NULL,
    "typ" "public"."datei_typ" DEFAULT 'sonstiges'::"public"."datei_typ",
    "unterricht_id" "uuid",
    "schueler_id" "uuid",
    "hochgeladen_von" "uuid",
    "hochgeladen_am" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."dateien" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."eltern_schueler" (
    "eltern_id" "uuid" NOT NULL,
    "schueler_id" "uuid" NOT NULL
);


ALTER TABLE "public"."eltern_schueler" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_stuecke" (
    "event_id" "uuid" NOT NULL,
    "stueck_id" "uuid" NOT NULL,
    "reihenfolge" integer DEFAULT 0,
    "interpret" "text"
);


ALTER TABLE "public"."event_stuecke" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_teilnehmer" (
    "event_id" "uuid" NOT NULL,
    "profil_id" "uuid" NOT NULL,
    "zusage" "public"."zusage_status" DEFAULT 'offen'::"public"."zusage_status",
    "rolle" "text" DEFAULT 'teilnehmer'::"text"
);


ALTER TABLE "public"."event_teilnehmer" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "schule_id" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid" NOT NULL,
    "titel" "text" NOT NULL,
    "typ" "public"."event_typ" DEFAULT 'veranstaltung'::"public"."event_typ" NOT NULL,
    "beschreibung" "text",
    "beginn" timestamp with time zone NOT NULL,
    "ende" timestamp with time zone,
    "ort" "text",
    "raum_id" "uuid",
    "oeffentlich" boolean DEFAULT false,
    "erstellt_von" "uuid",
    "erstellt_am" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."instrumente" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "schule_id" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid" NOT NULL,
    "name_de" "text" NOT NULL,
    "name_en" "text",
    "name_tr" "text",
    "icon" "text" DEFAULT '🎵'::"text",
    "aktiv" boolean DEFAULT true
);


ALTER TABLE "public"."instrumente" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."interessenten" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "schule_id" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid" NOT NULL,
    "voller_name" "text" NOT NULL,
    "email" "text",
    "telefon" "text",
    "geburtsdatum" "date",
    "instrument_id" "uuid",
    "wunsch_lehrer" "uuid",
    "status" "public"."schueler_status" DEFAULT 'interessent'::"public"."schueler_status",
    "probe_datum" timestamp with time zone,
    "probe_raum_id" "uuid",
    "notizen" "text",
    "angemeldet_am" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."interessenten" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kalender_tokens" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(32), 'hex'::"text") NOT NULL,
    "erstellt_am" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."kalender_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lehrer_instrumente" (
    "lehrer_id" "uuid" NOT NULL,
    "instrument_id" "uuid" NOT NULL
);


ALTER TABLE "public"."lehrer_instrumente" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mitglied_dateien" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profil_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "typ" "text" DEFAULT 'sonstiges'::"text" NOT NULL,
    "bucket_pfad" "text" NOT NULL,
    "hochgeladen_von" "uuid",
    "hochgeladen_am" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."mitglied_dateien" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."nachricht_gelesen" (
    "nachricht_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "gelesen_am" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."nachricht_gelesen" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."nachrichten" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "schule_id" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid" NOT NULL,
    "typ" "public"."nachricht_typ" DEFAULT 'broadcast'::"public"."nachricht_typ",
    "betreff" "text" NOT NULL,
    "inhalt" "text" NOT NULL,
    "gesendet_von" "uuid",
    "empfaenger_id" "uuid",
    "gesendet_am" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."nachrichten" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pakete" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "schueler_id" "uuid" NOT NULL,
    "unterricht_id" "uuid",
    "stunden_gesamt" integer NOT NULL,
    "stunden_genutzt" integer DEFAULT 0,
    "preis" numeric(10,2),
    "gekauft_am" "date" DEFAULT CURRENT_DATE,
    "gueltig_bis" "date",
    "notizen" "text"
);


ALTER TABLE "public"."pakete" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "schule_id" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid" NOT NULL,
    "voller_name" "text" NOT NULL,
    "rolle" "public"."user_rolle" DEFAULT 'schueler'::"public"."user_rolle" NOT NULL,
    "telefon" "text",
    "adresse" "text",
    "geburtsdatum" "date",
    "avatar_url" "text",
    "sprache" "public"."sprache" DEFAULT 'de'::"public"."sprache",
    "notizen" "text",
    "aktiv" boolean DEFAULT true,
    "erstellt_am" timestamp with time zone DEFAULT "now"(),
    "aktualisiert_am" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "endpoint" "text" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth_key" "text" NOT NULL,
    "erstellt_am" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."raeume" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "schule_id" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid" NOT NULL,
    "name" "text" NOT NULL,
    "kapazitaet" integer DEFAULT 1,
    "ausstattung" "text"[],
    "farbe" "text" DEFAULT '#3b82f6'::"text",
    "aktiv" boolean DEFAULT true,
    "notizen" "text"
);


ALTER TABLE "public"."raeume" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rechnungen" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "schule_id" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid" NOT NULL,
    "schueler_id" "uuid" NOT NULL,
    "unterricht_id" "uuid",
    "betrag" numeric(10,2) NOT NULL,
    "zeitraum_von" "date",
    "zeitraum_bis" "date",
    "faellig_am" "date",
    "bezahlt_am" "date",
    "notizen" "text",
    "erstellt_am" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."rechnungen" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."schulen" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "adresse" "text",
    "telefon" "text",
    "email" "text",
    "website" "text",
    "logo_url" "text",
    "farbe" "text" DEFAULT '#1a1a2e'::"text",
    "sprachen" "public"."sprache"[] DEFAULT ARRAY['de'::"public"."sprache"],
    "aktiv" boolean DEFAULT true,
    "erstellt_am" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."schulen" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_reaktionen" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "profil_id" "uuid",
    "gast_name" "text",
    "typ" "public"."reaktion_typ",
    "frage" "text",
    "beantwortet" boolean DEFAULT false,
    "erstellt_am" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."session_reaktionen" REPLICA IDENTITY FULL;


ALTER TABLE "public"."session_reaktionen" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_teilnehmer" (
    "session_id" "uuid" NOT NULL,
    "profil_id" "uuid" NOT NULL,
    "gast_name" "text",
    "beigetreten_am" timestamp with time zone DEFAULT "now"(),
    "zuletzt_aktiv" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."session_teilnehmer" REPLICA IDENTITY FULL;


ALTER TABLE "public"."session_teilnehmer" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stueck_dateien" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "stueck_id" "uuid",
    "typ" "public"."datei_typ" NOT NULL,
    "stimme" "public"."stimmgruppe_typ" DEFAULT 'keine'::"public"."stimmgruppe_typ",
    "name" "text" NOT NULL,
    "bucket_pfad" "text" NOT NULL,
    "hochgeladen_von" "uuid",
    "hochgeladen_am" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."stueck_dateien" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stuecke" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "schule_id" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid" NOT NULL,
    "titel" "text" NOT NULL,
    "komponist" "text",
    "tonart" "text",
    "tempo" "text",
    "liedtext" "text",
    "youtube_url" "text",
    "notizen" "text",
    "erstellt_von" "uuid",
    "erstellt_am" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."stuecke" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stunden" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "unterricht_id" "uuid" NOT NULL,
    "raum_id" "uuid",
    "beginn" timestamp with time zone NOT NULL,
    "ende" timestamp with time zone NOT NULL,
    "status" "public"."termin_status" DEFAULT 'geplant'::"public"."termin_status",
    "absage_grund" "text",
    "notizen" "text",
    "hausaufgaben" "text",
    "erstellt_am" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."stunden" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stunden_lehrer" (
    "stunde_id" "uuid" NOT NULL,
    "lehrer_id" "uuid" NOT NULL,
    "rolle" "public"."lehrer_rolle_typ" DEFAULT 'hauptlehrer'::"public"."lehrer_rolle_typ"
);


ALTER TABLE "public"."stunden_lehrer" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."unterricht" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "schule_id" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid" NOT NULL,
    "name" "text" NOT NULL,
    "typ" "public"."unterricht_typ" DEFAULT 'einzel'::"public"."unterricht_typ" NOT NULL,
    "instrument_id" "uuid",
    "raum_id" "uuid",
    "wochentag" "public"."wochentag",
    "uhrzeit_von" time without time zone,
    "uhrzeit_bis" time without time zone,
    "abrechnungs_typ" "public"."abrechnungs_typ" DEFAULT 'einzeln'::"public"."abrechnungs_typ",
    "preis_pro_stunde" numeric(10,2),
    "paket_stunden" integer,
    "pauschale_monat" numeric(10,2),
    "aktiv" boolean DEFAULT true,
    "farbe" "text" DEFAULT '#3b82f6'::"text",
    "notizen" "text",
    "erstellt_am" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."unterricht" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."unterricht_lehrer" (
    "unterricht_id" "uuid" NOT NULL,
    "lehrer_id" "uuid" NOT NULL,
    "rolle" "public"."lehrer_rolle_typ" DEFAULT 'hauptlehrer'::"public"."lehrer_rolle_typ",
    "seit" "date" DEFAULT CURRENT_DATE
);


ALTER TABLE "public"."unterricht_lehrer" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."unterricht_schueler" (
    "unterricht_id" "uuid" NOT NULL,
    "schueler_id" "uuid" NOT NULL,
    "status" "public"."schueler_status" DEFAULT 'aktiv'::"public"."schueler_status",
    "eingetreten_am" "date" DEFAULT CURRENT_DATE,
    "ausgetreten_am" "date",
    "stimmgruppe" "public"."stimmgruppe_typ" DEFAULT 'keine'::"public"."stimmgruppe_typ",
    "notizen" "text"
);


ALTER TABLE "public"."unterricht_schueler" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."unterricht_sessions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "unterricht_id" "uuid" NOT NULL,
    "stunde_id" "uuid",
    "lehrer_id" "uuid" NOT NULL,
    "schule_id" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid" NOT NULL,
    "join_code" "text" DEFAULT "upper"("substring"("encode"("extensions"."gen_random_bytes"(4), 'hex'::"text"), 1, 6)) NOT NULL,
    "status" "public"."session_status" DEFAULT 'wartend'::"public"."session_status",
    "aktuelle_ansicht" "public"."praesentation_typ",
    "aktuelles_stueck" "uuid",
    "aktuelle_datei" "uuid",
    "scroll_position" integer DEFAULT 0,
    "youtube_timestamp" integer DEFAULT 0,
    "gestartet_am" timestamp with time zone DEFAULT "now"(),
    "beendet_am" timestamp with time zone
);

ALTER TABLE ONLY "public"."unterricht_sessions" REPLICA IDENTITY FULL;


ALTER TABLE "public"."unterricht_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."unterricht_stuecke" (
    "unterricht_id" "uuid" NOT NULL,
    "stueck_id" "uuid" NOT NULL,
    "reihenfolge" integer DEFAULT 0,
    "status" "text" DEFAULT 'aktuell'::"text"
);


ALTER TABLE "public"."unterricht_stuecke" OWNER TO "postgres";


ALTER TABLE ONLY "public"."anwesenheit"
    ADD CONSTRAINT "anwesenheit_pkey" PRIMARY KEY ("stunde_id", "schueler_id");



ALTER TABLE ONLY "public"."dateien"
    ADD CONSTRAINT "dateien_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."eltern_schueler"
    ADD CONSTRAINT "eltern_schueler_pkey" PRIMARY KEY ("eltern_id", "schueler_id");



ALTER TABLE ONLY "public"."event_stuecke"
    ADD CONSTRAINT "event_stuecke_pkey" PRIMARY KEY ("event_id", "stueck_id");



ALTER TABLE ONLY "public"."event_teilnehmer"
    ADD CONSTRAINT "event_teilnehmer_pkey" PRIMARY KEY ("event_id", "profil_id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."instrumente"
    ADD CONSTRAINT "instrumente_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."interessenten"
    ADD CONSTRAINT "interessenten_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kalender_tokens"
    ADD CONSTRAINT "kalender_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kalender_tokens"
    ADD CONSTRAINT "kalender_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."lehrer_instrumente"
    ADD CONSTRAINT "lehrer_instrumente_pkey" PRIMARY KEY ("lehrer_id", "instrument_id");



ALTER TABLE ONLY "public"."mitglied_dateien"
    ADD CONSTRAINT "mitglied_dateien_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."nachricht_gelesen"
    ADD CONSTRAINT "nachricht_gelesen_pkey" PRIMARY KEY ("nachricht_id", "user_id");



ALTER TABLE ONLY "public"."nachrichten"
    ADD CONSTRAINT "nachrichten_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pakete"
    ADD CONSTRAINT "pakete_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_endpoint_key" UNIQUE ("endpoint");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."raeume"
    ADD CONSTRAINT "raeume_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rechnungen"
    ADD CONSTRAINT "rechnungen_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schulen"
    ADD CONSTRAINT "schulen_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_reaktionen"
    ADD CONSTRAINT "session_reaktionen_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_teilnehmer"
    ADD CONSTRAINT "session_teilnehmer_pkey" PRIMARY KEY ("session_id", "profil_id");



ALTER TABLE ONLY "public"."stueck_dateien"
    ADD CONSTRAINT "stueck_dateien_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stuecke"
    ADD CONSTRAINT "stuecke_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stunden_lehrer"
    ADD CONSTRAINT "stunden_lehrer_pkey" PRIMARY KEY ("stunde_id", "lehrer_id");



ALTER TABLE ONLY "public"."stunden"
    ADD CONSTRAINT "stunden_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."unterricht_lehrer"
    ADD CONSTRAINT "unterricht_lehrer_pkey" PRIMARY KEY ("unterricht_id", "lehrer_id");



ALTER TABLE ONLY "public"."unterricht"
    ADD CONSTRAINT "unterricht_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."unterricht_schueler"
    ADD CONSTRAINT "unterricht_schueler_pkey" PRIMARY KEY ("unterricht_id", "schueler_id");



ALTER TABLE ONLY "public"."unterricht_sessions"
    ADD CONSTRAINT "unterricht_sessions_join_code_key" UNIQUE ("join_code");



ALTER TABLE ONLY "public"."unterricht_sessions"
    ADD CONSTRAINT "unterricht_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."unterricht_stuecke"
    ADD CONSTRAINT "unterricht_stuecke_pkey" PRIMARY KEY ("unterricht_id", "stueck_id");



CREATE INDEX "anwesenheit_schueler_id_idx" ON "public"."anwesenheit" USING "btree" ("schueler_id");



CREATE INDEX "anwesenheit_stunde_id_idx" ON "public"."anwesenheit" USING "btree" ("stunde_id");



CREATE INDEX "dateien_schueler_id_idx" ON "public"."dateien" USING "btree" ("schueler_id");



CREATE INDEX "dateien_unterricht_id_idx" ON "public"."dateien" USING "btree" ("unterricht_id");



CREATE INDEX "event_teilnehmer_profil_id_idx" ON "public"."event_teilnehmer" USING "btree" ("profil_id");



CREATE INDEX "events_schule_id_beginn_idx" ON "public"."events" USING "btree" ("schule_id", "beginn");



CREATE INDEX "interessenten_schule_id_idx" ON "public"."interessenten" USING "btree" ("schule_id");



CREATE INDEX "nachrichten_empfaenger_id_idx" ON "public"."nachrichten" USING "btree" ("empfaenger_id");



CREATE INDEX "nachrichten_schule_id_idx" ON "public"."nachrichten" USING "btree" ("schule_id");



CREATE INDEX "pakete_schueler_id_idx" ON "public"."pakete" USING "btree" ("schueler_id");



CREATE INDEX "profiles_schule_id_rolle_idx" ON "public"."profiles" USING "btree" ("schule_id", "rolle");



CREATE INDEX "rechnungen_schueler_id_idx" ON "public"."rechnungen" USING "btree" ("schueler_id");



CREATE INDEX "session_reaktionen_erstellt_am_idx" ON "public"."session_reaktionen" USING "btree" ("erstellt_am");



CREATE INDEX "session_reaktionen_session_id_idx" ON "public"."session_reaktionen" USING "btree" ("session_id");



CREATE INDEX "session_teilnehmer_session_id_idx" ON "public"."session_teilnehmer" USING "btree" ("session_id");



CREATE INDEX "stunden_beginn_idx" ON "public"."stunden" USING "btree" ("beginn");



CREATE INDEX "stunden_lehrer_lehrer_id_idx" ON "public"."stunden_lehrer" USING "btree" ("lehrer_id");



CREATE INDEX "stunden_lehrer_stunde_id_idx" ON "public"."stunden_lehrer" USING "btree" ("stunde_id");



CREATE INDEX "stunden_raum_id_idx" ON "public"."stunden" USING "btree" ("raum_id");



CREATE INDEX "stunden_unterricht_id_idx" ON "public"."stunden" USING "btree" ("unterricht_id");



CREATE INDEX "unterricht_lehrer_lehrer_id_idx" ON "public"."unterricht_lehrer" USING "btree" ("lehrer_id");



CREATE INDEX "unterricht_lehrer_unterricht_id_idx" ON "public"."unterricht_lehrer" USING "btree" ("unterricht_id");



CREATE INDEX "unterricht_schueler_schueler_id_idx" ON "public"."unterricht_schueler" USING "btree" ("schueler_id");



CREATE INDEX "unterricht_schueler_unterricht_id_idx" ON "public"."unterricht_schueler" USING "btree" ("unterricht_id");



CREATE INDEX "unterricht_schule_id_idx" ON "public"."unterricht" USING "btree" ("schule_id");



CREATE INDEX "unterricht_sessions_join_code_idx" ON "public"."unterricht_sessions" USING "btree" ("join_code");



CREATE INDEX "unterricht_sessions_status_idx" ON "public"."unterricht_sessions" USING "btree" ("status");



CREATE INDEX "unterricht_sessions_unterricht_id_idx" ON "public"."unterricht_sessions" USING "btree" ("unterricht_id");



ALTER TABLE ONLY "public"."anwesenheit"
    ADD CONSTRAINT "anwesenheit_erfasst_von_fkey" FOREIGN KEY ("erfasst_von") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."anwesenheit"
    ADD CONSTRAINT "anwesenheit_schueler_id_fkey" FOREIGN KEY ("schueler_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."anwesenheit"
    ADD CONSTRAINT "anwesenheit_stunde_id_fkey" FOREIGN KEY ("stunde_id") REFERENCES "public"."stunden"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dateien"
    ADD CONSTRAINT "dateien_hochgeladen_von_fkey" FOREIGN KEY ("hochgeladen_von") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."dateien"
    ADD CONSTRAINT "dateien_schueler_id_fkey" FOREIGN KEY ("schueler_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dateien"
    ADD CONSTRAINT "dateien_schule_id_fkey" FOREIGN KEY ("schule_id") REFERENCES "public"."schulen"("id");



ALTER TABLE ONLY "public"."dateien"
    ADD CONSTRAINT "dateien_unterricht_id_fkey" FOREIGN KEY ("unterricht_id") REFERENCES "public"."unterricht"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."eltern_schueler"
    ADD CONSTRAINT "eltern_schueler_eltern_id_fkey" FOREIGN KEY ("eltern_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."eltern_schueler"
    ADD CONSTRAINT "eltern_schueler_schueler_id_fkey" FOREIGN KEY ("schueler_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_stuecke"
    ADD CONSTRAINT "event_stuecke_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_stuecke"
    ADD CONSTRAINT "event_stuecke_stueck_id_fkey" FOREIGN KEY ("stueck_id") REFERENCES "public"."stuecke"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_teilnehmer"
    ADD CONSTRAINT "event_teilnehmer_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_teilnehmer"
    ADD CONSTRAINT "event_teilnehmer_profil_id_fkey" FOREIGN KEY ("profil_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_erstellt_von_fkey" FOREIGN KEY ("erstellt_von") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_raum_id_fkey" FOREIGN KEY ("raum_id") REFERENCES "public"."raeume"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_schule_id_fkey" FOREIGN KEY ("schule_id") REFERENCES "public"."schulen"("id");



ALTER TABLE ONLY "public"."instrumente"
    ADD CONSTRAINT "instrumente_schule_id_fkey" FOREIGN KEY ("schule_id") REFERENCES "public"."schulen"("id");



ALTER TABLE ONLY "public"."interessenten"
    ADD CONSTRAINT "interessenten_instrument_id_fkey" FOREIGN KEY ("instrument_id") REFERENCES "public"."instrumente"("id");



ALTER TABLE ONLY "public"."interessenten"
    ADD CONSTRAINT "interessenten_probe_raum_id_fkey" FOREIGN KEY ("probe_raum_id") REFERENCES "public"."raeume"("id");



ALTER TABLE ONLY "public"."interessenten"
    ADD CONSTRAINT "interessenten_schule_id_fkey" FOREIGN KEY ("schule_id") REFERENCES "public"."schulen"("id");



ALTER TABLE ONLY "public"."interessenten"
    ADD CONSTRAINT "interessenten_wunsch_lehrer_fkey" FOREIGN KEY ("wunsch_lehrer") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."kalender_tokens"
    ADD CONSTRAINT "kalender_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lehrer_instrumente"
    ADD CONSTRAINT "lehrer_instrumente_instrument_id_fkey" FOREIGN KEY ("instrument_id") REFERENCES "public"."instrumente"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lehrer_instrumente"
    ADD CONSTRAINT "lehrer_instrumente_lehrer_id_fkey" FOREIGN KEY ("lehrer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mitglied_dateien"
    ADD CONSTRAINT "mitglied_dateien_hochgeladen_von_fkey" FOREIGN KEY ("hochgeladen_von") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."mitglied_dateien"
    ADD CONSTRAINT "mitglied_dateien_profil_id_fkey" FOREIGN KEY ("profil_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."nachricht_gelesen"
    ADD CONSTRAINT "nachricht_gelesen_nachricht_id_fkey" FOREIGN KEY ("nachricht_id") REFERENCES "public"."nachrichten"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."nachricht_gelesen"
    ADD CONSTRAINT "nachricht_gelesen_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."nachrichten"
    ADD CONSTRAINT "nachrichten_empfaenger_id_fkey" FOREIGN KEY ("empfaenger_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."nachrichten"
    ADD CONSTRAINT "nachrichten_gesendet_von_fkey" FOREIGN KEY ("gesendet_von") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."nachrichten"
    ADD CONSTRAINT "nachrichten_schule_id_fkey" FOREIGN KEY ("schule_id") REFERENCES "public"."schulen"("id");



ALTER TABLE ONLY "public"."pakete"
    ADD CONSTRAINT "pakete_schueler_id_fkey" FOREIGN KEY ("schueler_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pakete"
    ADD CONSTRAINT "pakete_unterricht_id_fkey" FOREIGN KEY ("unterricht_id") REFERENCES "public"."unterricht"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_schule_id_fkey" FOREIGN KEY ("schule_id") REFERENCES "public"."schulen"("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."raeume"
    ADD CONSTRAINT "raeume_schule_id_fkey" FOREIGN KEY ("schule_id") REFERENCES "public"."schulen"("id");



ALTER TABLE ONLY "public"."rechnungen"
    ADD CONSTRAINT "rechnungen_schueler_id_fkey" FOREIGN KEY ("schueler_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rechnungen"
    ADD CONSTRAINT "rechnungen_schule_id_fkey" FOREIGN KEY ("schule_id") REFERENCES "public"."schulen"("id");



ALTER TABLE ONLY "public"."rechnungen"
    ADD CONSTRAINT "rechnungen_unterricht_id_fkey" FOREIGN KEY ("unterricht_id") REFERENCES "public"."unterricht"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."session_reaktionen"
    ADD CONSTRAINT "session_reaktionen_profil_id_fkey" FOREIGN KEY ("profil_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."session_reaktionen"
    ADD CONSTRAINT "session_reaktionen_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."unterricht_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_teilnehmer"
    ADD CONSTRAINT "session_teilnehmer_profil_id_fkey" FOREIGN KEY ("profil_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_teilnehmer"
    ADD CONSTRAINT "session_teilnehmer_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."unterricht_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stueck_dateien"
    ADD CONSTRAINT "stueck_dateien_hochgeladen_von_fkey" FOREIGN KEY ("hochgeladen_von") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stueck_dateien"
    ADD CONSTRAINT "stueck_dateien_stueck_id_fkey" FOREIGN KEY ("stueck_id") REFERENCES "public"."stuecke"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stuecke"
    ADD CONSTRAINT "stuecke_erstellt_von_fkey" FOREIGN KEY ("erstellt_von") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stuecke"
    ADD CONSTRAINT "stuecke_schule_id_fkey" FOREIGN KEY ("schule_id") REFERENCES "public"."schulen"("id");



ALTER TABLE ONLY "public"."stunden_lehrer"
    ADD CONSTRAINT "stunden_lehrer_lehrer_id_fkey" FOREIGN KEY ("lehrer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stunden_lehrer"
    ADD CONSTRAINT "stunden_lehrer_stunde_id_fkey" FOREIGN KEY ("stunde_id") REFERENCES "public"."stunden"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stunden"
    ADD CONSTRAINT "stunden_raum_id_fkey" FOREIGN KEY ("raum_id") REFERENCES "public"."raeume"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stunden"
    ADD CONSTRAINT "stunden_unterricht_id_fkey" FOREIGN KEY ("unterricht_id") REFERENCES "public"."unterricht"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."unterricht"
    ADD CONSTRAINT "unterricht_instrument_id_fkey" FOREIGN KEY ("instrument_id") REFERENCES "public"."instrumente"("id");



ALTER TABLE ONLY "public"."unterricht_lehrer"
    ADD CONSTRAINT "unterricht_lehrer_lehrer_id_fkey" FOREIGN KEY ("lehrer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."unterricht_lehrer"
    ADD CONSTRAINT "unterricht_lehrer_unterricht_id_fkey" FOREIGN KEY ("unterricht_id") REFERENCES "public"."unterricht"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."unterricht"
    ADD CONSTRAINT "unterricht_raum_id_fkey" FOREIGN KEY ("raum_id") REFERENCES "public"."raeume"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."unterricht_schueler"
    ADD CONSTRAINT "unterricht_schueler_schueler_id_fkey" FOREIGN KEY ("schueler_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."unterricht_schueler"
    ADD CONSTRAINT "unterricht_schueler_unterricht_id_fkey" FOREIGN KEY ("unterricht_id") REFERENCES "public"."unterricht"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."unterricht"
    ADD CONSTRAINT "unterricht_schule_id_fkey" FOREIGN KEY ("schule_id") REFERENCES "public"."schulen"("id");



ALTER TABLE ONLY "public"."unterricht_sessions"
    ADD CONSTRAINT "unterricht_sessions_aktuelle_datei_fkey" FOREIGN KEY ("aktuelle_datei") REFERENCES "public"."stueck_dateien"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."unterricht_sessions"
    ADD CONSTRAINT "unterricht_sessions_aktuelles_stueck_fkey" FOREIGN KEY ("aktuelles_stueck") REFERENCES "public"."stuecke"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."unterricht_sessions"
    ADD CONSTRAINT "unterricht_sessions_lehrer_id_fkey" FOREIGN KEY ("lehrer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."unterricht_sessions"
    ADD CONSTRAINT "unterricht_sessions_schule_id_fkey" FOREIGN KEY ("schule_id") REFERENCES "public"."schulen"("id");



ALTER TABLE ONLY "public"."unterricht_sessions"
    ADD CONSTRAINT "unterricht_sessions_stunde_id_fkey" FOREIGN KEY ("stunde_id") REFERENCES "public"."stunden"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."unterricht_sessions"
    ADD CONSTRAINT "unterricht_sessions_unterricht_id_fkey" FOREIGN KEY ("unterricht_id") REFERENCES "public"."unterricht"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."unterricht_stuecke"
    ADD CONSTRAINT "unterricht_stuecke_stueck_id_fkey" FOREIGN KEY ("stueck_id") REFERENCES "public"."stuecke"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."unterricht_stuecke"
    ADD CONSTRAINT "unterricht_stuecke_unterricht_id_fkey" FOREIGN KEY ("unterricht_id") REFERENCES "public"."unterricht"("id") ON DELETE CASCADE;



CREATE POLICY "admin_alles" ON "public"."mitglied_dateien" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."rolle" = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"]))))));



CREATE POLICY "anw: admin+lehrer" ON "public"."anwesenheit" USING ((("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"])) OR (EXISTS ( SELECT 1
   FROM "public"."stunden_lehrer"
  WHERE (("stunden_lehrer"."stunde_id" = "anwesenheit"."stunde_id") AND ("stunden_lehrer"."lehrer_id" = "auth"."uid"())))))) WITH CHECK ((("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"])) OR (EXISTS ( SELECT 1
   FROM "public"."stunden_lehrer"
  WHERE (("stunden_lehrer"."stunde_id" = "anwesenheit"."stunde_id") AND ("stunden_lehrer"."lehrer_id" = "auth"."uid"()))))));



CREATE POLICY "anw: lesen" ON "public"."anwesenheit" FOR SELECT USING ((("schueler_id" = "auth"."uid"()) OR ("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"])) OR (EXISTS ( SELECT 1
   FROM "public"."stunden_lehrer"
  WHERE (("stunden_lehrer"."stunde_id" = "anwesenheit"."stunde_id") AND ("stunden_lehrer"."lehrer_id" = "auth"."uid"())))) OR "public"."ist_elternteil_von"("schueler_id")));



ALTER TABLE "public"."anwesenheit" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dat: lesen" ON "public"."dateien" FOR SELECT USING ((("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"])) OR ("schueler_id" = "auth"."uid"()) OR ("hochgeladen_von" = "auth"."uid"()) OR (("unterricht_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."unterricht_schueler"
  WHERE (("unterricht_schueler"."unterricht_id" = "dateien"."unterricht_id") AND ("unterricht_schueler"."schueler_id" = "auth"."uid"()))))) OR (("unterricht_id" IS NOT NULL) AND "public"."ist_lehrer_von_unterricht"("unterricht_id")) OR (("schueler_id" IS NOT NULL) AND "public"."ist_elternteil_von"("schueler_id"))));



CREATE POLICY "dat: verw" ON "public"."dateien" USING ((("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"])) OR ("hochgeladen_von" = "auth"."uid"()) OR (("unterricht_id" IS NOT NULL) AND "public"."ist_lehrer_von_unterricht"("unterricht_id")))) WITH CHECK ((("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"])) OR ("hochgeladen_von" = "auth"."uid"())));



ALTER TABLE "public"."dateien" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "eigene_subscription" ON "public"."push_subscriptions" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."eltern_schueler" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "es: admin" ON "public"."eltern_schueler" USING (("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"]))) WITH CHECK (("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"])));



CREATE POLICY "es: lesen" ON "public"."eltern_schueler" FOR SELECT USING ((("eltern_id" = "auth"."uid"()) OR ("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"]))));



CREATE POLICY "est: admin+lehrer" ON "public"."event_stuecke" USING (("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle", 'lehrer'::"public"."user_rolle"]))) WITH CHECK (("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle", 'lehrer'::"public"."user_rolle"])));



CREATE POLICY "est: lesen" ON "public"."event_stuecke" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "etn: admin" ON "public"."event_teilnehmer" USING (("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"]))) WITH CHECK (("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"])));



CREATE POLICY "etn: lesen" ON "public"."event_teilnehmer" FOR SELECT USING ((("profil_id" = "auth"."uid"()) OR ("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle", 'lehrer'::"public"."user_rolle"]))));



CREATE POLICY "etn: zusage" ON "public"."event_teilnehmer" FOR UPDATE USING ((("profil_id" = "auth"."uid"()) OR ("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"])))) WITH CHECK ((("profil_id" = "auth"."uid"()) OR ("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"]))));



ALTER TABLE "public"."event_stuecke" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_teilnehmer" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "evt: admin+lehrer" ON "public"."events" USING (("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle", 'lehrer'::"public"."user_rolle"]))) WITH CHECK (("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle", 'lehrer'::"public"."user_rolle"])));



CREATE POLICY "evt: lesen" ON "public"."events" FOR SELECT USING ((("oeffentlich" = true) OR ("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle", 'lehrer'::"public"."user_rolle"])) OR (EXISTS ( SELECT 1
   FROM "public"."event_teilnehmer"
  WHERE (("event_teilnehmer"."event_id" = "events"."id") AND ("event_teilnehmer"."profil_id" = "auth"."uid"()))))));



CREATE POLICY "instr: admin" ON "public"."instrumente" USING (("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"]))) WITH CHECK (("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"])));



CREATE POLICY "instr: lesen" ON "public"."instrumente" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



ALTER TABLE "public"."instrumente" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "int: admin+lehrer" ON "public"."interessenten" USING (("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle", 'lehrer'::"public"."user_rolle"]))) WITH CHECK (("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle", 'lehrer'::"public"."user_rolle"])));



ALTER TABLE "public"."interessenten" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kal: eigen" ON "public"."kalender_tokens" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."kalender_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lehrer_instrumente" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "li: lesen" ON "public"."lehrer_instrumente" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "li: verw" ON "public"."lehrer_instrumente" USING ((("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"])) OR ("lehrer_id" = "auth"."uid"()))) WITH CHECK ((("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"])) OR ("lehrer_id" = "auth"."uid"())));



ALTER TABLE "public"."mitglied_dateien" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mitglied_liest_eigene" ON "public"."mitglied_dateien" FOR SELECT USING (("profil_id" = "auth"."uid"()));



CREATE POLICY "nach: admin del" ON "public"."nachrichten" FOR DELETE USING (("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"])));



CREATE POLICY "nach: lesen" ON "public"."nachrichten" FOR SELECT USING ((("gesendet_von" = "auth"."uid"()) OR ("empfaenger_id" = "auth"."uid"()) OR (("typ" = 'broadcast'::"public"."nachricht_typ") AND ("public"."meine_schule"() = "schule_id"))));



CREATE POLICY "nach: senden" ON "public"."nachrichten" FOR INSERT WITH CHECK (("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle", 'lehrer'::"public"."user_rolle"])));



ALTER TABLE "public"."nachricht_gelesen" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."nachrichten" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ng: eigen" ON "public"."nachricht_gelesen" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "pak: admin" ON "public"."pakete" USING (("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"]))) WITH CHECK (("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"])));



CREATE POLICY "pak: lesen" ON "public"."pakete" FOR SELECT USING ((("schueler_id" = "auth"."uid"()) OR ("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"])) OR "public"."ist_elternteil_von"("schueler_id")));



ALTER TABLE "public"."pakete" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles: admin" ON "public"."profiles" USING (("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"]))) WITH CHECK (("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"])));



CREATE POLICY "profiles: lesen" ON "public"."profiles" FOR SELECT USING ((("id" = "auth"."uid"()) OR ("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"])) OR "public"."ist_lehrer_von_schueler"("id") OR "public"."ist_elternteil_von"("id")));



CREATE POLICY "profiles: update" ON "public"."profiles" FOR UPDATE USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "push: eigen" ON "public"."push_subscriptions" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."raeume" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "raeume: admin" ON "public"."raeume" USING (("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"]))) WITH CHECK (("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"])));



CREATE POLICY "raeume: lesen" ON "public"."raeume" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "reak: beantwortet" ON "public"."session_reaktionen" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."unterricht_sessions"
  WHERE (("unterricht_sessions"."id" = "session_reaktionen"."session_id") AND ("unterricht_sessions"."lehrer_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."unterricht_sessions"
  WHERE (("unterricht_sessions"."id" = "session_reaktionen"."session_id") AND ("unterricht_sessions"."lehrer_id" = "auth"."uid"())))));



CREATE POLICY "reak: lesen" ON "public"."session_reaktionen" FOR SELECT USING ((("profil_id" = "auth"."uid"()) OR ("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"])) OR (EXISTS ( SELECT 1
   FROM "public"."unterricht_sessions"
  WHERE (("unterricht_sessions"."id" = "session_reaktionen"."session_id") AND ("unterricht_sessions"."lehrer_id" = "auth"."uid"()))))));



CREATE POLICY "reak: senden" ON "public"."session_reaktionen" FOR INSERT WITH CHECK (("profil_id" = "auth"."uid"()));



CREATE POLICY "rech: admin" ON "public"."rechnungen" USING (("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"]))) WITH CHECK (("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"])));



CREATE POLICY "rech: lesen" ON "public"."rechnungen" FOR SELECT USING ((("schueler_id" = "auth"."uid"()) OR ("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"])) OR "public"."ist_elternteil_von"("schueler_id")));



ALTER TABLE "public"."rechnungen" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."schulen" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "schulen: lesen" ON "public"."schulen" FOR SELECT USING (true);



CREATE POLICY "schulen: sadmin" ON "public"."schulen" USING (("public"."meine_rolle"() = 'superadmin'::"public"."user_rolle")) WITH CHECK (("public"."meine_rolle"() = 'superadmin'::"public"."user_rolle"));



CREATE POLICY "sdf: admin+lehrer" ON "public"."stueck_dateien" USING (("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle", 'lehrer'::"public"."user_rolle"]))) WITH CHECK (("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle", 'lehrer'::"public"."user_rolle"])));



CREATE POLICY "sdf: lesen" ON "public"."stueck_dateien" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "sess: join code" ON "public"."unterricht_sessions" FOR SELECT USING (("status" = 'aktiv'::"public"."session_status"));



CREATE POLICY "sess: lehrer erstellt" ON "public"."unterricht_sessions" FOR INSERT WITH CHECK ((("lehrer_id" = "auth"."uid"()) OR ("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"]))));



CREATE POLICY "sess: lehrer updated" ON "public"."unterricht_sessions" FOR UPDATE USING ((("lehrer_id" = "auth"."uid"()) OR ("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"])))) WITH CHECK ((("lehrer_id" = "auth"."uid"()) OR ("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"]))));



CREATE POLICY "sess: lesen" ON "public"."unterricht_sessions" FOR SELECT USING ((("lehrer_id" = "auth"."uid"()) OR ("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"])) OR (EXISTS ( SELECT 1
   FROM "public"."unterricht_schueler"
  WHERE (("unterricht_schueler"."unterricht_id" = "unterricht_sessions"."unterricht_id") AND ("unterricht_schueler"."schueler_id" = "auth"."uid"()))))));



ALTER TABLE "public"."session_reaktionen" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."session_teilnehmer" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sl: lesen" ON "public"."stunden_lehrer" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "sl: verw" ON "public"."stunden_lehrer" USING ((("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"])) OR ("lehrer_id" = "auth"."uid"()))) WITH CHECK ((("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"])) OR ("lehrer_id" = "auth"."uid"())));



CREATE POLICY "std: admin+lehrer" ON "public"."stunden" USING ((("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"])) OR (EXISTS ( SELECT 1
   FROM "public"."stunden_lehrer"
  WHERE (("stunden_lehrer"."stunde_id" = "stunden"."id") AND ("stunden_lehrer"."lehrer_id" = "auth"."uid"())))))) WITH CHECK ((("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"])) OR (EXISTS ( SELECT 1
   FROM "public"."stunden_lehrer"
  WHERE (("stunden_lehrer"."stunde_id" = "stunden"."id") AND ("stunden_lehrer"."lehrer_id" = "auth"."uid"()))))));



CREATE POLICY "std: lesen" ON "public"."stunden" FOR SELECT USING ((("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"])) OR (EXISTS ( SELECT 1
   FROM "public"."stunden_lehrer"
  WHERE (("stunden_lehrer"."stunde_id" = "stunden"."id") AND ("stunden_lehrer"."lehrer_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."unterricht_schueler"
  WHERE (("unterricht_schueler"."unterricht_id" = "stunden"."unterricht_id") AND ("unterricht_schueler"."schueler_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM ("public"."unterricht_schueler" "us"
     JOIN "public"."eltern_schueler" "es" ON (("es"."schueler_id" = "us"."schueler_id")))
  WHERE (("us"."unterricht_id" = "stunden"."unterricht_id") AND ("es"."eltern_id" = "auth"."uid"()))))));



CREATE POLICY "steil: beitreten" ON "public"."session_teilnehmer" FOR INSERT WITH CHECK (("profil_id" = "auth"."uid"()));



CREATE POLICY "steil: lesen" ON "public"."session_teilnehmer" FOR SELECT USING ((("profil_id" = "auth"."uid"()) OR ("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"])) OR (EXISTS ( SELECT 1
   FROM "public"."unterricht_sessions"
  WHERE (("unterricht_sessions"."id" = "session_teilnehmer"."session_id") AND ("unterricht_sessions"."lehrer_id" = "auth"."uid"()))))));



CREATE POLICY "steil: update" ON "public"."session_teilnehmer" FOR UPDATE USING (("profil_id" = "auth"."uid"())) WITH CHECK (("profil_id" = "auth"."uid"()));



CREATE POLICY "stk: admin+lehrer" ON "public"."stuecke" USING (("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle", 'lehrer'::"public"."user_rolle"]))) WITH CHECK (("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle", 'lehrer'::"public"."user_rolle"])));



CREATE POLICY "stk: lesen" ON "public"."stuecke" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



ALTER TABLE "public"."stueck_dateien" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stuecke" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stunden" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stunden_lehrer" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ul: admin" ON "public"."unterricht_lehrer" USING (("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"]))) WITH CHECK (("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"])));



CREATE POLICY "ul: lesen" ON "public"."unterricht_lehrer" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "unt: admin" ON "public"."unterricht" USING (("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"]))) WITH CHECK (("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"])));



CREATE POLICY "unt: lesen" ON "public"."unterricht" FOR SELECT USING ((("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"])) OR "public"."ist_lehrer_von_unterricht"("id") OR (EXISTS ( SELECT 1
   FROM "public"."unterricht_schueler"
  WHERE (("unterricht_schueler"."unterricht_id" = "unterricht"."id") AND ("unterricht_schueler"."schueler_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM ("public"."unterricht_schueler" "us"
     JOIN "public"."eltern_schueler" "es" ON (("es"."schueler_id" = "us"."schueler_id")))
  WHERE (("us"."unterricht_id" = "unterricht"."id") AND ("es"."eltern_id" = "auth"."uid"()))))));



ALTER TABLE "public"."unterricht" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."unterricht_lehrer" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."unterricht_schueler" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."unterricht_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."unterricht_stuecke" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "us: admin+lehrer" ON "public"."unterricht_schueler" USING ((("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"])) OR "public"."ist_lehrer_von_unterricht"("unterricht_id"))) WITH CHECK ((("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"])) OR "public"."ist_lehrer_von_unterricht"("unterricht_id")));



CREATE POLICY "us: lesen" ON "public"."unterricht_schueler" FOR SELECT USING ((("schueler_id" = "auth"."uid"()) OR ("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"])) OR "public"."ist_lehrer_von_unterricht"("unterricht_id") OR (EXISTS ( SELECT 1
   FROM "public"."eltern_schueler"
  WHERE (("eltern_schueler"."eltern_id" = "auth"."uid"()) AND ("eltern_schueler"."schueler_id" = "unterricht_schueler"."schueler_id"))))));



CREATE POLICY "ust: admin+lehrer" ON "public"."unterricht_stuecke" USING (("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle", 'lehrer'::"public"."user_rolle"]))) WITH CHECK (("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle", 'lehrer'::"public"."user_rolle"])));



CREATE POLICY "ust: lesen" ON "public"."unterricht_stuecke" FOR SELECT USING (("auth"."uid"() IS NOT NULL));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."session_reaktionen";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."session_teilnehmer";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."unterricht_sessions";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";































































































































































GRANT ALL ON FUNCTION "public"."admin_set_password"("p_user_id" "uuid", "p_passwort" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_set_password"("p_user_id" "uuid", "p_passwort" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_set_password"("p_user_id" "uuid", "p_passwort" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."anwesenheit_erfassen"("p_stunde_id" "uuid", "p_schueler" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."anwesenheit_erfassen"("p_stunde_id" "uuid", "p_schueler" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."anwesenheit_erfassen"("p_stunde_id" "uuid", "p_schueler" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_unterricht"("p_name" "text", "p_typ" "public"."unterricht_typ", "p_instrument_id" "uuid", "p_lehrer_ids" "uuid"[], "p_raum_id" "uuid", "p_wochentag" "public"."wochentag", "p_uhrzeit_von" time without time zone, "p_uhrzeit_bis" time without time zone, "p_abrechnungs_typ" "public"."abrechnungs_typ", "p_preis" numeric, "p_schule_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_unterricht"("p_name" "text", "p_typ" "public"."unterricht_typ", "p_instrument_id" "uuid", "p_lehrer_ids" "uuid"[], "p_raum_id" "uuid", "p_wochentag" "public"."wochentag", "p_uhrzeit_von" time without time zone, "p_uhrzeit_bis" time without time zone, "p_abrechnungs_typ" "public"."abrechnungs_typ", "p_preis" numeric, "p_schule_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_unterricht"("p_name" "text", "p_typ" "public"."unterricht_typ", "p_instrument_id" "uuid", "p_lehrer_ids" "uuid"[], "p_raum_id" "uuid", "p_wochentag" "public"."wochentag", "p_uhrzeit_von" time without time zone, "p_uhrzeit_bis" time without time zone, "p_abrechnungs_typ" "public"."abrechnungs_typ", "p_preis" numeric, "p_schule_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_user"("p_email" "text", "p_passwort" "text", "p_voller_name" "text", "p_rolle" "public"."user_rolle", "p_schule_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_user"("p_email" "text", "p_passwort" "text", "p_voller_name" "text", "p_rolle" "public"."user_rolle", "p_schule_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_user"("p_email" "text", "p_passwort" "text", "p_voller_name" "text", "p_rolle" "public"."user_rolle", "p_schule_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."dashboard_stats"("p_schule_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."dashboard_stats"("p_schule_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."dashboard_stats"("p_schule_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_auth_user"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_auth_user"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_auth_user"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_or_create_kalender_token"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_kalender_token"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_kalender_token"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ist_elternteil_von"("p_schueler_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."ist_elternteil_von"("p_schueler_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ist_elternteil_von"("p_schueler_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."ist_lehrer_von_schueler"("p_schueler_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."ist_lehrer_von_schueler"("p_schueler_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ist_lehrer_von_schueler"("p_schueler_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."ist_lehrer_von_unterricht"("p_unterricht_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."ist_lehrer_von_unterricht"("p_unterricht_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ist_lehrer_von_unterricht"("p_unterricht_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mein_stundenplan"("p_von" "date", "p_bis" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."mein_stundenplan"("p_von" "date", "p_bis" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mein_stundenplan"("p_von" "date", "p_bis" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."meine_rolle"() TO "anon";
GRANT ALL ON FUNCTION "public"."meine_rolle"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."meine_rolle"() TO "service_role";



GRANT ALL ON FUNCTION "public"."meine_schule"() TO "anon";
GRANT ALL ON FUNCTION "public"."meine_schule"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."meine_schule"() TO "service_role";



GRANT ALL ON FUNCTION "public"."paket_stunde_verbrauchen"("p_schueler_id" "uuid", "p_unterricht_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."paket_stunde_verbrauchen"("p_schueler_id" "uuid", "p_unterricht_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."paket_stunde_verbrauchen"("p_schueler_id" "uuid", "p_unterricht_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."raum_belegung"("p_raum_id" "uuid", "p_von" "date", "p_bis" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."raum_belegung"("p_raum_id" "uuid", "p_von" "date", "p_bis" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."raum_belegung"("p_raum_id" "uuid", "p_von" "date", "p_bis" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."session_beenden"("p_session_id" "uuid", "p_anwesenheit" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."session_beenden"("p_session_id" "uuid", "p_anwesenheit" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."session_beenden"("p_session_id" "uuid", "p_anwesenheit" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."session_beitreten"("p_join_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."session_beitreten"("p_join_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."session_beitreten"("p_join_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."session_praesentation_wechseln"("p_session_id" "uuid", "p_ansicht" "public"."praesentation_typ", "p_stueck_id" "uuid", "p_datei_id" "uuid", "p_scroll_position" integer, "p_youtube_ts" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."session_praesentation_wechseln"("p_session_id" "uuid", "p_ansicht" "public"."praesentation_typ", "p_stueck_id" "uuid", "p_datei_id" "uuid", "p_scroll_position" integer, "p_youtube_ts" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."session_praesentation_wechseln"("p_session_id" "uuid", "p_ansicht" "public"."praesentation_typ", "p_stueck_id" "uuid", "p_datei_id" "uuid", "p_scroll_position" integer, "p_youtube_ts" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."session_starten"("p_unterricht_id" "uuid", "p_stunde_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."session_starten"("p_unterricht_id" "uuid", "p_stunde_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."session_starten"("p_unterricht_id" "uuid", "p_stunde_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."stunden_generieren"("p_unterricht_id" "uuid", "p_von" "date", "p_bis" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."stunden_generieren"("p_unterricht_id" "uuid", "p_von" "date", "p_bis" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."stunden_generieren"("p_unterricht_id" "uuid", "p_von" "date", "p_bis" "date") TO "service_role";


















GRANT ALL ON TABLE "public"."anwesenheit" TO "anon";
GRANT ALL ON TABLE "public"."anwesenheit" TO "authenticated";
GRANT ALL ON TABLE "public"."anwesenheit" TO "service_role";



GRANT ALL ON TABLE "public"."dateien" TO "anon";
GRANT ALL ON TABLE "public"."dateien" TO "authenticated";
GRANT ALL ON TABLE "public"."dateien" TO "service_role";



GRANT ALL ON TABLE "public"."eltern_schueler" TO "anon";
GRANT ALL ON TABLE "public"."eltern_schueler" TO "authenticated";
GRANT ALL ON TABLE "public"."eltern_schueler" TO "service_role";



GRANT ALL ON TABLE "public"."event_stuecke" TO "anon";
GRANT ALL ON TABLE "public"."event_stuecke" TO "authenticated";
GRANT ALL ON TABLE "public"."event_stuecke" TO "service_role";



GRANT ALL ON TABLE "public"."event_teilnehmer" TO "anon";
GRANT ALL ON TABLE "public"."event_teilnehmer" TO "authenticated";
GRANT ALL ON TABLE "public"."event_teilnehmer" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."instrumente" TO "anon";
GRANT ALL ON TABLE "public"."instrumente" TO "authenticated";
GRANT ALL ON TABLE "public"."instrumente" TO "service_role";



GRANT ALL ON TABLE "public"."interessenten" TO "anon";
GRANT ALL ON TABLE "public"."interessenten" TO "authenticated";
GRANT ALL ON TABLE "public"."interessenten" TO "service_role";



GRANT ALL ON TABLE "public"."kalender_tokens" TO "anon";
GRANT ALL ON TABLE "public"."kalender_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."kalender_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."lehrer_instrumente" TO "anon";
GRANT ALL ON TABLE "public"."lehrer_instrumente" TO "authenticated";
GRANT ALL ON TABLE "public"."lehrer_instrumente" TO "service_role";



GRANT ALL ON TABLE "public"."mitglied_dateien" TO "anon";
GRANT ALL ON TABLE "public"."mitglied_dateien" TO "authenticated";
GRANT ALL ON TABLE "public"."mitglied_dateien" TO "service_role";



GRANT ALL ON TABLE "public"."nachricht_gelesen" TO "anon";
GRANT ALL ON TABLE "public"."nachricht_gelesen" TO "authenticated";
GRANT ALL ON TABLE "public"."nachricht_gelesen" TO "service_role";



GRANT ALL ON TABLE "public"."nachrichten" TO "anon";
GRANT ALL ON TABLE "public"."nachrichten" TO "authenticated";
GRANT ALL ON TABLE "public"."nachrichten" TO "service_role";



GRANT ALL ON TABLE "public"."pakete" TO "anon";
GRANT ALL ON TABLE "public"."pakete" TO "authenticated";
GRANT ALL ON TABLE "public"."pakete" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."raeume" TO "anon";
GRANT ALL ON TABLE "public"."raeume" TO "authenticated";
GRANT ALL ON TABLE "public"."raeume" TO "service_role";



GRANT ALL ON TABLE "public"."rechnungen" TO "anon";
GRANT ALL ON TABLE "public"."rechnungen" TO "authenticated";
GRANT ALL ON TABLE "public"."rechnungen" TO "service_role";



GRANT ALL ON TABLE "public"."schulen" TO "anon";
GRANT ALL ON TABLE "public"."schulen" TO "authenticated";
GRANT ALL ON TABLE "public"."schulen" TO "service_role";



GRANT ALL ON TABLE "public"."session_reaktionen" TO "anon";
GRANT ALL ON TABLE "public"."session_reaktionen" TO "authenticated";
GRANT ALL ON TABLE "public"."session_reaktionen" TO "service_role";



GRANT ALL ON TABLE "public"."session_teilnehmer" TO "anon";
GRANT ALL ON TABLE "public"."session_teilnehmer" TO "authenticated";
GRANT ALL ON TABLE "public"."session_teilnehmer" TO "service_role";



GRANT ALL ON TABLE "public"."stueck_dateien" TO "anon";
GRANT ALL ON TABLE "public"."stueck_dateien" TO "authenticated";
GRANT ALL ON TABLE "public"."stueck_dateien" TO "service_role";



GRANT ALL ON TABLE "public"."stuecke" TO "anon";
GRANT ALL ON TABLE "public"."stuecke" TO "authenticated";
GRANT ALL ON TABLE "public"."stuecke" TO "service_role";



GRANT ALL ON TABLE "public"."stunden" TO "anon";
GRANT ALL ON TABLE "public"."stunden" TO "authenticated";
GRANT ALL ON TABLE "public"."stunden" TO "service_role";



GRANT ALL ON TABLE "public"."stunden_lehrer" TO "anon";
GRANT ALL ON TABLE "public"."stunden_lehrer" TO "authenticated";
GRANT ALL ON TABLE "public"."stunden_lehrer" TO "service_role";



GRANT ALL ON TABLE "public"."unterricht" TO "anon";
GRANT ALL ON TABLE "public"."unterricht" TO "authenticated";
GRANT ALL ON TABLE "public"."unterricht" TO "service_role";



GRANT ALL ON TABLE "public"."unterricht_lehrer" TO "anon";
GRANT ALL ON TABLE "public"."unterricht_lehrer" TO "authenticated";
GRANT ALL ON TABLE "public"."unterricht_lehrer" TO "service_role";



GRANT ALL ON TABLE "public"."unterricht_schueler" TO "anon";
GRANT ALL ON TABLE "public"."unterricht_schueler" TO "authenticated";
GRANT ALL ON TABLE "public"."unterricht_schueler" TO "service_role";



GRANT ALL ON TABLE "public"."unterricht_sessions" TO "anon";
GRANT ALL ON TABLE "public"."unterricht_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."unterricht_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."unterricht_stuecke" TO "anon";
GRANT ALL ON TABLE "public"."unterricht_stuecke" TO "authenticated";
GRANT ALL ON TABLE "public"."unterricht_stuecke" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































