-- Ticketverkauf Schritt 5: eigene Tickets mit Veranstaltungsdaten
-- Eigene Funktion statt Join über events: Wer ein Ticket hat, behält es auch dann im Blick, wenn die Veranstaltung
-- inzwischen nicht mehr sichtbar ist (nicht mehr öffentlich, Schule gewechselt). Nur die fürs Ticket nötigen Angaben.
-- Verfallene und komplett stornierte, nie bezahlte Bestellungen fehlen. Codes nur für gültige und eingelöste Tickets.
CREATE OR REPLACE FUNCTION public.meine_tickets()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
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
    WHERE b.kaeufer_id = auth.uid()
      AND (b.status = 'bezahlt' OR (b.status = 'reserviert' AND b.frist > now())
           OR (b.status = 'storniert' AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.bestellung_id = b.id AND t.code IS NOT NULL))));
END;
$function$;
