-- Ticketverkauf Schritt 7: Abendkasse (Admin oder Freigabe „Kasse“)
--
-- Offen ab 3 h vor Beginn bis zum Ende (ohne Endzeit: 6 h nach Beginn). Wer dann zahlt, geht direkt rein:
-- Tickets werden gleich eingelöst (tickets.an_kasse). Zahlt jemand früher, wird nur der Geldeingang bestätigt und
-- das Ticket mit QR-Code gültig. Verkauf ohne Namen, ohne Vergünstigung, zum Abendkassenpreis (sonst Normalpreis).
-- Wiederholungen nach Netzaussetzern sind gefahrlos (p_vorgang = ID der Bestellung bzw. Prüfung der eigenen Zahlung).

ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS an_kasse boolean NOT NULL DEFAULT false;

-- Interner Helfer ohne Nutzerdaten: ist die Abendkasse gerade offen?
CREATE OR REPLACE FUNCTION public.abendkasse_offen(p_event_id uuid)
 RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.events e WHERE e.id = p_event_id AND public.darf_kassieren(e.id)
    AND clock_timestamp() BETWEEN e.beginn - interval '3 hours' AND coalesce(e.ende, e.beginn + interval '6 hours'));
$function$;

-- Veranstaltungen, bei denen ich kassieren darf (noch nicht vorbei). Admins: nur die der aktiven Schule.
-- { id, titel, beginn, zeitzone, ab, offen, helfer, preis, frei, kassiert } – kassiert = von mir angenommenes Geld
CREATE OR REPLACE FUNCTION public.meine_kassen_events()
 RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Nicht angemeldet' USING ERRCODE = '42501';
  END IF;
  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', e.id, 'titel', e.titel, 'beginn', e.beginn, 'zeitzone', s.zeitzone,
      'ab', e.beginn - interval '3 hours', 'offen', public.abendkasse_offen(e.id),
      'helfer', f.profil_id IS NOT NULL,
      'preis', coalesce(te.preis_abendkasse, te.preis_normal),
      'frei', greatest(te.kapazitaet - (
        SELECT count(*) FROM public.tickets t JOIN public.ticket_bestellungen b ON b.id = t.bestellung_id
        WHERE t.event_id = e.id AND (t.status IN ('gueltig', 'eingeloest') OR (t.status = 'reserviert' AND b.frist > now()))), 0),
      'kassiert', (SELECT coalesce(sum(z.betrag), 0) FROM public.ticket_zahlungen z
        JOIN public.ticket_bestellungen b ON b.id = z.bestellung_id WHERE b.event_id = e.id AND z.angenommen_von = auth.uid())
    ) ORDER BY e.beginn), '[]'::jsonb)
    FROM public.events e
    JOIN public.ticket_einstellungen te ON te.event_id = e.id
    JOIN public.schulen s ON s.id = e.schule_id
    LEFT JOIN public.ticket_freigaben f ON f.event_id = e.id AND f.profil_id = auth.uid() AND f.kasse
    WHERE now() <= coalesce(e.ende, e.beginn + interval '6 hours')
      AND (te.aktiv OR EXISTS (SELECT 1 FROM public.ticket_bestellungen b WHERE b.event_id = e.id))
      AND ((e.schule_id = public.meine_schule_id() AND public.ist_admin_von_schule(e.schule_id))
           OR (f.profil_id IS NOT NULL AND public.darf_kassieren(e.id))));
END;
$function$;

-- Offene Reservierungen mit Namen (für die Suche an der Kasse)
CREATE OR REPLACE FUNCTION public.abendkasse_reservierungen(p_event_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.darf_kassieren(p_event_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501';
  END IF;
  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'anzahl', x.anzahl, 'betrag', x.betrag) ORDER BY x.name, x.id), '[]'::jsonb)
    FROM (SELECT b.id, coalesce(p.voller_name, b.kaeufer_name, '–') AS name, count(*) AS anzahl, sum(t.preis) AS betrag
          FROM public.ticket_bestellungen b
          JOIN public.tickets t ON t.bestellung_id = b.id AND t.status = 'reserviert'
          LEFT JOIN public.profiles p ON p.id = b.kaeufer_id
          WHERE b.event_id = p_event_id AND b.status = 'reserviert' AND b.frist > now()
          GROUP BY b.id, p.voller_name, b.kaeufer_name) x);
END;
$function$;

