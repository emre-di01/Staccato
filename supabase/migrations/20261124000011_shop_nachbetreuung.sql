-- Ticketshop: Tickets nochmal schicken, E-Mail korrigieren, online bezahlte Tickets stornieren und erstatten
--
-- Erstattung in drei Schritten, damit bei einem Ausfall nie doppelt und nie „aus Versehen gar nicht“ erstattet wird:
--   1. shop_storno_beginnen: sperrt, storniert die Tickets und merkt den Auftrag (ticket_online_erstattungen, vorgang = ID vom Client)
--   2. Edge Function „shop-verwaltung“ erstattet bei Stripe (metadata.vorgang, vorher Abgleich mit vorhandenen Erstattungen)
--   3. shop_erstattung_fertig: hält die Erstattungen fest. Solange das fehlt, ist der Auftrag offen und wiederholbar.

-- Nur „zu spät bezahlt und ausverkauft“ wird automatisch erstattet. Bisher wurde das an mail_am erkannt; ohne Mailversand
-- hätte eine wiederholte Stripe-Meldung nach einem Storno durch die Schule den vollen Betrag erstattet.
ALTER TABLE public.ticket_bestellungen ADD COLUMN IF NOT EXISTS auto_erstatten boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.ticket_online_erstattungen (
  vorgang       uuid PRIMARY KEY,
  bestellung_id uuid NOT NULL REFERENCES public.ticket_bestellungen(id) ON DELETE CASCADE,
  zahlung_id    uuid NOT NULL REFERENCES public.ticket_zahlungen(id) ON DELETE CASCADE,
  betrag        numeric(10,2) NOT NULL CHECK (betrag > 0),
  erstellt_von  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  erstellt_am   timestamptz NOT NULL DEFAULT now(),
  versuch       integer NOT NULL DEFAULT 0,   -- zählt eindeutige Ablehnungen von Stripe
  erledigt_am   timestamptz
);
CREATE INDEX IF NOT EXISTS ticket_online_erstattungen_idx ON public.ticket_online_erstattungen (bestellung_id);
ALTER TABLE public.ticket_online_erstattungen ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tkoe: admin lesen" ON public.ticket_online_erstattungen;   -- geschrieben wird nur über die Funktionen
CREATE POLICY "tkoe: admin lesen" ON public.ticket_online_erstattungen FOR SELECT TO authenticated USING (public.ist_admin_von_bestellung(bestellung_id));

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

  SELECT count(*), coalesce(sum(preis), 0) INTO v_anzahl, v_summe FROM public.tickets WHERE bestellung_id = p_bestellung_id AND status IN ('reserviert', 'verfallen');
  SELECT count(*) INTO v_belegt FROM public.tickets t JOIN public.ticket_bestellungen b ON b.id = t.bestellung_id
  WHERE t.event_id = v_b.event_id AND b.id <> p_bestellung_id AND (t.status IN ('gueltig', 'eingeloest') OR (t.status = 'reserviert' AND b.frist > clock_timestamp()));

  INSERT INTO public.ticket_zahlungen (bestellung_id, methode, betrag, externe_id) VALUES (p_bestellung_id, 'stripe', p_betrag, p_zahlung_id);
  IF v_b.status IN ('reserviert', 'verfallen') AND v_anzahl > 0 AND p_betrag = v_summe AND v_belegt + v_anzahl <= v_kap THEN
    UPDATE public.tickets SET status = 'gueltig', code = replace(gen_random_uuid()::text, '-', '') WHERE bestellung_id = p_bestellung_id AND status IN ('reserviert', 'verfallen');
    UPDATE public.ticket_bestellungen SET status = 'bezahlt', frist = NULL WHERE id = p_bestellung_id;
    RETURN jsonb_build_object('ergebnis', 'bezahlt');
  END IF;
  UPDATE public.tickets SET status = 'storniert', storniert_am = now() WHERE bestellung_id = p_bestellung_id AND status IN ('reserviert', 'verfallen');
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
      'name', b.kaeufer_name, 'email', b.kaeufer_email, 'sprache', b.sprache, 'slug', sh.slug,
      'betrag', (SELECT coalesce(sum(t.preis), 0) FROM public.tickets t WHERE t.bestellung_id = b.id AND t.status <> 'storniert'),
      -- Geld zurück: bereits erstattet oder in Arbeit; automatisch = zu spät bezahlt und ausverkauft
      'zurueck', (SELECT coalesce(sum(r.betrag), 0) FROM public.ticket_erstattungen r JOIN public.ticket_zahlungen z ON z.id = r.zahlung_id WHERE z.bestellung_id = b.id)
        + (SELECT coalesce(sum(o.betrag), 0) FROM public.ticket_online_erstattungen o WHERE o.bestellung_id = b.id AND o.erledigt_am IS NULL),
      'automatisch', b.auto_erstatten OR NOT EXISTS (SELECT 1 FROM public.ticket_zahlungen z WHERE z.bestellung_id = b.id),
      'event', jsonb_build_object('id', e.id, 'titel', e.titel, 'beginn', e.beginn, 'ende', e.ende, 'ort', coalesce(nullif(e.ort, ''), r.name)),
      'schule', jsonb_build_object('name', s.name, 'logo_url', s.logo_url, 'farbe', s.farbe, 'zeitzone', s.zeitzone),
      'tickets', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'preis', t.preis, 'status', t.status, 'eingeloest_am', t.eingeloest_am,
          'code', CASE WHEN t.status IN ('gueltig', 'eingeloest') THEN t.code END) ORDER BY t.id), '[]'::jsonb) FROM public.tickets t WHERE t.bestellung_id = b.id))
    FROM public.ticket_bestellungen b JOIN public.events e ON e.id = b.event_id JOIN public.schulen s ON s.id = b.schule_id
    LEFT JOIN public.raeume r ON r.id = e.raum_id LEFT JOIN public.ticket_shops sh ON sh.schule_id = b.schule_id
    WHERE b.zugang = p_zugang AND b.herkunft = 'shop' AND length(p_zugang) = 64);
