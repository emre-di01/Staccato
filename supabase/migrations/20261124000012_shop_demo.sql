-- Ticketshop als Demo: mit einem Stripe-Testschlüssel lässt sich der Shop öffentlich zeigen, auch in Prod
--
-- Demo-Tickets haben einen eigenen Status. Alle Zählungen (Plätze, Kontingente, Einlass, Abendkasse) kennen nur
-- reserviert/gueltig/eingeloest – Demo-Tickets belegen also nichts und lassen niemanden hinein.

ALTER TABLE public.ticket_bestellungen ADD COLUMN IF NOT EXISTS demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_status_check;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_status_check CHECK (status IN ('reserviert', 'gueltig', 'eingeloest', 'storniert', 'verfallen', 'demo'));
ALTER TABLE public.ticket_scans DROP CONSTRAINT IF EXISTS ticket_scans_ergebnis_check;
ALTER TABLE public.ticket_scans ADD CONSTRAINT ticket_scans_ergebnis_check CHECK (ergebnis IN ('ok', 'schon_eingeloest', 'storniert', 'falsche_veranstaltung', 'unbekannt', 'demo'));

-- Einlass: Ergebnis zusätzlich „demo“, sonst unverändert (Stand 20261124000006)
CREATE OR REPLACE FUNCTION public.ticket_scannen(p_event_id uuid, p_code text, p_scan_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_event record;
  v_scan record;
  v_t record;
  v_ergebnis text;
  v_titel text;
  v_zeit timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT public.darf_scannen(p_event_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501';
  END IF;
  IF p_scan_id IS NULL THEN
    RAISE EXCEPTION 'scan_id fehlt' USING ERRCODE = '22023';
  END IF;
  SELECT id, schule_id, beginn, coalesce(ende, beginn + interval '6 hours') AS ende INTO v_event FROM public.events WHERE id = p_event_id;
  IF clock_timestamp() < v_event.beginn - interval '12 hours' THEN
    RETURN jsonb_build_object('ergebnis', 'zu_frueh', 'ab', v_event.beginn - interval '12 hours');
  ELSIF clock_timestamp() > v_event.ende + interval '6 hours' THEN
    RETURN jsonb_build_object('ergebnis', 'vorbei');
  END IF;

  PERFORM 1 FROM public.ticket_einstellungen WHERE event_id = p_event_id FOR SHARE;
  SELECT t.id, t.event_id, t.status, t.eingeloest_am, e.titel, e.schule_id INTO v_t
  FROM public.tickets t JOIN public.events e ON e.id = t.event_id
  WHERE t.code = p_code FOR UPDATE OF t;

  SELECT * INTO v_scan FROM public.ticket_scans WHERE id = p_scan_id;
  IF FOUND THEN
    IF v_scan.gescannt_von IS DISTINCT FROM auth.uid() OR v_scan.event_id <> p_event_id
       OR v_scan.ticket_id IS DISTINCT FROM (CASE WHEN v_t.schule_id = v_event.schule_id THEN v_t.id END) THEN
      RAISE EXCEPTION 'scan_id schon vergeben' USING ERRCODE = '22023';
    END IF;
    v_ergebnis := v_scan.ergebnis;
    v_zeit := v_t.eingeloest_am;
  ELSE
    IF v_t.id IS NULL OR v_t.schule_id <> v_event.schule_id THEN
      v_ergebnis := 'unbekannt';   -- Tickets anderer Schulen werden nicht verraten
    ELSIF v_t.event_id <> p_event_id THEN
      v_ergebnis := 'falsche_veranstaltung';
    ELSIF v_t.status = 'gueltig' THEN
      v_ergebnis := 'ok';
      v_zeit := clock_timestamp();
      UPDATE public.tickets SET status = 'eingeloest', eingeloest_am = v_zeit WHERE id = v_t.id;
    ELSIF v_t.status = 'eingeloest' THEN
      v_ergebnis := 'schon_eingeloest';
      v_zeit := v_t.eingeloest_am;
    ELSIF v_t.status = 'demo' THEN
      v_ergebnis := 'demo';   -- im Testmodus gekauft: nie einlassen
    ELSE
      v_ergebnis := 'storniert';
    END IF;
    INSERT INTO public.ticket_scans (id, event_id, ticket_id, gescannt_von, ergebnis)
    VALUES (p_scan_id, p_event_id, CASE WHEN v_t.schule_id = v_event.schule_id THEN v_t.id END, auth.uid(), v_ergebnis);
  END IF;
  IF v_ergebnis = 'falsche_veranstaltung' THEN v_titel := v_t.titel; END IF;

  RETURN jsonb_build_object('ergebnis', v_ergebnis,
    'eingeloest_am', CASE WHEN v_ergebnis IN ('ok', 'schon_eingeloest') THEN v_zeit END,
    'event_titel', v_titel,
    'eingelassen', (SELECT count(*) FROM public.tickets WHERE event_id = p_event_id AND status = 'eingeloest'),
    'gesamt', (SELECT count(*) FROM public.tickets WHERE event_id = p_event_id AND status IN ('gueltig', 'eingeloest')));
END;
$function$;

-- Shop: sonst unverändert (Stand 20261124000009 bzw. 20261124000011)
CREATE OR REPLACE FUNCTION public.shop_reservieren(p_event_id uuid, p_anzahl integer, p_betrag numeric, p_name text, p_email text, p_sprache text, p_ip_hash text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_lage jsonb;
  v_name text := left(btrim(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]]', ' ', 'g')), 80);
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_id uuid;
  v_zugang text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_schule uuid;
  v_demo boolean;
BEGIN
  IF NOT public.ist_intern() THEN RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501'; END IF;
  IF length(v_name) < 2 OR length(v_email) > 200 OR v_email !~ '^[^@\s<>",;]+@[^@\s<>",;]+\.[^@\s<>",;]{2,}$' THEN
    RETURN jsonb_build_object('ok', false, 'grund', 'angaben');
  END IF;
  DELETE FROM public.shop_drossel WHERE zeit < now() - interval '24 hours';
  IF (SELECT count(*) FROM public.shop_drossel WHERE ip_hash = p_ip_hash AND zeit > now() - interval '1 hour') >= 15
     OR (SELECT count(*) FROM public.ticket_bestellungen WHERE event_id = p_event_id AND kaeufer_email = v_email AND status = 'reserviert' AND frist > now()) >= 3 THEN
    RETURN jsonb_build_object('ok', false, 'grund', 'zu_viele');
  END IF;
  INSERT INTO public.shop_drossel (ip_hash) VALUES (coalesce(p_ip_hash, '-'));

  PERFORM 1 FROM public.ticket_einstellungen WHERE event_id = p_event_id FOR UPDATE;
  v_lage := public.shop_lage(p_event_id);
  IF NOT (v_lage->>'ok')::boolean THEN RETURN jsonb_build_object('ok', false, 'grund', v_lage->>'grund'); END IF;
  IF p_anzahl IS NULL OR p_anzahl < 1 THEN RETURN jsonb_build_object('ok', false, 'grund', 'anzahl'); END IF;
  IF p_anzahl > (v_lage->>'max')::int THEN
    RETURN jsonb_build_object('ok', false, 'grund', CASE WHEN p_anzahl > (v_lage->>'frei')::int THEN 'zu_wenig_frei' ELSE 'anzahl' END);
  END IF;
  IF p_betrag IS DISTINCT FROM p_anzahl * (v_lage->>'preis')::numeric THEN RETURN jsonb_build_object('ok', false, 'grund', 'betrag'); END IF;

  SELECT e.schule_id, NOT k.livemode INTO v_schule, v_demo FROM public.events e JOIN public.schul_zahlungskonten k ON k.schule_id = e.schule_id WHERE e.id = p_event_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'grund', 'nicht_verfuegbar'); END IF;
  INSERT INTO public.ticket_bestellungen (schule_id, event_id, herkunft, kaeufer_name, kaeufer_email, sprache, zugang, status, frist, demo)
  VALUES (v_schule, p_event_id, 'shop', v_name, v_email, CASE WHEN p_sprache IN ('de', 'en', 'tr') THEN p_sprache ELSE 'de' END, v_zugang, 'reserviert', now() + interval '35 minutes', v_demo)
  RETURNING id INTO v_id;
  INSERT INTO public.tickets (bestellung_id, event_id, preis, status) SELECT v_id, p_event_id, (v_lage->>'preis')::numeric, CASE WHEN v_demo THEN 'demo' ELSE 'reserviert' END FROM generate_series(1, p_anzahl);
  RETURN jsonb_build_object('ok', true, 'bestellung_id', v_id, 'zugang', v_zugang, 'schule_id', v_schule, 'demo', v_demo, 'preis', (v_lage->>'preis')::numeric);
END;
$function$;

CREATE OR REPLACE FUNCTION public.shop_bezahlt(p_schule_id uuid, p_bestellung_id uuid, p_checkout_id text, p_zahlung_id text, p_betrag numeric, p_waehrung text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_b record;
  v_z record;
  v_kap integer;
  v_belegt integer;
  v_anzahl integer;
  v_summe numeric;
BEGIN
  IF NOT public.ist_intern() THEN RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501'; END IF;
  IF p_zahlung_id IS NULL OR p_betrag IS NULL OR lower(p_waehrung) IS DISTINCT FROM 'eur' THEN RETURN jsonb_build_object('ergebnis', 'ungueltig'); END IF;
  SELECT * INTO v_b FROM public.ticket_bestellungen WHERE id = p_bestellung_id;
  -- Bestellung, Schule (= Schlüssel, mit dem der Webhook signiert war) und Bezahlvorgang müssen zusammenpassen
  IF NOT FOUND OR v_b.herkunft <> 'shop' OR v_b.schule_id <> p_schule_id OR v_b.checkout_id IS DISTINCT FROM p_checkout_id THEN
    RETURN jsonb_build_object('ergebnis', 'ungueltig');
  END IF;
  SELECT kapazitaet INTO v_kap FROM public.ticket_einstellungen WHERE event_id = v_b.event_id FOR UPDATE;
  SELECT * INTO v_b FROM public.ticket_bestellungen WHERE id = p_bestellung_id FOR UPDATE;

  SELECT z.*, EXISTS (SELECT 1 FROM public.ticket_erstattungen r WHERE r.zahlung_id = z.id) AS erstattet INTO v_z
  FROM public.ticket_zahlungen z WHERE z.externe_id = p_zahlung_id;
  IF FOUND THEN
    IF v_z.bestellung_id <> p_bestellung_id THEN RETURN jsonb_build_object('ergebnis', 'ungueltig'); END IF;
    RETURN jsonb_build_object('ergebnis', CASE WHEN NOT v_b.auto_erstatten THEN 'schon_bezahlt' WHEN v_z.erstattet THEN 'schon_erstattet' ELSE 'erstatten' END);
  END IF;

  SELECT count(*), coalesce(sum(preis), 0) INTO v_anzahl, v_summe FROM public.tickets WHERE bestellung_id = p_bestellung_id AND status IN ('reserviert', 'verfallen', 'demo');
  SELECT count(*) INTO v_belegt FROM public.tickets t JOIN public.ticket_bestellungen b ON b.id = t.bestellung_id
  WHERE t.event_id = v_b.event_id AND b.id <> p_bestellung_id AND (t.status IN ('gueltig', 'eingeloest') OR (t.status = 'reserviert' AND b.frist > clock_timestamp()));

  INSERT INTO public.ticket_zahlungen (bestellung_id, methode, betrag, externe_id) VALUES (p_bestellung_id, 'stripe', p_betrag, p_zahlung_id);
  IF v_b.status IN ('reserviert', 'verfallen') AND v_anzahl > 0 AND p_betrag = v_summe AND (v_b.demo OR v_belegt + v_anzahl <= v_kap) THEN
    UPDATE public.tickets SET status = CASE WHEN v_b.demo THEN 'demo' ELSE 'gueltig' END, code = replace(gen_random_uuid()::text, '-', '') WHERE bestellung_id = p_bestellung_id AND status IN ('reserviert', 'verfallen', 'demo');
    UPDATE public.ticket_bestellungen SET status = 'bezahlt', frist = NULL WHERE id = p_bestellung_id;
    RETURN jsonb_build_object('ergebnis', 'bezahlt');
  END IF;
  UPDATE public.tickets SET status = 'storniert', storniert_am = now() WHERE bestellung_id = p_bestellung_id AND status IN ('reserviert', 'verfallen', 'demo');
  UPDATE public.ticket_bestellungen SET status = 'storniert', auto_erstatten = true WHERE id = p_bestellung_id;
  RETURN jsonb_build_object('ergebnis', 'erstatten');
END;
$function$;

CREATE OR REPLACE FUNCTION public.shop_bestellung(p_zugang text)
 RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  IF NOT public.ist_intern() THEN RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501'; END IF;
  RETURN (
    SELECT jsonb_build_object('id', b.id, 'schule_id', b.schule_id, 'checkout_id', b.checkout_id, 'event_id', e.id,
      'status', CASE WHEN b.status = 'reserviert' AND b.frist <= clock_timestamp() THEN 'verfallen' ELSE b.status END,
      'demo', b.demo, 'name', b.kaeufer_name, 'email', b.kaeufer_email, 'sprache', b.sprache, 'slug', sh.slug,
      'betrag', (SELECT coalesce(sum(t.preis), 0) FROM public.tickets t WHERE t.bestellung_id = b.id AND t.status <> 'storniert'),
      -- Geld zurück: bereits erstattet oder in Arbeit; automatisch = zu spät bezahlt und ausverkauft
      'zurueck', (SELECT coalesce(sum(r.betrag), 0) FROM public.ticket_erstattungen r JOIN public.ticket_zahlungen z ON z.id = r.zahlung_id WHERE z.bestellung_id = b.id)
        + (SELECT coalesce(sum(o.betrag), 0) FROM public.ticket_online_erstattungen o WHERE o.bestellung_id = b.id AND o.erledigt_am IS NULL),
      'automatisch', b.auto_erstatten OR NOT EXISTS (SELECT 1 FROM public.ticket_zahlungen z WHERE z.bestellung_id = b.id),
      'event', jsonb_build_object('id', e.id, 'titel', e.titel, 'beginn', e.beginn, 'ende', e.ende, 'ort', coalesce(nullif(e.ort, ''), r.name)),
      'schule', jsonb_build_object('name', s.name, 'logo_url', s.logo_url, 'farbe', s.farbe, 'zeitzone', s.zeitzone),
      'tickets', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'preis', t.preis, 'status', t.status, 'eingeloest_am', t.eingeloest_am,
          'code', CASE WHEN t.status IN ('gueltig', 'eingeloest', 'demo') THEN t.code END) ORDER BY t.id), '[]'::jsonb) FROM public.tickets t WHERE t.bestellung_id = b.id))
    FROM public.ticket_bestellungen b JOIN public.events e ON e.id = b.event_id JOIN public.schulen s ON s.id = b.schule_id
    LEFT JOIN public.raeume r ON r.id = e.raum_id LEFT JOIN public.ticket_shops sh ON sh.schule_id = b.schule_id
    WHERE b.zugang = p_zugang AND b.herkunft = 'shop' AND length(p_zugang) = 64);
