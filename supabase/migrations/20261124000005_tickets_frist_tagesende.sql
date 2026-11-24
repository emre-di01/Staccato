-- ticket_info(): Zahlungsfrist endet am Tagesende statt auf die Minute genau (sonst unverändert, Stand 20261124000002)
CREATE OR REPLACE FUNCTION public.ticket_info(p_event_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_ich uuid := auth.uid();
  v_e record;
  v_belegt integer;
  v_meine integer;
  v_meine_verg integer;
  v_frei integer;
  v_frist timestamptz;
  v_grund text;
BEGIN
  IF v_ich IS NULL THEN
    RAISE EXCEPTION 'Nicht angemeldet' USING ERRCODE = '42501';
  END IF;

  SELECT te.*, ev.beginn, ev.schule_id, ev.typ, coalesce(s.zeitzone, 'Europe/Berlin') AS zeitzone INTO v_e
  FROM public.ticket_einstellungen te JOIN public.events ev ON ev.id = te.event_id JOIN public.schulen s ON s.id = ev.schule_id
  WHERE te.event_id = p_event_id;
  IF NOT FOUND OR NOT v_e.aktiv OR v_e.typ = 'vorstandssitzung' OR NOT public.sieht_event(p_event_id) THEN
    RETURN jsonb_build_object('ok', false, 'grund', 'nicht_verfuegbar');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.schul_mitgliedschaften m JOIN public.profiles p ON p.id = m.user_id
                 WHERE m.user_id = v_ich AND m.schule_id = v_e.schule_id AND m.aktiv AND p.aktiv IS NOT FALSE) THEN
    RETURN jsonb_build_object('ok', false, 'grund', 'kein_mitglied');
  END IF;

  SELECT count(*),
         count(*) FILTER (WHERE b.kaeufer_id = v_ich),
         count(*) FILTER (WHERE b.kaeufer_id = v_ich AND t.verguenstigt)
    INTO v_belegt, v_meine, v_meine_verg
  FROM public.tickets t JOIN public.ticket_bestellungen b ON b.id = t.bestellung_id
  WHERE t.event_id = p_event_id
    AND (t.status IN ('gueltig', 'eingeloest') OR (t.status = 'reserviert' AND b.frist > now()));
  v_frei := greatest(v_e.kapazitaet - v_belegt, 0);

  v_frist := CASE WHEN v_e.bis_abendkasse
    THEN v_e.beginn - make_interval(mins => v_e.freigabe_minuten)
    ELSE least(
      -- Ende des letzten Tages in der Zeitzone der Schule (23:59), damit „bis Freitag“ auch den ganzen Freitag meint
      (date_trunc('day', now() AT TIME ZONE v_e.zeitzone) + make_interval(days => v_e.frist_tage + 1) - interval '1 minute') AT TIME ZONE v_e.zeitzone,
      coalesce(v_e.verkauf_bis, v_e.beginn), v_e.beginn) END;

  v_grund := CASE
    WHEN now() < v_e.verkauf_von THEN 'noch_nicht'
    WHEN now() >= v_e.beginn OR now() >= v_e.verkauf_bis OR now() >= v_frist THEN 'beendet'
    WHEN v_meine >= v_e.obergrenze THEN 'obergrenze'
    WHEN v_frei = 0 THEN 'ausverkauft'
  END;

  RETURN jsonb_build_object(
    'ok', v_grund IS NULL, 'grund', v_grund,
    'frei', v_frei, 'meine', v_meine,
    'max', least(v_frei, greatest(v_e.obergrenze - v_meine, 0)),
    'rest_verguenstigt', CASE WHEN v_e.preis_verguenstigt IS NULL THEN 0 ELSE greatest(v_e.kontingent - v_meine_verg, 0) END,
    'preis_normal', v_e.preis_normal, 'preis_verguenstigt', v_e.preis_verguenstigt,
    'frist', v_frist, 'verkauf_von', v_e.verkauf_von);
END;
$function$;