END;
$function$;

-- Auftrag für „shop-verwaltung“: Angaben zur Erstattung eines Vorgangs
CREATE OR REPLACE FUNCTION public.shop_erstattung_info(p_vorgang uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  IF NOT public.ist_intern() THEN RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501'; END IF;
  RETURN (SELECT jsonb_build_object('bestellung_id', o.bestellung_id, 'schule_id', b.schule_id, 'zahlung', z.externe_id, 'betrag', o.betrag, 'versuch', o.versuch, 'erledigt', o.erledigt_am IS NOT NULL,
      -- Stripe-Erstattungen, die wir schon kennen
      'bekannt', (SELECT coalesce(jsonb_agg(r.externe_id), '[]'::jsonb) FROM public.ticket_erstattungen r WHERE r.zahlung_id = z.id))
    FROM public.ticket_online_erstattungen o JOIN public.ticket_zahlungen z ON z.id = o.zahlung_id JOIN public.ticket_bestellungen b ON b.id = o.bestellung_id
    WHERE o.vorgang = p_vorgang);
END;
$function$;

-- Tickets stornieren und Erstattung beauftragen (p_ticket_ids leer: nur nachträglich erstatten). Gleicher Vorgang = gleiches Ergebnis.
-- Ergebnis { ok, erstatten } oder { ok: false, grund: nicht_stornierbar | erstattung | auswahl }
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
    WHERE bestellung_id = p_bestellung_id AND id = ANY (v_ids) AND code IS NOT NULL AND (status = 'gueltig' OR (status = 'eingeloest' AND an_kasse));
    IF v_passend <> cardinality(v_ids) OR v_b.status <> 'bezahlt' THEN RETURN jsonb_build_object('ok', false, 'grund', 'nicht_stornierbar'); END IF;
  END IF;
  -- Noch erstattbar: stornierte Tickets (mit den jetzigen), höchstens die Zahlung, abzüglich erstatteter und beauftragter Beträge
  SELECT least((SELECT coalesce(sum(preis), 0) FROM public.tickets WHERE bestellung_id = p_bestellung_id AND status = 'storniert' AND code IS NOT NULL) + v_neu, v_z.betrag)
    - (SELECT coalesce(sum(r.betrag), 0) FROM public.ticket_erstattungen r WHERE r.zahlung_id = v_z.id)
    - (SELECT coalesce(sum(o.betrag), 0) FROM public.ticket_online_erstattungen o WHERE o.zahlung_id = v_z.id AND o.erledigt_am IS NULL) INTO v_rest;
  IF p_betrag > v_rest OR (v_ids IS NOT NULL AND p_betrag > v_neu) THEN RETURN jsonb_build_object('ok', false, 'grund', 'erstattung'); END IF;

  IF v_ids IS NOT NULL THEN
    UPDATE public.tickets SET status = 'storniert', storniert_am = now(), storniert_von = p_von WHERE id = ANY (v_ids);
    IF NOT EXISTS (SELECT 1 FROM public.tickets WHERE bestellung_id = p_bestellung_id AND status IN ('reserviert', 'gueltig', 'eingeloest')) THEN
      UPDATE public.ticket_bestellungen SET status = 'storniert' WHERE id = p_bestellung_id;
    END IF;
  END IF;
  IF p_betrag > 0 THEN
    INSERT INTO public.ticket_online_erstattungen (vorgang, bestellung_id, zahlung_id, betrag, erstellt_von) VALUES (p_vorgang, p_bestellung_id, v_z.id, p_betrag, p_von);
  END IF;
  RETURN jsonb_build_object('ok', true, 'erstatten', p_betrag > 0);
END;
$function$;

-- Von Stripe bestätigte Erstattungen festhalten und Auftrag abschließen. p_erstattungen: [{ id, betrag }]
CREATE OR REPLACE FUNCTION public.shop_erstattung_fertig(p_vorgang uuid, p_erstattungen jsonb)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_o record;
BEGIN
  IF NOT public.ist_intern() THEN RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_o FROM public.ticket_online_erstattungen WHERE vorgang = p_vorgang FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vorgang nicht gefunden'; END IF;
  INSERT INTO public.ticket_erstattungen (zahlung_id, betrag, erstattet_von, externe_id)
  SELECT v_o.zahlung_id, (e->>'betrag')::numeric, v_o.erstellt_von, e->>'id' FROM jsonb_array_elements(p_erstattungen) AS e
  ON CONFLICT (externe_id) DO NOTHING;
  UPDATE public.ticket_online_erstattungen SET erledigt_am = now() WHERE vorgang = p_vorgang AND erledigt_am IS NULL;
END;
$function$;

-- Stripe hat die Erstattung eindeutig abgelehnt: der nächste Versuch braucht einen neuen Idempotenzschlüssel
CREATE OR REPLACE FUNCTION public.shop_erstattung_abgelehnt(p_vorgang uuid, p_versuch integer)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  IF NOT public.ist_intern() THEN RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501'; END IF;
  UPDATE public.ticket_online_erstattungen SET versuch = p_versuch + 1 WHERE vorgang = p_vorgang AND versuch = p_versuch AND erledigt_am IS NULL;
END;
$function$;

-- E-Mail des Käufers korrigieren. War die alte Adresse die eines Fremden, darf er mit der alten Mail nicht mehr hinein:
-- neuer persönlicher Link und neue QR-Codes für noch nicht benutzte Tickets. grund: angaben | nicht_moeglich
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
  UPDATE public.tickets SET code = replace(gen_random_uuid()::text, '-', '') WHERE bestellung_id = p_bestellung_id AND status = 'gueltig';
  RETURN jsonb_build_object('ok', true, 'geaendert', true);
END;
$function$;

-- Gast möchte seine Tickets nochmal per Mail: Bestellungen, die jetzt verschickt werden sollen (je Bestellung höchstens alle 10 min).
-- Ergebnis { ok, ids } oder { ok: false, grund: zu_viele }. Der Gast erfährt nie, ob es Bestellungen gibt.
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
        AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.bestellung_id = b.id AND t.status = 'gueltig')
      ORDER BY e.beginn LIMIT 10 FOR UPDATE OF b SKIP LOCKED)
    RETURNING id)
  SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids FROM gewaehlt;
  RETURN jsonb_build_object('ok', true, 'ids', v_ids);
END;
$function$;
