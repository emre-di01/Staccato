-- Ticketverkauf Schritt 3: Mitglieder reservieren Tickets (Kontingent, Obergrenze, Kapazität, Verfall)
--
-- ticket_info(event)                      → was der angemeldete Nutzer kaufen kann
-- tickets_reservieren(event, anzahl, betrag) → prüft und reserviert in einer Transaktion. Die Zeile in
--   ticket_einstellungen wird gesperrt, damit gleichzeitige Käufe Kapazität und Kontingent nicht überschreiten.
-- tickets_bereinigen()                    → setzt abgelaufene Reservierungen auf „verfallen“ (pg_cron).
--   Für Zählungen gilt immer die Frist selbst, der Job räumt nur den Status auf.

-- Sieht der angemeldete Nutzer die Veranstaltung? Gleiche Regeln wie die Policies auf events
-- („evt: lesen“, 20260517000012) – SECURITY-DEFINER-Funktionen umgehen RLS und müssen selbst prüfen.
-- Änderungen an den events-Policies hier nachziehen; supabase/tests/tickets.test.sql vergleicht beides.
CREATE OR REPLACE FUNCTION public.sieht_event(p_event_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = p_event_id AND auth.uid() IS NOT NULL AND (
         (public.meine_rolle() IN ('admin', 'superadmin', 'vorstand') AND e.schule_id = public.meine_schule_id())
      OR (e.oeffentlich = true AND e.schule_id = public.meine_schule_id() AND e.typ <> 'vorstandssitzung')
      OR (public.meine_rolle() = 'lehrer' AND e.erstellt_von = auth.uid() AND e.schule_id = public.meine_schule_id())
      OR EXISTS (SELECT 1 FROM public.event_teilnehmer t WHERE t.event_id = e.id AND t.profil_id = auth.uid())));
$function$;

-- Ergebnis: { ok, grund?, frei, meine, max, rest_verguenstigt, preis_normal, preis_verguenstigt, frist, verkauf_von }
-- grund: nicht_verfuegbar | kein_mitglied | noch_nicht | beendet | ausverkauft | obergrenze
CREATE OR REPLACE FUNCTION public.ticket_info(p_event_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_ich uuid := auth.uid();
  v_e record;
  v_belegt integer;
  v_meine integer;
  v_meine_verg integer;
  v_frei integer;
  v_frist timestamptz;
  v_grund text;
BEGIN
  IF v_ich IS NULL THEN
    RAISE EXCEPTION 'Nicht angemeldet' USING ERRCODE = '42501';
  END IF;

  SELECT te.*, ev.beginn, ev.schule_id, ev.typ INTO v_e
  FROM public.ticket_einstellungen te JOIN public.events ev ON ev.id = te.event_id
  WHERE te.event_id = p_event_id;
  IF NOT FOUND OR NOT v_e.aktiv OR v_e.typ = 'vorstandssitzung' OR NOT public.sieht_event(p_event_id) THEN
    RETURN jsonb_build_object('ok', false, 'grund', 'nicht_verfuegbar');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.schul_mitgliedschaften m JOIN public.profiles p ON p.id = m.user_id
                 WHERE m.user_id = v_ich AND m.schule_id = v_e.schule_id AND m.aktiv AND p.aktiv IS NOT FALSE) THEN
    RETURN jsonb_build_object('ok', false, 'grund', 'kein_mitglied');
  END IF;

  SELECT count(*),
         count(*) FILTER (WHERE b.kaeufer_id = v_ich),
         count(*) FILTER (WHERE b.kaeufer_id = v_ich AND t.verguenstigt)
    INTO v_belegt, v_meine, v_meine_verg
  FROM public.tickets t JOIN public.ticket_bestellungen b ON b.id = t.bestellung_id
  WHERE t.event_id = p_event_id
    AND (t.status IN ('gueltig', 'eingeloest') OR (t.status = 'reserviert' AND b.frist > now()));
  v_frei := greatest(v_e.kapazitaet - v_belegt, 0);

  v_frist := CASE WHEN v_e.bis_abendkasse
    THEN v_e.beginn - make_interval(mins => v_e.freigabe_minuten)
    ELSE least(now() + make_interval(days => v_e.frist_tage), coalesce(v_e.verkauf_bis, v_e.beginn), v_e.beginn) END;

  v_grund := CASE
    WHEN now() < v_e.verkauf_von THEN 'noch_nicht'
    WHEN now() >= v_e.beginn OR now() >= v_e.verkauf_bis OR now() >= v_frist THEN 'beendet'
    WHEN v_meine >= v_e.obergrenze THEN 'obergrenze'
    WHEN v_frei = 0 THEN 'ausverkauft'
  END;

  RETURN jsonb_build_object(
    'ok', v_grund IS NULL, 'grund', v_grund,
    'frei', v_frei, 'meine', v_meine,
    'max', least(v_frei, greatest(v_e.obergrenze - v_meine, 0)),
    'rest_verguenstigt', CASE WHEN v_e.preis_verguenstigt IS NULL THEN 0 ELSE greatest(v_e.kontingent - v_meine_verg, 0) END,
    'preis_normal', v_e.preis_normal, 'preis_verguenstigt', v_e.preis_verguenstigt,
    'frist', v_frist, 'verkauf_von', v_e.verkauf_von);
