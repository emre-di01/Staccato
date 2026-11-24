-- Abendkasse: bezahlte Tickets ohne Handy/Ausdruck per Namen einlassen (Admin oder Freigabe „Kasse“, nur bei offener Abendkasse)

-- Liste für die Namenssuche: offene Reservierungen und bezahlte, noch nicht eingelöste Tickets.
-- { id, name, status: reserviert|bezahlt, anzahl, betrag, ticket_ids } – ticket_ids nur bei bezahlten, nie Codes
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
          WHERE b.event_id = p_event_id AND ((b.status = 'reserviert' AND b.frist > now()) OR b.status = 'bezahlt')
          GROUP BY b.id, b.status, p.voller_name, b.kaeufer_name) x);
END;
$function$;

-- Ergebnis: { ok, anzahl } oder { ok: false, grund: geschlossen | anzahl | schon_drin }
-- Wiederholung nach Netzaussetzer: Wurden genau diese Tickets eben von mir eingelassen, ist das Ergebnis wieder ok.
CREATE OR REPLACE FUNCTION public.abendkasse_einlassen(p_bestellung_id uuid, p_ticket_ids uuid[])
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_event uuid;
  v_ids uuid[];
  v_gueltig integer;
  v_eben integer;
BEGIN
  SELECT event_id INTO v_event FROM public.ticket_bestellungen WHERE id = p_bestellung_id;
  IF auth.uid() IS NULL OR v_event IS NULL OR NOT public.darf_kassieren(v_event) THEN
    RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.ticket_einstellungen WHERE event_id = v_event FOR UPDATE;
  IF NOT public.abendkasse_offen(v_event) THEN RETURN jsonb_build_object('ok', false, 'grund', 'geschlossen'); END IF;

  SELECT array_agg(DISTINCT x) INTO v_ids FROM unnest(p_ticket_ids) AS x WHERE x IS NOT NULL;
  IF v_ids IS NULL THEN RETURN jsonb_build_object('ok', false, 'grund', 'anzahl'); END IF;
  SELECT count(*) FILTER (WHERE t.status = 'gueltig'),
         count(*) FILTER (WHERE t.status = 'eingeloest' AND t.an_kasse AND t.eingeloest_am > clock_timestamp() - interval '2 minutes'
           AND EXISTS (SELECT 1 FROM public.ticket_scans s WHERE s.ticket_id = t.id AND s.ergebnis = 'ok' AND s.gescannt_von = auth.uid()))
    INTO v_gueltig, v_eben
  FROM public.tickets t WHERE t.bestellung_id = p_bestellung_id AND t.id = ANY (v_ids);
  IF v_eben = cardinality(v_ids) THEN RETURN jsonb_build_object('ok', true, 'anzahl', v_eben); END IF;
  IF v_gueltig <> cardinality(v_ids) THEN RETURN jsonb_build_object('ok', false, 'grund', 'schon_drin'); END IF;

  UPDATE public.tickets SET status = 'eingeloest', eingeloest_am = clock_timestamp(), an_kasse = true WHERE id = ANY (v_ids);
  INSERT INTO public.ticket_scans (event_id, ticket_id, gescannt_von, ergebnis)
  SELECT v_event, x, auth.uid(), 'ok' FROM unnest(v_ids) AS x;
  RETURN jsonb_build_object('ok', true, 'anzahl', v_gueltig);
END;
$function$;
