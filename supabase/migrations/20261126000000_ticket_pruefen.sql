-- Einlass: Prüfmodus. Prüft ein Ticket, ohne es zu entwerten.
--
-- Gleiche Berechtigung wie ticket_scannen (Admin oder Freigabe „Scannen“), aber ohne Zeitfenster: Helfer sollen
-- schon Tage vorher üben und Admins bei Rückfragen nachsehen können. Liest nur – kein Statuswechsel, kein
-- Eintrag in ticket_scans, Zählerstände bleiben gleich. Wer prüft, erfährt weder Namen noch Preise (wie beim Scannen).
-- ergebnis: gueltig | schon_eingeloest | storniert | falsche_veranstaltung | unbekannt | demo

CREATE OR REPLACE FUNCTION public.ticket_pruefen(p_event_id uuid, p_code text)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_schule uuid;
  v_t record;
  v_ergebnis text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.darf_scannen(p_event_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501';
  END IF;
  SELECT schule_id INTO v_schule FROM public.events WHERE id = p_event_id AND geloescht_am IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501';
  END IF;

  SELECT t.event_id, t.status, t.eingeloest_am, e.titel, e.schule_id INTO v_t
  FROM public.tickets t JOIN public.events e ON e.id = t.event_id
  WHERE t.code = p_code;

  IF v_t.event_id IS NULL OR v_t.schule_id <> v_schule THEN
    v_ergebnis := 'unbekannt';   -- Tickets anderer Schulen werden nicht verraten
  ELSIF v_t.event_id <> p_event_id THEN
    v_ergebnis := 'falsche_veranstaltung';
  ELSIF v_t.status = 'gueltig' THEN
    v_ergebnis := 'gueltig';
  ELSIF v_t.status = 'eingeloest' THEN
    v_ergebnis := 'schon_eingeloest';
  ELSIF v_t.status = 'demo' THEN
    v_ergebnis := 'demo';
  ELSE
    v_ergebnis := 'storniert';
  END IF;

  RETURN jsonb_build_object('ergebnis', v_ergebnis,
    'eingeloest_am', CASE WHEN v_ergebnis = 'schon_eingeloest' THEN v_t.eingeloest_am END,
    'event_titel', CASE WHEN v_ergebnis = 'falsche_veranstaltung' THEN v_t.titel END);
END;
$function$;

-- 'helfer' = Freigabe „Scannen“: Helfer sehen die Karte auf der Startseite schon vor dem Einlass (zum Üben),
-- Admins erst am Veranstaltungstag. Sonst unverändert (Stand 20261125000000)
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
      'helfer', EXISTS (SELECT 1 FROM public.ticket_freigaben f WHERE f.event_id = e.id AND f.profil_id = auth.uid() AND f.scannen),
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