END;
$function$;

-- p_betrag: der Betrag, den der Nutzer bestätigt hat. Weicht er ab (Preis oder Kontingent inzwischen geändert),
-- wird nichts reserviert. Ergebnis: { ok, bestellung_id, betrag, frist, status } oder { ok: false, grund }
CREATE OR REPLACE FUNCTION public.tickets_reservieren(p_event_id uuid, p_anzahl integer, p_betrag numeric)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_info jsonb;
  v_verg integer;
  v_betrag numeric(10,2);
  v_frei boolean;
  v_id uuid;
  v_schule uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Nicht angemeldet' USING ERRCODE = '42501';
  END IF;

  -- Sperre: weitere Käufe derselben Veranstaltung warten hier
  PERFORM 1 FROM public.ticket_einstellungen WHERE event_id = p_event_id FOR UPDATE;
  v_info := public.ticket_info(p_event_id);
  IF NOT (v_info->>'ok')::boolean THEN
    RETURN jsonb_build_object('ok', false, 'grund', v_info->>'grund');
  END IF;
  IF p_anzahl IS NULL OR p_anzahl < 1 THEN
    RETURN jsonb_build_object('ok', false, 'grund', 'anzahl');
  END IF;
  IF p_anzahl > (v_info->>'max')::integer THEN
    RETURN jsonb_build_object('ok', false, 'grund',
      CASE WHEN p_anzahl > (v_info->>'frei')::integer THEN 'zu_wenig_frei' ELSE 'obergrenze' END);
  END IF;

  v_verg := least(p_anzahl, (v_info->>'rest_verguenstigt')::integer);
  v_betrag := v_verg * coalesce((v_info->>'preis_verguenstigt')::numeric, 0) + (p_anzahl - v_verg) * (v_info->>'preis_normal')::numeric;
  IF p_betrag IS DISTINCT FROM v_betrag THEN
    RETURN jsonb_build_object('ok', false, 'grund', 'preis_geaendert');
  END IF;

  -- Kostet die Bestellung nichts, gibt es keinen Geldeingang zu bestätigen: sofort gültig
  v_frei := v_betrag = 0;
  SELECT schule_id INTO v_schule FROM public.events WHERE id = p_event_id;
  INSERT INTO public.ticket_bestellungen (schule_id, event_id, herkunft, kaeufer_id, status, frist, erstellt_von)
  VALUES (v_schule, p_event_id, 'mitglied', auth.uid(), CASE WHEN v_frei THEN 'bezahlt' ELSE 'reserviert' END,
          CASE WHEN v_frei THEN NULL ELSE (v_info->>'frist')::timestamptz END, auth.uid())
  RETURNING id INTO v_id;

  INSERT INTO public.tickets (bestellung_id, event_id, preis, verguenstigt, status, code)
  SELECT v_id, p_event_id,
         CASE WHEN n <= v_verg THEN (v_info->>'preis_verguenstigt')::numeric ELSE (v_info->>'preis_normal')::numeric END,
         n <= v_verg,
         CASE WHEN v_frei THEN 'gueltig' ELSE 'reserviert' END,
         CASE WHEN v_frei THEN replace(gen_random_uuid()::text, '-', '') END
  FROM generate_series(1, p_anzahl) AS n;

  RETURN jsonb_build_object('ok', true, 'bestellung_id', v_id, 'betrag', v_betrag,
    'status', CASE WHEN v_frei THEN 'bezahlt' ELSE 'reserviert' END,
    'frist', CASE WHEN v_frei THEN NULL ELSE v_info->'frist' END);
END;
$function$;

CREATE OR REPLACE FUNCTION public.tickets_bereinigen()
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_anzahl integer;
BEGIN
  IF NOT public.ist_intern() THEN
    RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501';
  END IF;
  WITH abgelaufen AS (
    UPDATE public.ticket_bestellungen SET status = 'verfallen'
    WHERE status = 'reserviert' AND frist <= now() RETURNING id
  )
  UPDATE public.tickets t SET status = 'verfallen'
  FROM abgelaufen a WHERE t.bestellung_id = a.id AND t.status = 'reserviert';
  GET DIAGNOSTICS v_anzahl = ROW_COUNT;
  RETURN v_anzahl;
END;
$function$;

SELECT cron.schedule('tickets-verfall', '*/15 * * * *', $$SELECT public.tickets_bereinigen()$$);

-- ── DSGVO-Export: Ticketbestellungen ergänzt (sonst unverändert, Stand 20261118000003) ──

