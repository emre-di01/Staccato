-- Reservierungen aus dem Ticketshop werden nur online bezahlt: während jemand bei Stripe bezahlt, darf niemand dieselbe
-- Bestellung bar kassieren (sonst doppelt bezahlt). Sonst unverändert (Stand 20261124000003 bzw. 20261124000008).

-- grund: nicht_offen | verfallen | betrag
CREATE OR REPLACE FUNCTION public.ticket_zahlung_bestaetigen(p_bestellung_id uuid, p_betrag numeric)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_event uuid;
  v_b record;
  v_summe numeric(10,2);
BEGIN
  SELECT event_id INTO v_event FROM public.ticket_bestellungen WHERE id = p_bestellung_id;
  IF auth.uid() IS NULL OR v_event IS NULL OR NOT public.darf_kassieren(v_event) THEN
    RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.ticket_einstellungen WHERE event_id = v_event FOR UPDATE;
  SELECT * INTO v_b FROM public.ticket_bestellungen WHERE id = p_bestellung_id FOR UPDATE;

  IF v_b.herkunft = 'shop' THEN
    RETURN jsonb_build_object('ok', false, 'grund', 'nicht_offen');
  ELSIF v_b.status = 'verfallen' OR (v_b.status = 'reserviert' AND v_b.frist <= clock_timestamp()) THEN
    RETURN jsonb_build_object('ok', false, 'grund', 'verfallen');
  ELSIF v_b.status <> 'reserviert' THEN
    RETURN jsonb_build_object('ok', false, 'grund', 'nicht_offen');
  END IF;
  SELECT coalesce(sum(preis), 0) INTO v_summe FROM public.tickets WHERE bestellung_id = p_bestellung_id AND status = 'reserviert';
  IF p_betrag IS DISTINCT FROM v_summe THEN
    RETURN jsonb_build_object('ok', false, 'grund', 'betrag');
  END IF;

  INSERT INTO public.ticket_zahlungen (bestellung_id, methode, betrag, angenommen_von)
  VALUES (p_bestellung_id, 'bar', v_summe, auth.uid());
  UPDATE public.tickets SET status = 'gueltig', code = replace(gen_random_uuid()::text, '-', '')
  WHERE bestellung_id = p_bestellung_id AND status = 'reserviert';
  UPDATE public.ticket_bestellungen SET status = 'bezahlt', frist = NULL WHERE id = p_bestellung_id;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.abendkasse_reservierungen(p_event_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.darf_kassieren(p_event_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501';
  END IF;
  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'status', x.status, 'anzahl', x.anzahl, 'betrag', x.betrag,
      'ticket_ids', CASE WHEN x.status = 'bezahlt' THEN x.ids END) ORDER BY x.name, x.status DESC, x.id), '[]'::jsonb)
    FROM (SELECT b.id, b.status, coalesce(p.voller_name, b.kaeufer_name, '–') AS name, count(*) AS anzahl, sum(t.preis) AS betrag,
                 jsonb_agg(t.id ORDER BY t.preis, t.id) AS ids
          FROM public.ticket_bestellungen b
          JOIN public.tickets t ON t.bestellung_id = b.id
            AND t.status = CASE b.status WHEN 'reserviert' THEN 'reserviert' ELSE 'gueltig' END
          LEFT JOIN public.profiles p ON p.id = b.kaeufer_id
          WHERE b.event_id = p_event_id AND ((b.status = 'reserviert' AND b.frist > now() AND b.herkunft <> 'shop') OR b.status = 'bezahlt')
          GROUP BY b.id, b.status, p.voller_name, b.kaeufer_name) x);
END;
$function$;
