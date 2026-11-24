-- Ticketverkauf Schritt 6: Einlass (Admin oder Freigabe „Scannen“ der Veranstaltung)
--
-- ticket_scannen() prüft und entwertet in einem Schritt. Die gemeinsame Sperre (FOR SHARE) auf ticket_einstellungen
-- lässt mehrere Geräte gleichzeitig scannen, aber nicht gleichzeitig mit einem Storno (FOR UPDATE).
-- p_scan_id macht Wiederholungen nach Netzaussetzern gefahrlos: gleiche ID → gleiches Ergebnis.
-- Scannen geht ab 12 h vor Beginn bis 6 h nach dem Ende (ohne Endzeit: 12 h nach Beginn), damit niemand beim
-- Ausprobieren Tage vorher Tickets entwertet. Außerhalb wird nichts entwertet und nichts protokolliert.
-- Wer scannt, erfährt weder Namen noch Preise.

CREATE OR REPLACE FUNCTION public.darf_scannen(p_event_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $function$
  SELECT public.ist_admin_von_event(p_event_id) OR EXISTS (
    SELECT 1 FROM public.ticket_freigaben f
    JOIN public.events e ON e.id = f.event_id
    JOIN public.schul_mitgliedschaften m ON m.schule_id = e.schule_id AND m.user_id = f.profil_id AND m.aktiv
    JOIN public.profiles p ON p.id = f.profil_id AND p.aktiv IS NOT FALSE
    WHERE f.event_id = p_event_id AND f.profil_id = auth.uid() AND f.scannen);
$function$;

-- Ergebnis: { ergebnis, eingeloest_am?, event_titel?, ab?, eingelassen, gesamt }
-- ergebnis: ok | schon_eingeloest | storniert | falsche_veranstaltung | unbekannt | zu_frueh | vorbei
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

-- Veranstaltungen, bei denen ich scannen darf (noch nicht vorbei). Admins: nur die der aktiven Schule.
-- Freigegebene sehen hier auch Veranstaltungen, die sonst nicht für sie sichtbar sind – nur die nötigen Angaben.
CREATE OR REPLACE FUNCTION public.meine_scan_events()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Nicht angemeldet' USING ERRCODE = '42501';
  END IF;
  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', e.id, 'titel', e.titel, 'beginn', e.beginn, 'zeitzone', s.zeitzone,
      'ab', e.beginn - interval '12 hours',
      'scanbar', now() >= e.beginn - interval '12 hours',
      'eingelassen', (SELECT count(*) FROM public.tickets t WHERE t.event_id = e.id AND t.status = 'eingeloest'),
      'gesamt', (SELECT count(*) FROM public.tickets t WHERE t.event_id = e.id AND t.status IN ('gueltig', 'eingeloest'))
    ) ORDER BY e.beginn), '[]'::jsonb)
    FROM public.events e
    JOIN public.ticket_einstellungen te ON te.event_id = e.id
    JOIN public.schulen s ON s.id = e.schule_id
    WHERE now() <= coalesce(e.ende, e.beginn + interval '6 hours') + interval '6 hours'
      AND (te.aktiv OR EXISTS (SELECT 1 FROM public.tickets t WHERE t.event_id = e.id AND t.code IS NOT NULL))
      AND ((e.schule_id = public.meine_schule_id() AND public.ist_admin_von_schule(e.schule_id))
           OR (EXISTS (SELECT 1 FROM public.ticket_freigaben f WHERE f.event_id = e.id AND f.profil_id = auth.uid() AND f.scannen)
               AND public.darf_scannen(e.id))));
END;
$function$;