CREATE OR REPLACE FUNCTION public.meine_daten_exportieren()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Nicht authentifiziert';
  END IF;

  SELECT jsonb_build_object(
    'exportiert_am', now(),
    'profil', (
      SELECT jsonb_build_object(
        'voller_name',   p.voller_name,
        'email',         u.email,
        'rolle',         p.rolle,
        'sprache',       p.sprache,
        'telefon',       p.telefon,
        'adresse',       p.adresse,
        'geburtsdatum',  p.geburtsdatum,
        'avatar_url',    p.avatar_url,
        'notizen',       p.notizen,
        'email_benachrichtigungen', p.email_benachrichtigungen,
        'erstellt_am',   p.erstellt_am,
        'aktualisiert_am', p.aktualisiert_am
      )
      FROM profiles p LEFT JOIN auth.users u ON u.id = p.id
      WHERE p.id = v_uid
    ),
    'zahlungsdaten', (
      SELECT jsonb_build_object(
        'kontoinhaber',      kontoinhaber,
        'iban',              iban,
        'bic',               bic,
        'zahlungsweise',     zahlungsweise,
        'zahlungsrhythmus',  zahlungsrhythmus,
        'mitgliedsbeitrag',  mitgliedsbeitrag
      ) FROM profiles WHERE id = v_uid
    ),
    'erziehungsberechtigte', (
      SELECT jsonb_build_object(
        'name',     erziehungsberechtigter_name,
        'telefon',  erziehungsberechtigter_telefon,
        'email',    erziehungsberechtigter_email
      ) FROM profiles WHERE id = v_uid
    ),
    'kursmitgliedschaften', (
      SELECT jsonb_agg(jsonb_build_object(
        'kurs',   u.name,
        'typ',    u.typ,
        'status', us.status
      ))
      FROM unterricht_schueler us
      JOIN unterricht u ON u.id = us.unterricht_id
      WHERE us.schueler_id = v_uid
    ),
    'anwesenheiten', (
      SELECT jsonb_agg(jsonb_build_object(
        'datum',  s.beginn,
        'kurs',   u.name,
        'status', a.status
      ) ORDER BY s.beginn DESC)
      FROM anwesenheit a
      JOIN stunden s ON s.id = a.stunde_id
      JOIN unterricht u ON u.id = s.unterricht_id
      WHERE a.schueler_id = v_uid
    ),
    'dokumente', (
      SELECT jsonb_agg(jsonb_build_object(
        'name',           name,
        'typ',            typ,
        'hochgeladen_am', hochgeladen_am
      ) ORDER BY hochgeladen_am DESC)
      FROM mitglied_dateien
      WHERE profil_id = v_uid
    ),
    'rechnungen', (
      SELECT jsonb_agg(jsonb_build_object(
        'rechnungsnummer', rechnungsnummer,
        'ausgestellt_am',  ausgestellt_am,
        'betrag',          betrag,
        'positionen',      positionen,
        'faellig_am',      faellig_am,
        'bezahlt_am',      bezahlt_am,
        'zahlungsweg',     zahlungsweg,
        'storniert_am',    storniert_am,
        'empfaenger',      empfaenger_snapshot
      ) ORDER BY ausgestellt_am DESC)
      FROM rechnungen
      WHERE schueler_id = v_uid
    ),
    'nachrichten_gesendet', (
      SELECT jsonb_agg(jsonb_build_object(
        'betreff',    betreff,
        'inhalt',     inhalt,
        'typ',        typ,
        'gesendet_am', gesendet_am
      ))
      FROM nachrichten
      WHERE gesendet_von = v_uid
    ),
    'nachrichten_empfangen', (
      SELECT jsonb_agg(jsonb_build_object(
        'betreff',    betreff,
        'inhalt',     inhalt,
        'typ',        typ,
        'gesendet_am', gesendet_am
      ))
      FROM nachrichten
      WHERE empfaenger_id = v_uid
    ),
    'event_teilnahmen', (
      SELECT jsonb_agg(jsonb_build_object(
        'event',   e.titel,
        'datum',   e.beginn,
        'zusage',  et.zusage
      ))
      FROM event_teilnehmer et
      JOIN events e ON e.id = et.event_id
      WHERE et.profil_id = v_uid
    ),
    'ticketbestellungen', (
      SELECT jsonb_agg(jsonb_build_object(
        'event',       e.titel,
        'datum',       e.beginn,
        'bestellt_am', b.erstellt_am,
        'status',      b.status,
        'tickets', (
          SELECT jsonb_agg(jsonb_build_object('preis', t.preis, 'verguenstigt', t.verguenstigt, 'status', t.status, 'eingeloest_am', t.eingeloest_am))
          FROM tickets t WHERE t.bestellung_id = b.id
        ),
        'zahlungen', (
          SELECT jsonb_agg(jsonb_build_object('methode', z.methode, 'betrag', z.betrag, 'zeitpunkt', z.zeitpunkt))
          FROM ticket_zahlungen z WHERE z.bestellung_id = b.id
        )
      ) ORDER BY b.erstellt_am DESC)
      FROM ticket_bestellungen b
      JOIN events e ON e.id = b.event_id
      WHERE b.kaeufer_id = v_uid
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;
