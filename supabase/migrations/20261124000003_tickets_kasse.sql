-- Ticketverkauf Schritt 4: Geldeingang bestätigen (Admin oder Freigabe „Kasse“), Storno und Erstattung (nur Admin)
--
-- Alle Funktionen sperren zuerst die Zeile in ticket_einstellungen (gleiche Reihenfolge wie tickets_reservieren),
-- damit Bezahlen, Stornieren und Reservieren derselben Veranstaltung nacheinander laufen.
-- Zahlungen und Erstattungen werden nur angelegt, nie geändert. Eine irrtümlich bestätigte Zahlung wird
-- über Storno + Erstattung korrigiert.
-- Ergebnis jeweils { ok } oder { ok: false, grund }; fehlende Berechtigung und unbekannte Bestellung: 42501.

CREATE OR REPLACE FUNCTION public.darf_kassieren(p_event_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $function$
  SELECT public.ist_admin_von_event(p_event_id) OR EXISTS (
    SELECT 1 FROM public.ticket_freigaben f
    JOIN public.events e ON e.id = f.event_id
    JOIN public.schul_mitgliedschaften m ON m.schule_id = e.schule_id AND m.user_id = f.profil_id AND m.aktiv
    JOIN public.profiles p ON p.id = f.profil_id AND p.aktiv IS NOT FALSE
    WHERE f.event_id = p_event_id AND f.profil_id = auth.uid() AND f.kasse);
$function$;

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

  IF v_b.status = 'verfallen' OR (v_b.status = 'reserviert' AND v_b.frist <= clock_timestamp()) THEN
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

-- Noch erstattbar: bezahlte, stornierte Tickets der Bestellung abzüglich bisheriger Erstattungen.
-- Nur für Admins der Schule, sonst 0.
CREATE OR REPLACE FUNCTION public.ticket_erstattbar(p_bestellung_id uuid)
 RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $function$
  SELECT CASE WHEN NOT public.ist_admin_von_bestellung(p_bestellung_id) THEN 0 ELSE greatest(least(
      (SELECT coalesce(sum(t.preis), 0) FROM public.tickets t
       WHERE t.bestellung_id = p_bestellung_id AND t.status = 'storniert' AND t.code IS NOT NULL),
      (SELECT coalesce(sum(z.betrag), 0) FROM public.ticket_zahlungen z WHERE z.bestellung_id = p_bestellung_id))
    - (SELECT coalesce(sum(r.betrag), 0) FROM public.ticket_erstattungen r
       JOIN public.ticket_zahlungen z ON z.id = r.zahlung_id WHERE z.bestellung_id = p_bestellung_id), 0) END;
$function$;

-- Tickets einer Bestellung stornieren, bei bezahlten optional mit Barerstattung.
-- grund: auswahl | nicht_stornierbar | erstattung
CREATE OR REPLACE FUNCTION public.tickets_stornieren(p_bestellung_id uuid, p_ticket_ids uuid[], p_erstattung numeric DEFAULT 0)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_event uuid;
  v_b record;
  v_ids uuid[];
  v_passend integer;
  v_neu_erstattbar numeric;
BEGIN
  SELECT event_id INTO v_event FROM public.ticket_bestellungen WHERE id = p_bestellung_id;
  IF auth.uid() IS NULL OR v_event IS NULL OR NOT public.ist_admin_von_bestellung(p_bestellung_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.ticket_einstellungen WHERE event_id = v_event FOR UPDATE;
  SELECT * INTO v_b FROM public.ticket_bestellungen WHERE id = p_bestellung_id FOR UPDATE;

  SELECT array_agg(DISTINCT x) INTO v_ids FROM unnest(p_ticket_ids) AS x WHERE x IS NOT NULL;
  IF v_ids IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'grund', 'auswahl');
  END IF;
  -- Eingelöste, verfallene und bereits stornierte Tickets bleiben, wie sie sind
  SELECT count(*), coalesce(sum(preis) FILTER (WHERE code IS NOT NULL), 0) INTO v_passend, v_neu_erstattbar
  FROM public.tickets
  WHERE bestellung_id = p_bestellung_id AND id = ANY (v_ids) AND status IN ('reserviert', 'gueltig');
  IF v_passend <> cardinality(v_ids) OR v_b.status NOT IN ('reserviert', 'bezahlt') THEN
    RETURN jsonb_build_object('ok', false, 'grund', 'nicht_stornierbar');
  END IF;
  IF coalesce(p_erstattung, 0) < 0 OR coalesce(p_erstattung, 0) <> round(coalesce(p_erstattung, 0), 2)
     OR (coalesce(p_erstattung, 0) > 0 AND (NOT EXISTS (SELECT 1 FROM public.ticket_zahlungen WHERE bestellung_id = p_bestellung_id)
         OR p_erstattung > v_neu_erstattbar)) THEN
    RETURN jsonb_build_object('ok', false, 'grund', 'erstattung');
  END IF;

  UPDATE public.tickets SET status = 'storniert', storniert_am = now(), storniert_von = auth.uid() WHERE id = ANY (v_ids);
  IF NOT EXISTS (SELECT 1 FROM public.tickets WHERE bestellung_id = p_bestellung_id AND status IN ('reserviert', 'gueltig', 'eingeloest')) THEN
    UPDATE public.ticket_bestellungen SET status = 'storniert' WHERE id = p_bestellung_id;
  END IF;
  IF coalesce(p_erstattung, 0) > 0 THEN
    INSERT INTO public.ticket_erstattungen (zahlung_id, betrag, erstattet_von)
    SELECT id, p_erstattung, auth.uid() FROM public.ticket_zahlungen WHERE bestellung_id = p_bestellung_id ORDER BY zeitpunkt LIMIT 1;
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

-- Erstattung nachträglich festhalten (z. B. Geld erst später ausgezahlt). grund: erstattung
CREATE OR REPLACE FUNCTION public.ticket_erstattung_erfassen(p_bestellung_id uuid, p_betrag numeric)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.ist_admin_von_bestellung(p_bestellung_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.ticket_bestellungen WHERE id = p_bestellung_id FOR UPDATE;
  IF p_betrag IS NULL OR p_betrag <= 0 OR p_betrag <> round(p_betrag, 2) OR p_betrag > public.ticket_erstattbar(p_bestellung_id) THEN
    RETURN jsonb_build_object('ok', false, 'grund', 'erstattung');
  END IF;
  INSERT INTO public.ticket_erstattungen (zahlung_id, betrag, erstattet_von)
  SELECT id, p_betrag, auth.uid() FROM public.ticket_zahlungen WHERE bestellung_id = p_bestellung_id ORDER BY zeitpunkt LIMIT 1;
  RETURN jsonb_build_object('ok', true);
END;
$function$;