END;
$function$;

CREATE OR REPLACE FUNCTION public.shop_storno_beginnen(p_bestellung_id uuid, p_ticket_ids uuid[], p_betrag numeric, p_vorgang uuid, p_von uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_b record;
  v_z record;
  v_ids uuid[];
  v_passend integer;
  v_neu numeric := 0;
  v_rest numeric;
BEGIN
  IF NOT public.ist_intern() THEN RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_b FROM public.ticket_bestellungen WHERE id = p_bestellung_id;
  IF NOT FOUND OR p_vorgang IS NULL THEN RAISE EXCEPTION 'Bestellung nicht gefunden'; END IF;
  PERFORM 1 FROM public.ticket_einstellungen WHERE event_id = v_b.event_id FOR UPDATE;
  SELECT * INTO v_b FROM public.ticket_bestellungen WHERE id = p_bestellung_id FOR UPDATE;

  -- Wiederholung nach Netzaussetzer
  IF EXISTS (SELECT 1 FROM public.ticket_online_erstattungen WHERE vorgang = p_vorgang) THEN
    IF NOT EXISTS (SELECT 1 FROM public.ticket_online_erstattungen WHERE vorgang = p_vorgang AND bestellung_id = p_bestellung_id) THEN
      RETURN jsonb_build_object('ok', false, 'grund', 'nicht_stornierbar');
    END IF;
    RETURN jsonb_build_object('ok', true, 'erstatten', true);
  END IF;

  SELECT * INTO v_z FROM public.ticket_zahlungen WHERE bestellung_id = p_bestellung_id AND methode = 'stripe' ORDER BY zeitpunkt LIMIT 1;
  IF NOT FOUND OR v_b.auto_erstatten THEN RETURN jsonb_build_object('ok', false, 'grund', 'nicht_stornierbar'); END IF;
  IF p_betrag IS NULL OR p_betrag < 0 OR p_betrag <> round(p_betrag, 2) THEN RETURN jsonb_build_object('ok', false, 'grund', 'erstattung'); END IF;

  SELECT array_agg(DISTINCT x) INTO v_ids FROM unnest(p_ticket_ids) AS x WHERE x IS NOT NULL;
  IF v_ids IS NULL AND p_betrag = 0 THEN RETURN jsonb_build_object('ok', false, 'grund', 'auswahl'); END IF;
  IF v_ids IS NOT NULL THEN
    SELECT count(*), coalesce(sum(preis), 0) INTO v_passend, v_neu FROM public.tickets
    WHERE bestellung_id = p_bestellung_id AND id = ANY (v_ids) AND code IS NOT NULL AND (status IN ('gueltig', 'demo') OR (status = 'eingeloest' AND an_kasse));
    IF v_passend <> cardinality(v_ids) OR v_b.status <> 'bezahlt' THEN RETURN jsonb_build_object('ok', false, 'grund', 'nicht_stornierbar'); END IF;
  END IF;
  -- Noch erstattbar: stornierte Tickets (mit den jetzigen), höchstens die Zahlung, abzüglich erstatteter und beauftragter Beträge
  SELECT least((SELECT coalesce(sum(preis), 0) FROM public.tickets WHERE bestellung_id = p_bestellung_id AND status = 'storniert' AND code IS NOT NULL) + v_neu, v_z.betrag)
    - (SELECT coalesce(sum(r.betrag), 0) FROM public.ticket_erstattungen r WHERE r.zahlung_id = v_z.id)
    - (SELECT coalesce(sum(o.betrag), 0) FROM public.ticket_online_erstattungen o WHERE o.zahlung_id = v_z.id AND o.erledigt_am IS NULL) INTO v_rest;
  IF p_betrag > v_rest OR (v_ids IS NOT NULL AND p_betrag > v_neu) THEN RETURN jsonb_build_object('ok', false, 'grund', 'erstattung'); END IF;

  IF v_ids IS NOT NULL THEN
    UPDATE public.tickets SET status = 'storniert', storniert_am = now(), storniert_von = p_von WHERE id = ANY (v_ids);
    IF NOT EXISTS (SELECT 1 FROM public.tickets WHERE bestellung_id = p_bestellung_id AND status IN ('reserviert', 'gueltig', 'eingeloest', 'demo')) THEN
      UPDATE public.ticket_bestellungen SET status = 'storniert' WHERE id = p_bestellung_id;
    END IF;
  END IF;
  IF p_betrag > 0 THEN
    INSERT INTO public.ticket_online_erstattungen (vorgang, bestellung_id, zahlung_id, betrag, erstellt_von) VALUES (p_vorgang, p_bestellung_id, v_z.id, p_betrag, p_von);
  END IF;
  RETURN jsonb_build_object('ok', true, 'erstatten', p_betrag > 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.shop_email_aendern(p_bestellung_id uuid, p_email text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_b record;
  v_email text := lower(btrim(coalesce(p_email, '')));
BEGIN
  IF NOT public.ist_intern() THEN RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501'; END IF;
  IF length(v_email) > 200 OR v_email !~ '^[^@\s<>",;]+@[^@\s<>",;]+\.[^@\s<>",;]{2,}$' THEN RETURN jsonb_build_object('ok', false, 'grund', 'angaben'); END IF;
  SELECT * INTO v_b FROM public.ticket_bestellungen WHERE id = p_bestellung_id;
  PERFORM 1 FROM public.ticket_einstellungen WHERE event_id = v_b.event_id FOR UPDATE;
  SELECT * INTO v_b FROM public.ticket_bestellungen WHERE id = p_bestellung_id FOR UPDATE;
  IF NOT FOUND OR v_b.herkunft <> 'shop' OR v_b.status <> 'bezahlt' THEN RETURN jsonb_build_object('ok', false, 'grund', 'nicht_moeglich'); END IF;
  IF v_b.kaeufer_email = v_email THEN RETURN jsonb_build_object('ok', true, 'geaendert', false); END IF;
  UPDATE public.ticket_bestellungen SET kaeufer_email = v_email, zugang = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') WHERE id = p_bestellung_id;
  UPDATE public.tickets SET code = replace(gen_random_uuid()::text, '-', '') WHERE bestellung_id = p_bestellung_id AND status IN ('gueltig', 'demo');
  RETURN jsonb_build_object('ok', true, 'geaendert', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.shop_nochmal(p_slug text, p_email text, p_ip_hash text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_ids jsonb;
BEGIN
  IF NOT public.ist_intern() THEN RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501'; END IF;
  DELETE FROM public.shop_drossel WHERE zeit < now() - interval '24 hours';
  IF (SELECT count(*) FROM public.shop_drossel WHERE ip_hash = 'mail:' || p_ip_hash AND zeit > now() - interval '1 hour') >= 8 THEN
    RETURN jsonb_build_object('ok', false, 'grund', 'zu_viele');
  END IF;
  INSERT INTO public.shop_drossel (ip_hash) VALUES (coalesce('mail:' || p_ip_hash, '-'));
  WITH gewaehlt AS (
    UPDATE public.ticket_bestellungen SET mail_am = now()
    WHERE id IN (
      SELECT b.id FROM public.ticket_bestellungen b JOIN public.ticket_shops sh ON sh.schule_id = b.schule_id JOIN public.events e ON e.id = b.event_id
      WHERE sh.slug = p_slug AND b.herkunft = 'shop' AND b.status = 'bezahlt' AND b.kaeufer_email = lower(btrim(p_email))
        AND (b.mail_am IS NULL OR b.mail_am < now() - interval '10 minutes')
        AND coalesce(e.ende, e.beginn + interval '6 hours') > now()
        AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.bestellung_id = b.id AND t.status IN ('gueltig', 'demo'))
      ORDER BY e.beginn LIMIT 10 FOR UPDATE OF b SKIP LOCKED)
    RETURNING id)
  SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids FROM gewaehlt;
  RETURN jsonb_build_object('ok', true, 'ids', v_ids);
END;
$function$;

-- Demo-Bestellungen der Schule wegräumen (echte Bestellungen bleiben immer unangetastet)
CREATE OR REPLACE FUNCTION public.shop_demo_loeschen(p_schule_id uuid)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_anzahl integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.ist_admin_von_schule(p_schule_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.ticket_bestellungen WHERE schule_id = p_schule_id AND demo;
  GET DIAGNOSTICS v_anzahl = ROW_COUNT;
  RETURN v_anzahl;
END;
$function$;
