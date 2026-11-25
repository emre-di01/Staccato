-- Vergangene Veranstaltungen mit Ticketbestellungen löschen (bisher gar nicht löschbar)
--
-- Wurde nie echtes Geld angenommen, verschwinden Bestellungen und Veranstaltung endgültig.
-- Sonst bleiben Bestellungen und Zahlungen als Belege erhalten: events.geloescht_am blendet die Veranstaltung überall aus.
-- geloescht_am setzt nur event_loeschen(): nach einem direkten UPDATE wäre die Zeile nicht mehr lesbar, RLS lehnt ihn ab.

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS geloescht_am timestamptz;

DROP POLICY IF EXISTS "evt: nicht geloescht" ON public.events;
CREATE POLICY "evt: nicht geloescht" ON public.events AS RESTRICTIVE FOR SELECT USING (geloescht_am IS NULL);

-- Ergebnis: { ok, art: 'endgueltig' | 'ausblenden' } oder { ok: false, grund: 'kein_admin' | 'nicht_vorbei' | 'erstattung_offen' }
-- p_nur_pruefen: nur sagen, was passieren würde (für die Rückfrage)
CREATE OR REPLACE FUNCTION public.event_loeschen(p_event_id uuid, p_nur_pruefen boolean DEFAULT false)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_event record;
  v_art text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.ist_admin_von_event(p_event_id) THEN
    RETURN jsonb_build_object('ok', false, 'grund', 'kein_admin');
  END IF;
  -- Sperrreihenfolge wie beim Ticketverkauf: zuerst ticket_einstellungen
  PERFORM 1 FROM public.ticket_einstellungen WHERE event_id = p_event_id FOR UPDATE;
  SELECT id, coalesce(ende, beginn + interval '6 hours') AS ende, geloescht_am INTO v_event
  FROM public.events WHERE id = p_event_id FOR UPDATE;
  IF v_event.geloescht_am IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'art', 'ausblenden');
  END IF;
  IF v_event.ende > now() THEN
    RETURN jsonb_build_object('ok', false, 'grund', 'nicht_vorbei');
  END IF;
  IF EXISTS (SELECT 1 FROM public.ticket_online_erstattungen o JOIN public.ticket_bestellungen b ON b.id = o.bestellung_id
             WHERE b.event_id = p_event_id AND NOT b.demo AND o.erledigt_am IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'grund', 'erstattung_offen');
  END IF;

  -- Online begonnene Bestellungen zählen mit: eine Zahlung könnte noch eintreffen
  v_art := CASE WHEN EXISTS (
    SELECT 1 FROM public.ticket_bestellungen b WHERE b.event_id = p_event_id AND NOT b.demo
      AND (b.checkout_id IS NOT NULL OR EXISTS (SELECT 1 FROM public.ticket_zahlungen z WHERE z.bestellung_id = b.id AND z.betrag > 0)))
    THEN 'ausblenden' ELSE 'endgueltig' END;
  IF p_nur_pruefen THEN
    RETURN jsonb_build_object('ok', true, 'art', v_art);
  END IF;

  IF v_art = 'endgueltig' THEN
    DELETE FROM public.ticket_bestellungen WHERE event_id = p_event_id;
    DELETE FROM public.events WHERE id = p_event_id;
  ELSE
    UPDATE public.ticket_einstellungen SET aktiv = false, shop_aktiv = false WHERE event_id = p_event_id;
    DELETE FROM public.ticket_freigaben WHERE event_id = p_event_id;
    DELETE FROM public.event_teilnehmer WHERE event_id = p_event_id;   -- auch aus den Kalender-Abos
    UPDATE public.events SET geloescht_am = now() WHERE id = p_event_id;
  END IF;
  RETURN jsonb_build_object('ok', true, 'art', v_art);
END;
$function$;

