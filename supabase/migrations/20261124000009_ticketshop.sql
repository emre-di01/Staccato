-- Öffentlicher Ticketshop mit Onlinezahlung: Datenmodell und Serverlogik
--
-- Jede Schule nutzt ihr eigenes Stripe-Konto (eingeschränkter Schlüssel). Schlüssel liegen verschlüsselt in
-- schul_zahlungskonten: RLS ohne Policies, gelesen nur von Edge Functions (service_role); entschlüsseln kann nur,
-- wer zusätzlich ZAHLUNG_SCHLUESSEL aus der Function-Umgebung hat. NIE in schulen ablegen (für alle lesbar).
-- Alle shop_*-Funktionen sind nur intern aufrufbar (ist_intern()): Gäste sprechen ausschließlich mit der Edge
-- Function „shop“, Zahlungen bestätigt nur der signierte Webhook bzw. die Rückfrage bei Stripe.
-- Käufer bekommen kein Konto, sondern einen persönlichen Link (ticket_bestellungen.zugang).

-- ── Tabellen ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ticket_shops (
  schule_id   uuid PRIMARY KEY REFERENCES public.schulen(id) ON DELETE CASCADE,
  slug        text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' AND slug <> 'bestellung'),
  aktiv       boolean NOT NULL DEFAULT false,
  impressum   text NOT NULL DEFAULT '',
  agb         text NOT NULL DEFAULT '',
  datenschutz text NOT NULL DEFAULT '',
  aktualisiert_am timestamptz NOT NULL DEFAULT now(),
  -- Ohne Pflichtangaben kein öffentlicher Verkauf
  CONSTRAINT ticket_shop_pflicht CHECK (NOT aktiv OR (btrim(impressum) <> '' AND btrim(agb) <> '' AND btrim(datenschutz) <> ''))
);
ALTER TABLE public.ticket_shops ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tksh: admin lesen" ON public.ticket_shops;
CREATE POLICY "tksh: admin lesen" ON public.ticket_shops FOR SELECT TO authenticated USING (public.ist_admin_von_schule(schule_id));
DROP POLICY IF EXISTS "tksh: admin anlegen" ON public.ticket_shops;
CREATE POLICY "tksh: admin anlegen" ON public.ticket_shops FOR INSERT TO authenticated WITH CHECK (public.ist_admin_von_schule(schule_id));
DROP POLICY IF EXISTS "tksh: admin aendern" ON public.ticket_shops;
CREATE POLICY "tksh: admin aendern" ON public.ticket_shops FOR UPDATE TO authenticated
  USING (public.ist_admin_von_schule(schule_id)) WITH CHECK (public.ist_admin_von_schule(schule_id));

