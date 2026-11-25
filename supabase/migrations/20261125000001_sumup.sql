-- SumUp als zweiter Zahlungsanbieter im Ticketshop (neben Stripe)
--
-- Eine Schule kann beide verbinden; genau einer ist im Shop aktiv. Jede Bestellung merkt sich ihren Anbieter, damit
-- laufende Zahlungen und Erstattungen nach einem Wechsel weiter über das richtige Konto gehen.
-- SumUp: Zugang per API-Schlüssel oder OAuth (art), beides verschlüsselt in „schluessel“. Meldungen sind nicht signiert,
-- deshalb fragen die Functions den Status immer bei SumUp ab; sumup_abgleich_liste() + Cron fangen verlorene Meldungen auf.
-- SumUp kennt keine Idempotenzschlüssel: zahlung_sperren() verhindert gleichzeitige und vorschnell wiederholte Erstattungen.

-- ── Konten ──
ALTER TABLE public.schul_zahlungskonten DROP CONSTRAINT IF EXISTS schul_zahlungskonten_anbieter_check;
ALTER TABLE public.schul_zahlungskonten ADD CONSTRAINT schul_zahlungskonten_anbieter_check CHECK (anbieter IN ('stripe', 'sumup'));
ALTER TABLE public.schul_zahlungskonten ADD COLUMN IF NOT EXISTS aktiv boolean NOT NULL DEFAULT true;
ALTER TABLE public.schul_zahlungskonten ADD COLUMN IF NOT EXISTS art text NOT NULL DEFAULT 'schluessel' CHECK (art IN ('schluessel', 'oauth'));
ALTER TABLE public.schul_zahlungskonten ADD COLUMN IF NOT EXISTS haendler text;                             -- SumUp merchant_code
ALTER TABLE public.schul_zahlungskonten ADD COLUMN IF NOT EXISTS neu_verbinden boolean NOT NULL DEFAULT false;  -- Freigabe bei SumUp entzogen/abgelaufen
ALTER TABLE public.schul_zahlungskonten ALTER COLUMN webhook_geheim DROP NOT NULL;
ALTER TABLE public.schul_zahlungskonten DROP CONSTRAINT IF EXISTS schul_zahlungskonten_angaben;
ALTER TABLE public.schul_zahlungskonten ADD CONSTRAINT schul_zahlungskonten_angaben
  CHECK (CASE anbieter WHEN 'stripe' THEN webhook_geheim IS NOT NULL AND art = 'schluessel' ELSE haendler IS NOT NULL END);
ALTER TABLE public.schul_zahlungskonten DROP CONSTRAINT IF EXISTS schul_zahlungskonten_pkey;
ALTER TABLE public.schul_zahlungskonten ADD CONSTRAINT schul_zahlungskonten_pkey PRIMARY KEY (schule_id, anbieter);
CREATE UNIQUE INDEX IF NOT EXISTS schul_zahlungskonten_aktiv ON public.schul_zahlungskonten (schule_id) WHERE aktiv;