-- Gelöschte weglassen; 'bis' = Ende der Veranstaltung, damit eine lange offene App die Karte selbst ausblendet
CREATE OR REPLACE FUNCTION public.meine_scan_events()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Nicht angemeldet' USING ERRCODE = '42501';
  END IF;
  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', e.id, 'titel', e.titel, 'beginn', e.beginn, 'zeitzone', s.zeitzone,
      'ab', e.beginn - interval '12 hours', 'bis', coalesce(e.ende, e.beginn + interval '6 hours'),
      'scanbar', now() >= e.beginn - interval '12 hours',
      'eingelassen', (SELECT count(*) FROM public.tickets t WHERE t.event_id = e.id AND t.status = 'eingeloest'),
      'gesamt', (SELECT count(*) FROM public.tickets t WHERE t.event_id = e.id AND t.status IN ('gueltig', 'eingeloest'))
    ) ORDER BY e.beginn), '[]'::jsonb)
    FROM public.events e
    JOIN public.ticket_einstellungen te ON te.event_id = e.id
    JOIN public.schulen s ON s.id = e.schule_id
    WHERE e.geloescht_am IS NULL AND now() <= coalesce(e.ende, e.beginn + interval '6 hours') + interval '6 hours'
      AND (te.aktiv OR EXISTS (SELECT 1 FROM public.tickets t WHERE t.event_id = e.id AND t.code IS NOT NULL))
      AND ((e.schule_id = public.meine_schule_id() AND public.ist_admin_von_schule(e.schule_id))
           OR (EXISTS (SELECT 1 FROM public.ticket_freigaben f WHERE f.event_id = e.id AND f.profil_id = auth.uid() AND f.scannen)
               AND public.darf_scannen(e.id))));
END;
$function$;

CREATE OR REPLACE FUNCTION public.meine_kassen_events()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Nicht angemeldet' USING ERRCODE = '42501';
  END IF;
  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', e.id, 'titel', e.titel, 'beginn', e.beginn, 'zeitzone', s.zeitzone,
      'ab', e.beginn - interval '3 hours', 'bis', coalesce(e.ende, e.beginn + interval '6 hours'), 'offen', public.abendkasse_offen(e.id),
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
    WHERE e.geloescht_am IS NULL AND now() <= coalesce(e.ende, e.beginn + interval '6 hours')
      AND (te.aktiv OR EXISTS (SELECT 1 FROM public.ticket_bestellungen b WHERE b.event_id = e.id))
      AND ((e.schule_id = public.meine_schule_id() AND public.ist_admin_von_schule(e.schule_id))
           OR (f.profil_id IS NOT NULL AND public.darf_kassieren(e.id))));
END;
$function$;

CREATE OR REPLACE FUNCTION public.meine_tickets()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Nicht angemeldet' USING ERRCODE = '42501';
  END IF;
  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', b.id, 'status', b.status, 'frist', b.frist,
      'event', jsonb_build_object(
        'id', e.id, 'titel', e.titel, 'typ', e.typ, 'beginn', e.beginn, 'ende', e.ende,
        'ort', coalesce(nullif(e.ort, ''), r.name),
        -- Bilder sind nur für die aktive Schule lesbar (Policy auf event-bilder)
        'bild_pfad', CASE WHEN e.schule_id = public.meine_schule_id() THEN e.bild_pfad END),
      'schule', jsonb_build_object('name', s.name, 'logo_url', s.logo_url, 'farbe', s.farbe, 'zeitzone', s.zeitzone),
      'tickets', (
        SELECT jsonb_agg(jsonb_build_object(
          'id', t.id, 'preis', t.preis, 'verguenstigt', t.verguenstigt, 'status', t.status, 'eingeloest_am', t.eingeloest_am,
          'code', CASE WHEN t.status IN ('gueltig', 'eingeloest') THEN t.code END) ORDER BY t.preis, t.id)
        FROM public.tickets t WHERE t.bestellung_id = b.id)
    ) ORDER BY e.beginn, b.erstellt_am, b.id), '[]'::jsonb)
    FROM public.ticket_bestellungen b
    JOIN public.events e ON e.id = b.event_id
    JOIN public.schulen s ON s.id = b.schule_id
    LEFT JOIN public.raeume r ON r.id = e.raum_id
    WHERE b.kaeufer_id = auth.uid() AND e.geloescht_am IS NULL
      AND (b.status = 'bezahlt' OR (b.status = 'reserviert' AND b.frist > now())
           OR (b.status = 'storniert' AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.bestellung_id = b.id AND t.code IS NOT NULL))));
END;
$function$;