-- Neu verkaufen. grund: geschlossen | anzahl | zu_wenig_frei | betrag
CREATE OR REPLACE FUNCTION public.abendkasse_verkaufen(p_event_id uuid, p_anzahl integer, p_betrag numeric, p_vorgang uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_te record;
  v_b record;
  v_belegt integer;
  v_preis numeric(8,2);
BEGIN
  IF auth.uid() IS NULL OR NOT public.darf_kassieren(p_event_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501';
  END IF;
  IF p_vorgang IS NULL THEN
    RAISE EXCEPTION 'Vorgang fehlt' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_te FROM public.ticket_einstellungen WHERE event_id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'grund', 'geschlossen'); END IF;

  -- Schon verbucht (Antwort ging verloren)?
  SELECT b.*, (SELECT count(*) FROM public.tickets t WHERE t.bestellung_id = b.id) AS anzahl INTO v_b
  FROM public.ticket_bestellungen b WHERE b.id = p_vorgang;
  IF FOUND THEN
    IF v_b.event_id <> p_event_id OR v_b.herkunft <> 'abendkasse' OR v_b.erstellt_von IS DISTINCT FROM auth.uid() OR v_b.anzahl IS DISTINCT FROM p_anzahl THEN
      RAISE EXCEPTION 'Vorgang schon vergeben' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object('ok', true, 'anzahl', v_b.anzahl);
  END IF;

  IF NOT public.abendkasse_offen(p_event_id) THEN RETURN jsonb_build_object('ok', false, 'grund', 'geschlossen'); END IF;
  IF p_anzahl IS NULL OR p_anzahl < 1 OR p_anzahl > 50 THEN RETURN jsonb_build_object('ok', false, 'grund', 'anzahl'); END IF;
  SELECT count(*) INTO v_belegt
  FROM public.tickets t JOIN public.ticket_bestellungen b ON b.id = t.bestellung_id
  WHERE t.event_id = p_event_id AND (t.status IN ('gueltig', 'eingeloest') OR (t.status = 'reserviert' AND b.frist > clock_timestamp()));
  IF v_te.kapazitaet - v_belegt < p_anzahl THEN RETURN jsonb_build_object('ok', false, 'grund', 'zu_wenig_frei'); END IF;
  v_preis := coalesce(v_te.preis_abendkasse, v_te.preis_normal);
  IF p_betrag IS DISTINCT FROM v_preis * p_anzahl THEN RETURN jsonb_build_object('ok', false, 'grund', 'betrag'); END IF;

  INSERT INTO public.ticket_bestellungen (id, schule_id, event_id, herkunft, status, erstellt_von)
  SELECT p_vorgang, e.schule_id, e.id, 'abendkasse', 'bezahlt', auth.uid() FROM public.events e WHERE e.id = p_event_id;
  INSERT INTO public.tickets (bestellung_id, event_id, preis, status, code, eingeloest_am, an_kasse)
  SELECT p_vorgang, p_event_id, v_preis, 'eingeloest', replace(gen_random_uuid()::text, '-', ''), clock_timestamp(), true
  FROM generate_series(1, p_anzahl);
  IF p_betrag > 0 THEN
    INSERT INTO public.ticket_zahlungen (bestellung_id, betrag, angenommen_von) VALUES (p_vorgang, p_betrag, auth.uid());
  END IF;
  RETURN jsonb_build_object('ok', true, 'anzahl', p_anzahl);
END;
$function$;

-- Reservierung kassieren; bei offener Abendkasse gleich einlassen.
-- Ergebnis: { ok, anzahl, eingelassen } oder { ok: false, grund: nicht_offen | verfallen | betrag }
CREATE OR REPLACE FUNCTION public.abendkasse_kassieren(p_bestellung_id uuid, p_betrag numeric)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_event uuid;
  v_status text;
  v_erg jsonb;
  v_anzahl integer;
BEGIN
  SELECT event_id INTO v_event FROM public.ticket_bestellungen WHERE id = p_bestellung_id;
  IF auth.uid() IS NULL OR v_event IS NULL OR NOT public.darf_kassieren(v_event) THEN
    RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.ticket_einstellungen WHERE event_id = v_event FOR UPDATE;

  -- Gerade eben von mir selbst kassiert (Antwort ging verloren)?
  SELECT status INTO v_status FROM public.ticket_bestellungen WHERE id = p_bestellung_id;
  IF v_status = 'bezahlt' AND EXISTS (SELECT 1 FROM public.ticket_zahlungen z WHERE z.bestellung_id = p_bestellung_id
       AND z.angenommen_von = auth.uid() AND z.betrag = p_betrag AND z.zeitpunkt > clock_timestamp() - interval '2 minutes') THEN
    RETURN jsonb_build_object('ok', true,
      'anzahl', (SELECT count(*) FROM public.tickets WHERE bestellung_id = p_bestellung_id AND status IN ('gueltig', 'eingeloest')),
      'eingelassen', (SELECT coalesce(bool_and(an_kasse), false) FROM public.tickets WHERE bestellung_id = p_bestellung_id AND status IN ('gueltig', 'eingeloest')));
  END IF;

  v_erg := public.ticket_zahlung_bestaetigen(p_bestellung_id, p_betrag);
  IF NOT (v_erg->>'ok')::boolean THEN RETURN v_erg; END IF;
  SELECT count(*) INTO v_anzahl FROM public.tickets WHERE bestellung_id = p_bestellung_id AND status = 'gueltig';
  IF public.abendkasse_offen(v_event) THEN
    UPDATE public.tickets SET status = 'eingeloest', eingeloest_am = clock_timestamp(), an_kasse = true
    WHERE bestellung_id = p_bestellung_id AND status = 'gueltig';
    RETURN jsonb_build_object('ok', true, 'anzahl', v_anzahl, 'eingelassen', true);
  END IF;
  RETURN jsonb_build_object('ok', true, 'anzahl', v_anzahl, 'eingelassen', false);
END;
$function$;

-- ── Storno auch für an der Kasse eingelassene Tickets (Vertippt), sonst unverändert (Stand 20261124000003) ──

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
  -- Am Einlass eingelöste, verfallene und bereits stornierte Tickets bleiben, wie sie sind
  SELECT count(*), coalesce(sum(preis) FILTER (WHERE code IS NOT NULL), 0) INTO v_passend, v_neu_erstattbar
  FROM public.tickets
  WHERE bestellung_id = p_bestellung_id AND id = ANY (v_ids) AND (status IN ('reserviert', 'gueltig') OR (status = 'eingeloest' AND an_kasse));
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
