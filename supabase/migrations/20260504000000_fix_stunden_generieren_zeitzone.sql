-- stunden_generieren interpretierte naive Zeitangaben als UTC statt als Schul-Zeitzone.
-- Fix: Schulzeitzone aus schulen.zeitzone lesen und per AT TIME ZONE anwenden.
CREATE OR REPLACE FUNCTION public.stunden_generieren(p_unterricht_id uuid, p_von date, p_bis date)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
AS $$
declare
  v_u     record;
  v_tz    text;
  v_datum date;
  v_ziel  integer;
  v_count integer := 0;
  v_sid   uuid;
begin
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
$$;