CREATE TABLE IF NOT EXISTS public.schul_zahlungskonten (
  schule_id      uuid PRIMARY KEY REFERENCES public.schulen(id) ON DELETE CASCADE,
  anbieter       text NOT NULL DEFAULT 'stripe' CHECK (anbieter IN ('stripe')),
  schluessel     text NOT NULL CHECK (schluessel LIKE 'v1:%'),        -- verschlüsselt
  webhook_id     text,
  webhook_geheim text NOT NULL CHECK (webhook_geheim LIKE 'v1:%'),    -- verschlüsselt
  livemode       boolean NOT NULL,
  letzte4        text NOT NULL CHECK (length(letzte4) = 4),
  erstellt_von   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  erstellt_am    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.schul_zahlungskonten ENABLE ROW LEVEL SECURITY;   -- bewusst keine Policies

-- Drossel gegen das Blockieren von Plätzen (IP nur als Hash, nach 24 h gelöscht)
CREATE TABLE IF NOT EXISTS public.shop_drossel (
  ip_hash text NOT NULL,
  zeit    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shop_drossel_idx ON public.shop_drossel (ip_hash, zeit);
ALTER TABLE public.shop_drossel ENABLE ROW LEVEL SECURITY;           -- bewusst keine Policies

ALTER TABLE public.ticket_einstellungen ADD COLUMN IF NOT EXISTS shop_aktiv boolean NOT NULL DEFAULT false;
ALTER TABLE public.ticket_einstellungen ADD COLUMN IF NOT EXISTS mitglieder_reserve integer NOT NULL DEFAULT 0;
DO $$ BEGIN
  ALTER TABLE public.ticket_einstellungen ADD CONSTRAINT ticket_einst_reserve CHECK (mitglieder_reserve >= 0 AND mitglieder_reserve <= kapazitaet);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.ticket_bestellungen ADD COLUMN IF NOT EXISTS kaeufer_email text;
ALTER TABLE public.ticket_bestellungen ADD COLUMN IF NOT EXISTS sprache text;
ALTER TABLE public.ticket_bestellungen ADD COLUMN IF NOT EXISTS zugang text UNIQUE;        -- persönlicher Link des Käufers
ALTER TABLE public.ticket_bestellungen ADD COLUMN IF NOT EXISTS checkout_id text UNIQUE;   -- Stripe Checkout Session
ALTER TABLE public.ticket_bestellungen ADD COLUMN IF NOT EXISTS mail_am timestamptz;
DO $$ BEGIN
  ALTER TABLE public.ticket_bestellungen ADD CONSTRAINT ticket_bestellung_shop CHECK
    (herkunft <> 'shop' OR (kaeufer_name IS NOT NULL AND kaeufer_email IS NOT NULL AND zugang IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.ticket_zahlungen DROP CONSTRAINT IF EXISTS ticket_zahlungen_methode_check;
ALTER TABLE public.ticket_zahlungen ADD CONSTRAINT ticket_zahlungen_methode_check CHECK (methode IN ('bar', 'stripe'));
ALTER TABLE public.ticket_zahlungen ADD COLUMN IF NOT EXISTS externe_id text UNIQUE;       -- Stripe PaymentIntent
DO $$ BEGIN
  ALTER TABLE public.ticket_zahlungen ADD CONSTRAINT ticket_zahlung_extern CHECK (methode <> 'stripe' OR externe_id IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.ticket_erstattungen ADD COLUMN IF NOT EXISTS externe_id text UNIQUE;    -- Stripe Refund

-- Onlinezahlungen nie als Barerstattung verbuchen: Erstattung nur mit Beleg von Stripe
CREATE OR REPLACE FUNCTION public.ticket_erstattung_pruefen()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  IF NEW.externe_id IS NULL AND EXISTS (SELECT 1 FROM public.ticket_zahlungen z WHERE z.id = NEW.zahlung_id AND z.methode = 'stripe') THEN
    RAISE EXCEPTION 'ticket_erstattung_online' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS ticket_erstattung_pruefen ON public.ticket_erstattungen;
CREATE TRIGGER ticket_erstattung_pruefen BEFORE INSERT ON public.ticket_erstattungen
  FOR EACH ROW EXECUTE FUNCTION public.ticket_erstattung_pruefen();

-- ── Admin: Status des Zahlungskontos (nie der Schlüssel) ───────────────────────

CREATE OR REPLACE FUNCTION public.zahlungskonto_status(p_schule_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.ist_admin_von_schule(p_schule_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501';
  END IF;
  RETURN coalesce((SELECT jsonb_build_object('verbunden', true, 'livemode', livemode, 'letzte4', letzte4, 'seit', erstellt_am)
                   FROM public.schul_zahlungskonten WHERE schule_id = p_schule_id), '{"verbunden": false}'::jsonb);
END;
$function$;

-- ── Intern: Shop ───────────────────────────────────────────────────────────────

-- Lage einer Veranstaltung im Shop: { ok, grund, frei, max, preis }. Plätze, die für Mitglieder zurückgehalten werden
-- (abzüglich der schon von Mitgliedern belegten), sind im Shop nicht frei.
-- grund: nicht_verfuegbar | noch_nicht | beendet | ausverkauft
CREATE OR REPLACE FUNCTION public.shop_lage(p_event_id uuid)
 RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v record;
  v_belegt integer;
  v_mitglieder integer;
  v_frei integer;
  v_grund text;
BEGIN
  IF NOT public.ist_intern() THEN RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501'; END IF;
  SELECT te.*, e.beginn, e.oeffentlich, e.typ, sh.aktiv AS shop, EXISTS (SELECT 1 FROM public.schul_zahlungskonten k WHERE k.schule_id = e.schule_id) AS konto
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

CREATE OR REPLACE FUNCTION public.shop_info(p_slug text)
 RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  IF NOT public.ist_intern() THEN RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501'; END IF;
  RETURN (
    SELECT jsonb_build_object(
      'schule', jsonb_build_object('name', s.name, 'logo_url', s.logo_url, 'farbe', s.farbe, 'zeitzone', s.zeitzone),
      'impressum', sh.impressum, 'agb', sh.agb, 'datenschutz', sh.datenschutz,
      'testmodus', coalesce((SELECT NOT k.livemode FROM public.schul_zahlungskonten k WHERE k.schule_id = s.id), true),
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

-- Plätze für den Bezahlvorgang reservieren (35 min; die Stripe-Sitzung läuft vorher ab).
-- grund: wie shop_lage, dazu anzahl | zu_wenig_frei | betrag | zu_viele | angaben
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

  SELECT schule_id INTO v_schule FROM public.events WHERE id = p_event_id;
  INSERT INTO public.ticket_bestellungen (schule_id, event_id, herkunft, kaeufer_name, kaeufer_email, sprache, zugang, status, frist)
  VALUES (v_schule, p_event_id, 'shop', v_name, v_email, CASE WHEN p_sprache IN ('de', 'en', 'tr') THEN p_sprache ELSE 'de' END, v_zugang, 'reserviert', now() + interval '35 minutes')
  RETURNING id INTO v_id;
  INSERT INTO public.tickets (bestellung_id, event_id, preis) SELECT v_id, p_event_id, (v_lage->>'preis')::numeric FROM generate_series(1, p_anzahl);
  RETURN jsonb_build_object('ok', true, 'bestellung_id', v_id, 'zugang', v_zugang, 'schule_id', v_schule, 'preis', (v_lage->>'preis')::numeric);
END;
$function$;

CREATE OR REPLACE FUNCTION public.shop_checkout_setzen(p_bestellung_id uuid, p_checkout_id text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  IF NOT public.ist_intern() THEN RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501'; END IF;
  UPDATE public.ticket_bestellungen SET checkout_id = p_checkout_id WHERE id = p_bestellung_id AND herkunft = 'shop' AND checkout_id IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bestellung nicht gefunden'; END IF;
END;
$function$;

-- Bezahlvorgang abgebrochen oder abgelaufen: Plätze sofort freigeben
CREATE OR REPLACE FUNCTION public.shop_verwerfen(p_bestellung_id uuid)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_event uuid;
BEGIN
  IF NOT public.ist_intern() THEN RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501'; END IF;
  SELECT event_id INTO v_event FROM public.ticket_bestellungen WHERE id = p_bestellung_id AND herkunft = 'shop';
  PERFORM 1 FROM public.ticket_einstellungen WHERE event_id = v_event FOR UPDATE;
  UPDATE public.ticket_bestellungen SET status = 'verfallen' WHERE id = p_bestellung_id AND herkunft = 'shop' AND status = 'reserviert';
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE public.tickets SET status = 'verfallen' WHERE bestellung_id = p_bestellung_id AND status = 'reserviert';
  RETURN true;
END;
$function$;

-- Zahlung verbuchen. ergebnis: bezahlt | schon_bezahlt | erstatten | schon_erstattet | ungueltig
-- Kommt die Zahlung nach Ablauf, gelten die Tickets nur, wenn noch Platz ist – sonst muss erstattet werden.
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
    RETURN jsonb_build_object('ergebnis', CASE WHEN v_b.status = 'bezahlt' THEN 'schon_bezahlt' WHEN v_z.erstattet THEN 'schon_erstattet'
      WHEN v_b.mail_am IS NOT NULL THEN 'schon_bezahlt' ELSE 'erstatten' END);
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
  UPDATE public.ticket_bestellungen SET status = 'storniert' WHERE id = p_bestellung_id;
  RETURN jsonb_build_object('ergebnis', 'erstatten');
END;
$function$;

-- Von Stripe bestätigte Erstattung festhalten (gleiche Refund-ID nur einmal)
CREATE OR REPLACE FUNCTION public.shop_erstattet(p_zahlung_id text, p_erstattung_id text, p_betrag numeric, p_von uuid DEFAULT NULL)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  IF NOT public.ist_intern() THEN RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.ticket_erstattungen (zahlung_id, betrag, erstattet_von, externe_id)
  SELECT z.id, p_betrag, p_von, p_erstattung_id FROM public.ticket_zahlungen z WHERE z.externe_id = p_zahlung_id
  ON CONFLICT (externe_id) DO NOTHING;
END;
$function$;

-- Bestellung über den persönlichen Link
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
      'event', jsonb_build_object('id', e.id, 'titel', e.titel, 'beginn', e.beginn, 'ende', e.ende, 'ort', coalesce(nullif(e.ort, ''), r.name)),
      'schule', jsonb_build_object('name', s.name, 'logo_url', s.logo_url, 'farbe', s.farbe, 'zeitzone', s.zeitzone),
      'tickets', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'preis', t.preis, 'status', t.status, 'eingeloest_am', t.eingeloest_am,
          'code', CASE WHEN t.status IN ('gueltig', 'eingeloest') THEN t.code END) ORDER BY t.id), '[]'::jsonb) FROM public.tickets t WHERE t.bestellung_id = b.id))
    FROM public.ticket_bestellungen b JOIN public.events e ON e.id = b.event_id JOIN public.schulen s ON s.id = b.schule_id
    LEFT JOIN public.raeume r ON r.id = e.raum_id LEFT JOIN public.ticket_shops sh ON sh.schule_id = b.schule_id
    WHERE b.zugang = p_zugang AND b.herkunft = 'shop' AND length(p_zugang) = 64);
END;
$function$;

-- Ticket-Mail genau einmal: beanspruchen (true = jetzt senden), bei Fehler wieder freigeben
CREATE OR REPLACE FUNCTION public.shop_mail_beanspruchen(p_bestellung_id uuid, p_zurueck boolean DEFAULT false)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  IF NOT public.ist_intern() THEN RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501'; END IF;
  IF p_zurueck THEN
    UPDATE public.ticket_bestellungen SET mail_am = NULL WHERE id = p_bestellung_id;
    RETURN false;
  END IF;
  UPDATE public.ticket_bestellungen SET mail_am = now() WHERE id = p_bestellung_id AND herkunft = 'shop' AND status = 'bezahlt' AND mail_am IS NULL;
  RETURN FOUND;
END;
$function$;