-- Begonnene OAuth-Anmeldungen (15 min); zugang = verschlüsselte Token, falls noch ein Händlerkonto gewählt werden muss
CREATE TABLE IF NOT EXISTS public.zahlungskonto_oauth (
  state_hash  text PRIMARY KEY,
  schule_id   uuid NOT NULL REFERENCES public.schulen(id) ON DELETE CASCADE,
  nutzer_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  zugang      text CHECK (zugang LIKE 'v1:%'),
  erstellt_am timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.zahlungskonto_oauth ENABLE ROW LEVEL SECURITY;   -- bewusst keine Policies
REVOKE ALL ON public.zahlungskonto_oauth FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.zahlung_sperren (
  name text PRIMARY KEY,
  seit timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.zahlung_sperren ENABLE ROW LEVEL SECURITY;       -- bewusst keine Policies
REVOKE ALL ON public.zahlung_sperren FROM anon, authenticated;

-- true = Sperre erhalten. Eine ältere als p_sekunden gilt als verlassen.
CREATE OR REPLACE FUNCTION public.zahlung_sperren(p_name text, p_sekunden integer)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  IF NOT public.ist_intern() THEN RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501'; END IF;
  DELETE FROM public.zahlung_sperren WHERE seit < now() - interval '1 day' AND name <> p_name;
  INSERT INTO public.zahlung_sperren AS s (name, seit) VALUES (p_name, clock_timestamp())
  ON CONFLICT (name) DO UPDATE SET seit = clock_timestamp() WHERE s.seit < clock_timestamp() - make_interval(secs => p_sekunden);
  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.zahlung_entsperren(p_name text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  IF NOT public.ist_intern() THEN RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501'; END IF;
  DELETE FROM public.zahlung_sperren WHERE name = p_name;
END;
$function$;

-- ── Bestellungen und Zahlungen ──
ALTER TABLE public.ticket_bestellungen ADD COLUMN IF NOT EXISTS anbieter text CHECK (anbieter IN ('stripe', 'sumup'));
ALTER TABLE public.ticket_bestellungen ADD COLUMN IF NOT EXISTS checkout_ende boolean NOT NULL DEFAULT false;  -- SumUp: Bezahlvorgang endgültig geschlossen
UPDATE public.ticket_bestellungen SET anbieter = 'stripe' WHERE herkunft = 'shop' AND anbieter IS NULL;
CREATE INDEX IF NOT EXISTS ticket_bestellungen_sumup_idx ON public.ticket_bestellungen (erstellt_am) WHERE anbieter = 'sumup' AND NOT checkout_ende;

ALTER TABLE public.ticket_zahlungen DROP CONSTRAINT IF EXISTS ticket_zahlungen_methode_check;
ALTER TABLE public.ticket_zahlungen ADD CONSTRAINT ticket_zahlungen_methode_check CHECK (methode IN ('bar', 'stripe', 'sumup'));
ALTER TABLE public.ticket_zahlungen DROP CONSTRAINT IF EXISTS ticket_zahlung_extern;
ALTER TABLE public.ticket_zahlungen ADD CONSTRAINT ticket_zahlung_extern CHECK (methode = 'bar' OR externe_id IS NOT NULL);

-- ── Einrichtung (Admins der Schule) ──
-- Oberste Ebene = im Shop aktives Konto; konten = alle verbundenen
CREATE OR REPLACE FUNCTION public.zahlungskonto_status(p_schule_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.ist_admin_von_schule(p_schule_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501';
  END IF;
  RETURN coalesce((SELECT jsonb_build_object('verbunden', true, 'anbieter', anbieter, 'livemode', livemode, 'letzte4', letzte4, 'seit', erstellt_am)
                   FROM public.schul_zahlungskonten WHERE schule_id = p_schule_id AND aktiv), '{"verbunden": false}'::jsonb)
    || jsonb_build_object('konten', (SELECT coalesce(jsonb_agg(jsonb_build_object('anbieter', anbieter, 'aktiv', aktiv, 'livemode', livemode, 'letzte4', letzte4,
         'art', art, 'haendler', haendler, 'neu_verbinden', neu_verbinden) ORDER BY anbieter), '[]'::jsonb) FROM public.schul_zahlungskonten WHERE schule_id = p_schule_id));
END;
$function$;

-- Anbieter wählen, über den der Shop neue Bestellungen abrechnet
CREATE OR REPLACE FUNCTION public.zahlungskonto_waehlen(p_schule_id uuid, p_anbieter text)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.ist_admin_von_schule(p_schule_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.schul_zahlungskonten WHERE schule_id = p_schule_id ORDER BY anbieter FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM public.schul_zahlungskonten WHERE schule_id = p_schule_id AND anbieter = p_anbieter) THEN RETURN false; END IF;
  UPDATE public.schul_zahlungskonten SET aktiv = false WHERE schule_id = p_schule_id AND aktiv;
  UPDATE public.schul_zahlungskonten SET aktiv = true WHERE schule_id = p_schule_id AND anbieter = p_anbieter;
  RETURN true;
END;
$function$;

-- ── Abgleich ──
-- SumUp-Bestellungen, deren Ausgang noch offen ist (Meldung verloren) oder deren automatische Erstattung noch aussteht
CREATE OR REPLACE FUNCTION public.sumup_abgleich_liste(p_limit integer DEFAULT 40)
 RETURNS TABLE(id uuid, schule_id uuid, checkout_id text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  IF NOT public.ist_intern() THEN RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT b.id, b.schule_id, b.checkout_id FROM public.ticket_bestellungen b
  WHERE b.anbieter = 'sumup' AND NOT b.checkout_ende AND b.checkout_id IS NOT NULL
    AND b.erstellt_am > now() - interval '3 days' AND b.erstellt_am < now() - interval '5 minutes'
  ORDER BY b.erstellt_am LIMIT p_limit;
END;
$function$;

-- ohne Vault-Einträge (dev) passiert nichts
SELECT cron.schedule(
  'sumup-abgleich',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url     := b.decrypted_secret || '/functions/v1/sumup-webhook',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-secret', s.decrypted_secret),
    body    := '{"aufgabe":"abgleich"}'::jsonb,
    timeout_milliseconds := 60000
  )
  FROM vault.decrypted_secrets b, vault.decrypted_secrets s
  WHERE b.name = 'functions_basis' AND s.name = 'internal_secret'
    AND EXISTS (SELECT 1 FROM public.ticket_bestellungen o WHERE o.anbieter = 'sumup' AND NOT o.checkout_ende AND o.checkout_id IS NOT NULL
                  AND o.erstellt_am > now() - interval '3 days' AND o.erstellt_am < now() - interval '5 minutes')
  $$
);

-- ── Angepasste Shop-Funktionen ──
DROP FUNCTION IF EXISTS public.shop_bezahlt(uuid, uuid, text, text, numeric, text);
CREATE OR REPLACE FUNCTION public.shop_info(p_slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.ist_intern() THEN RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501'; END IF;
  RETURN (
    SELECT jsonb_build_object(
      'schule', jsonb_build_object('name', s.name, 'logo_url', s.logo_url, 'farbe', s.farbe, 'zeitzone', s.zeitzone),
      'impressum', sh.impressum, 'agb', sh.agb, 'datenschutz', sh.datenschutz,
      'testmodus', coalesce((SELECT NOT k.livemode FROM public.schul_zahlungskonten k WHERE k.schule_id = s.id AND k.aktiv), true),
      'anbieter', (SELECT k.anbieter FROM public.schul_zahlungskonten k WHERE k.schule_id = s.id AND k.aktiv),
      'events', coalesce((
        SELECT jsonb_agg(jsonb_build_object('id', e.id, 'titel', e.titel, 'beginn', e.beginn, 'ende', e.ende, 'ort', coalesce(nullif(e.ort, ''), r.name),
            'beschreibung', e.beschreibung, 'bild_pfad', e.bild_pfad,
            -- genaue Restzahl nur, wenn es knapp wird
            'lage', l - 'frei' || jsonb_build_object('knapp', CASE WHEN (l->>'frei')::int BETWEEN 1 AND 10 THEN (l->>'frei')::int END)) ORDER BY e.beginn)
        FROM public.events e
        CROSS JOIN LATERAL public.shop_lage(e.id) AS l
        LEFT JOIN public.raeume r ON r.id = e.raum_id
        WHERE e.schule_id = s.id AND e.oeffentlich AND e.beginn > now() AND l->>'grund' IS DISTINCT FROM 'nicht_verfuegbar'), '[]'::jsonb))
    FROM public.ticket_shops sh JOIN public.schulen s ON s.id = sh.schule_id
    WHERE sh.slug = p_slug AND sh.aktiv AND s.aktiv IS NOT FALSE);
END;
$function$;

CREATE OR REPLACE FUNCTION public.shop_lage(p_event_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v record;
  v_belegt integer;
  v_mitglieder integer;
  v_frei integer;
  v_grund text;
BEGIN
  IF NOT public.ist_intern() THEN RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501'; END IF;
  SELECT te.*, e.beginn, e.oeffentlich, e.typ, sh.aktiv AS shop, EXISTS (SELECT 1 FROM public.schul_zahlungskonten k WHERE k.schule_id = e.schule_id AND k.aktiv AND NOT k.neu_verbinden) AS konto
    INTO v
  FROM public.ticket_einstellungen te JOIN public.events e ON e.id = te.event_id LEFT JOIN public.ticket_shops sh ON sh.schule_id = e.schule_id
  WHERE te.event_id = p_event_id;
  -- preis > 0: kostenlose Tickets gibt es nur für Mitglieder (Stripe braucht mindestens 0,50 €)
  IF NOT FOUND OR NOT v.aktiv OR NOT v.shop_aktiv OR v.shop IS NOT TRUE OR NOT v.konto OR v.oeffentlich IS NOT TRUE OR v.typ = 'vorstandssitzung' OR v.preis_normal < 0.5 THEN
    RETURN jsonb_build_object('ok', false, 'grund', 'nicht_verfuegbar');
  END IF;
  SELECT count(*), count(*) FILTER (WHERE b.herkunft = 'mitglied') INTO v_belegt, v_mitglieder
  FROM public.tickets t JOIN public.ticket_bestellungen b ON b.id = t.bestellung_id
  WHERE t.event_id = p_event_id AND (t.status IN ('gueltig', 'eingeloest') OR (t.status = 'reserviert' AND b.frist > clock_timestamp()));
  v_frei := greatest(v.kapazitaet - v_belegt - greatest(v.mitglieder_reserve - v_mitglieder, 0), 0);
  v_grund := CASE
    WHEN now() < v.verkauf_von THEN 'noch_nicht'
    WHEN now() >= v.beginn OR now() >= v.verkauf_bis THEN 'beendet'
    WHEN v_frei = 0 THEN 'ausverkauft' END;
  RETURN jsonb_build_object('ok', v_grund IS NULL, 'grund', v_grund, 'frei', v_frei, 'max', least(v_frei, v.obergrenze, 20),
    'preis', v.preis_normal, 'verkauf_von', v.verkauf_von);
END;
$function$;

CREATE OR REPLACE FUNCTION public.shop_reservieren(p_event_id uuid, p_anzahl integer, p_betrag numeric, p_name text, p_email text, p_sprache text, p_ip_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lage jsonb;
  v_name text := left(btrim(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]]', ' ', 'g')), 80);
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_id uuid;
  v_zugang text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_schule uuid;
  v_demo boolean;
  v_anbieter text;
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

  SELECT e.schule_id, NOT k.livemode, k.anbieter INTO v_schule, v_demo, v_anbieter FROM public.events e JOIN public.schul_zahlungskonten k ON k.schule_id = e.schule_id AND k.aktiv WHERE e.id = p_event_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'grund', 'nicht_verfuegbar'); END IF;
  INSERT INTO public.ticket_bestellungen (schule_id, event_id, herkunft, kaeufer_name, kaeufer_email, sprache, zugang, status, frist, demo, anbieter)
  VALUES (v_schule, p_event_id, 'shop', v_name, v_email, CASE WHEN p_sprache IN ('de', 'en', 'tr') THEN p_sprache ELSE 'de' END, v_zugang, 'reserviert', now() + interval '35 minutes', v_demo, v_anbieter)
  RETURNING id INTO v_id;
  INSERT INTO public.tickets (bestellung_id, event_id, preis, status) SELECT v_id, p_event_id, (v_lage->>'preis')::numeric, CASE WHEN v_demo THEN 'demo' ELSE 'reserviert' END FROM generate_series(1, p_anzahl);
  RETURN jsonb_build_object('ok', true, 'bestellung_id', v_id, 'zugang', v_zugang, 'schule_id', v_schule, 'demo', v_demo, 'anbieter', v_anbieter, 'preis', (v_lage->>'preis')::numeric);
END;
$function$;

CREATE OR REPLACE FUNCTION public.shop_bezahlt(p_schule_id uuid, p_bestellung_id uuid, p_checkout_id text, p_zahlung_id text, p_betrag numeric, p_waehrung text, p_anbieter text DEFAULT 'stripe'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
  IF NOT FOUND OR v_b.herkunft <> 'shop' OR v_b.schule_id <> p_schule_id OR v_b.checkout_id IS DISTINCT FROM p_checkout_id OR v_b.anbieter IS DISTINCT FROM p_anbieter THEN
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

  INSERT INTO public.ticket_zahlungen (bestellung_id, methode, betrag, externe_id) VALUES (p_bestellung_id, p_anbieter, p_betrag, p_zahlung_id);
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

CREATE OR REPLACE FUNCTION public.shop_storno_beginnen(p_bestellung_id uuid, p_ticket_ids uuid[], p_betrag numeric, p_vorgang uuid, p_von uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

  SELECT * INTO v_z FROM public.ticket_zahlungen WHERE bestellung_id = p_bestellung_id AND methode <> 'bar' ORDER BY zeitpunkt LIMIT 1;
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

CREATE OR REPLACE FUNCTION public.shop_erstattung_info(p_vorgang uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.ist_intern() THEN RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501'; END IF;
  RETURN (SELECT jsonb_build_object('bestellung_id', o.bestellung_id, 'schule_id', b.schule_id, 'anbieter', z.methode, 'zahlung', z.externe_id, 'betrag', o.betrag, 'versuch', o.versuch, 'erledigt', o.erledigt_am IS NOT NULL,
      'bestaetigt', (SELECT coalesce(sum(r.betrag), 0) FROM public.ticket_erstattungen r WHERE r.zahlung_id = z.id),
      -- Erstattungen, die wir schon kennen
      'bekannt', (SELECT coalesce(jsonb_agg(r.externe_id), '[]'::jsonb) FROM public.ticket_erstattungen r WHERE r.zahlung_id = z.id))
    FROM public.ticket_online_erstattungen o JOIN public.ticket_zahlungen z ON z.id = o.zahlung_id JOIN public.ticket_bestellungen b ON b.id = o.bestellung_id
    WHERE o.vorgang = p_vorgang);
END;
$function$;

CREATE OR REPLACE FUNCTION public.shop_bestellung(p_zugang text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.ist_intern() THEN RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501'; END IF;
  RETURN (
    SELECT jsonb_build_object('id', b.id, 'schule_id', b.schule_id, 'checkout_id', b.checkout_id, 'anbieter', b.anbieter, 'event_id', e.id,
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

CREATE OR REPLACE FUNCTION public.ticket_erstattung_pruefen()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.externe_id IS NULL AND EXISTS (SELECT 1 FROM public.ticket_zahlungen z WHERE z.id = NEW.zahlung_id AND z.methode <> 'bar') THEN
    RAISE EXCEPTION 'ticket_erstattung_online' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;
