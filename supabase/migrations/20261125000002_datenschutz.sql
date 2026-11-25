-- Datenschutz: sensible Profildaten trennen, Sicht auf Schulen einschränken
--
-- RLS kann nur ganze Zeilen freigeben: Lehrkräfte sahen mit den Profilen ihrer Schüler auch IBAN und Kalender-Schlüssel.
-- Bankdaten und Kalender-Schlüssel liegen jetzt in eigenen Tabellen. Die alten Spalten in profiles bleiben leer stehen,
-- damit noch geöffnete alte App-Versionen weiterlaufen; ein Trigger leitet deren Schreibzugriffe um.

-- ── Bankdaten ──
CREATE TABLE IF NOT EXISTS public.profil_bankdaten (
  profil_id        uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  zahlungsweise    text CHECK (zahlungsweise IN ('sepa', 'ueberweisung', 'bar')),
  zahlungsrhythmus text CHECK (zahlungsrhythmus IN ('monatlich', 'quartalsweise', 'halbjaehrlich', 'jaehrlich')),
  mitgliedsbeitrag numeric(8,2),
  kontoinhaber     text,
  iban             text,
  bic              text,
  aktualisiert_am  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profil_bankdaten ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profil_bankdaten FROM anon, authenticated;
GRANT SELECT ON public.profil_bankdaten TO authenticated;
DROP POLICY IF EXISTS "pbd: eigene" ON public.profil_bankdaten;
-- Nur die eigene Zeile; Admins lesen über mitglieder_mit_email, geschrieben wird nur über bankdaten_setzen()
CREATE POLICY "pbd: eigene" ON public.profil_bankdaten FOR SELECT TO authenticated USING (profil_id = auth.uid());

-- p_daten: nur die enthaltenen Felder werden geändert (null = löschen). Mitglieder ändern ihre Bankverbindung,
-- Beitrag und Rhythmus nur Admins der Schule.
CREATE OR REPLACE FUNCTION public.bankdaten_setzen(p_profil uuid, p_daten jsonb)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_admin boolean;
BEGIN
  SELECT public.ist_admin_von_schule(p.schule_id) AND (p.schule_id = public.meine_schule_id() OR public.meine_rolle() = 'superadmin')
    INTO v_admin FROM public.profiles p WHERE p.id = p_profil;
  IF auth.uid() IS NULL OR v_admin IS NULL OR NOT (v_admin OR p_profil = auth.uid()) THEN
    RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501';
  END IF;
  IF NOT v_admin AND p_daten ?| ARRAY['mitgliedsbeitrag', 'zahlungsrhythmus'] THEN
    RAISE EXCEPTION 'Beitrag und Zahlungsrhythmus legt die Musikschule fest' USING ERRCODE = '42501';
  END IF;
  PERFORM public.bankdaten_uebernehmen(p_profil, p_daten);
END;
$function$;

-- intern: ohne Rechteprüfung, nicht von außen nutzbar (Aufruf nur aus Funktionen/Triggern des Eigentümers)
CREATE OR REPLACE FUNCTION public.bankdaten_uebernehmen(p_profil uuid, p_daten jsonb)
 RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profil_bankdaten (profil_id) VALUES (p_profil) ON CONFLICT DO NOTHING;
  UPDATE public.profil_bankdaten SET
    zahlungsweise    = CASE WHEN p_daten ? 'zahlungsweise'    THEN nullif(p_daten->>'zahlungsweise', '')    ELSE zahlungsweise END,
    zahlungsrhythmus = CASE WHEN p_daten ? 'zahlungsrhythmus' THEN nullif(p_daten->>'zahlungsrhythmus', '') ELSE zahlungsrhythmus END,
    mitgliedsbeitrag = CASE WHEN p_daten ? 'mitgliedsbeitrag' THEN nullif(p_daten->>'mitgliedsbeitrag', '')::numeric ELSE mitgliedsbeitrag END,
    kontoinhaber     = CASE WHEN p_daten ? 'kontoinhaber'     THEN nullif(p_daten->>'kontoinhaber', '')     ELSE kontoinhaber END,
    iban             = CASE WHEN p_daten ? 'iban'             THEN nullif(p_daten->>'iban', '')             ELSE iban END,
    bic              = CASE WHEN p_daten ? 'bic'              THEN nullif(p_daten->>'bic', '')              ELSE bic END,
    aktualisiert_am  = now()
  WHERE profil_id = p_profil;
END;
$function$;

-- ── Kalender-Schlüssel ──
CREATE TABLE IF NOT EXISTS public.profil_kalender (
  profil_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  token     uuid NOT NULL UNIQUE DEFAULT gen_random_uuid()
);
ALTER TABLE public.profil_kalender ENABLE ROW LEVEL SECURITY;   -- bewusst keine Policies: nur mein_kalender_token() und die Function „kalender“
REVOKE ALL ON public.profil_kalender FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.mein_kalender_token(p_neu boolean DEFAULT false)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_token uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Nicht angemeldet' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.profil_kalender (profil_id) VALUES (auth.uid())
  ON CONFLICT (profil_id) DO UPDATE SET token = CASE WHEN p_neu THEN gen_random_uuid() ELSE profil_kalender.token END
  RETURNING token INTO v_token;
  RETURN v_token;
END;
$function$;

-- ── Bestand umziehen, alte Spalten leeren ──
INSERT INTO public.profil_bankdaten (profil_id, zahlungsweise, zahlungsrhythmus, mitgliedsbeitrag, kontoinhaber, iban, bic)
SELECT id, zahlungsweise, zahlungsrhythmus, mitgliedsbeitrag, kontoinhaber, iban, bic FROM public.profiles
WHERE coalesce(zahlungsweise, zahlungsrhythmus, kontoinhaber, iban, bic) IS NOT NULL OR mitgliedsbeitrag IS NOT NULL
ON CONFLICT DO NOTHING;
INSERT INTO public.profil_kalender (profil_id, token)
SELECT id, kalender_token FROM public.profiles WHERE kalender_token IS NOT NULL ON CONFLICT DO NOTHING;
ALTER TABLE public.profiles ALTER COLUMN kalender_token DROP DEFAULT;

-- Alte App-Versionen schreiben noch in profiles: Werte umleiten, nie in profiles stehen lassen.
-- Name vor profil_schutz_trigger, deshalb prüft er Beitrag/Rhythmus selbst.
CREATE OR REPLACE FUNCTION public.profil_daten_umleiten()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  IF NOT public.ist_intern() AND NEW.id = auth.uid() AND NOT public.ist_admin_von_schule(NEW.schule_id)
     AND (NEW.mitgliedsbeitrag IS NOT NULL OR NEW.zahlungsrhythmus IS NOT NULL) THEN
    RAISE EXCEPTION 'Beitrag und Zahlungsrhythmus legt die Musikschule fest' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

-- Umzug nach dem Schreiben (die Zeile muss für den Fremdschlüssel existieren)
CREATE OR REPLACE FUNCTION public.profil_daten_umziehen()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  IF coalesce(NEW.zahlungsweise, NEW.zahlungsrhythmus, NEW.kontoinhaber, NEW.iban, NEW.bic) IS NOT NULL OR NEW.mitgliedsbeitrag IS NOT NULL THEN
    PERFORM public.bankdaten_uebernehmen(NEW.id, jsonb_strip_nulls(jsonb_build_object('zahlungsweise', NEW.zahlungsweise, 'zahlungsrhythmus', NEW.zahlungsrhythmus,
      'mitgliedsbeitrag', NEW.mitgliedsbeitrag, 'kontoinhaber', NEW.kontoinhaber, 'iban', NEW.iban, 'bic', NEW.bic)));
  END IF;
  IF NEW.kalender_token IS NOT NULL THEN
    INSERT INTO public.profil_kalender (profil_id, token) VALUES (NEW.id, NEW.kalender_token)
    ON CONFLICT (profil_id) DO UPDATE SET token = EXCLUDED.token;
  END IF;
  UPDATE public.profiles SET zahlungsweise = NULL, zahlungsrhythmus = NULL, mitgliedsbeitrag = NULL, kontoinhaber = NULL, iban = NULL, bic = NULL, kalender_token = NULL
  WHERE id = NEW.id;
  RETURN NULL;
END;
$function$;
DROP TRIGGER IF EXISTS profil_daten_umleiten ON public.profiles;
CREATE TRIGGER profil_daten_umleiten BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.profil_daten_umleiten();
DROP TRIGGER IF EXISTS profil_daten_umziehen ON public.profiles;
CREATE TRIGGER profil_daten_umziehen AFTER INSERT OR UPDATE ON public.profiles FOR EACH ROW
  WHEN (NEW.zahlungsweise IS NOT NULL OR NEW.zahlungsrhythmus IS NOT NULL OR NEW.mitgliedsbeitrag IS NOT NULL OR NEW.kontoinhaber IS NOT NULL
        OR NEW.iban IS NOT NULL OR NEW.bic IS NOT NULL OR NEW.kalender_token IS NOT NULL)
  EXECUTE FUNCTION public.profil_daten_umziehen();

-- Bestand leeren (Trigger profil_schutz verbietet es niemandem: läuft als Eigentümer)
ALTER TABLE public.profiles DISABLE TRIGGER USER;
UPDATE public.profiles SET zahlungsweise = NULL, zahlungsrhythmus = NULL, mitgliedsbeitrag = NULL, kontoinhaber = NULL, iban = NULL, bic = NULL, kalender_token = NULL
WHERE coalesce(zahlungsweise, zahlungsrhythmus, kontoinhaber, iban, bic) IS NOT NULL OR mitgliedsbeitrag IS NOT NULL OR kalender_token IS NOT NULL;
ALTER TABLE public.profiles ENABLE TRIGGER USER;

-- ── View: Bankdaten nur für Admins der Schule und die Person selbst (auch in seed.sql pflegen) ──
CREATE OR REPLACE VIEW public.mitglieder_mit_email
WITH (security_invoker = false)
AS
SELECT
  p.id, p.voller_name, p.rolle, p.schule_id, p.sprache, p.telefon, p.adresse, p.geburtsdatum, p.aktiv, p.notizen, p.avatar_url, p.kann_kurse_anlegen,
  CASE WHEN p.id = auth.uid() OR public.meine_rolle() IN ('admin', 'superadmin') THEN b.iban END AS iban,
  CASE WHEN p.id = auth.uid() OR public.meine_rolle() IN ('admin', 'superadmin') THEN b.bic END AS bic,
  CASE WHEN p.id = auth.uid() OR public.meine_rolle() IN ('admin', 'superadmin') THEN b.kontoinhaber END AS kontoinhaber,
  CASE WHEN p.id = auth.uid() OR public.meine_rolle() IN ('admin', 'superadmin') THEN b.zahlungsweise END AS zahlungsweise,
  CASE WHEN p.id = auth.uid() OR public.meine_rolle() IN ('admin', 'superadmin') THEN b.zahlungsrhythmus END AS zahlungsrhythmus,
  (CASE WHEN p.id = auth.uid() OR public.meine_rolle() IN ('admin', 'superadmin') THEN b.mitgliedsbeitrag END)::numeric(8,2) AS mitgliedsbeitrag,
  p.erziehungsberechtigter_name, p.erziehungsberechtigter_telefon, p.erziehungsberechtigter_email, p.aktualisiert_am, p.erstellt_am,
  u.email
FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.id
LEFT JOIN public.profil_bankdaten b ON b.profil_id = p.id
WHERE p.schule_id = public.meine_schule_id()
  AND (p.id = auth.uid() OR public.meine_rolle() IN ('admin', 'superadmin') OR public.ist_lehrer_von_schueler(p.id));

-- ── Schulen: nur die eigenen (vorher sah jeder Angemeldete Steuernummer, Adresse und Tarif aller Schulen) ──
DROP POLICY IF EXISTS "schulen: lesen" ON public.schulen;
CREATE POLICY "schulen: lesen" ON public.schulen FOR SELECT TO authenticated USING (
  id = public.meine_schule_id()
  OR EXISTS (SELECT 1 FROM public.schul_mitgliedschaften m WHERE m.schule_id = schulen.id AND m.user_id = auth.uid() AND m.aktiv));

-- ── Raumbelegung: nur Räume der eigenen Schule ──
CREATE OR REPLACE FUNCTION public.raum_belegung(p_raum_id uuid, p_von date DEFAULT CURRENT_DATE, p_bis date DEFAULT (CURRENT_DATE + 7))
 RETURNS TABLE(stunde_id uuid, unterricht_name text, beginn timestamp with time zone, ende timestamp with time zone, lehrer_namen text[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  IF NOT public.ist_intern() AND NOT EXISTS (SELECT 1 FROM public.raeume x WHERE x.id = p_raum_id AND x.schule_id = public.meine_schule_id()) THEN RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501'; END IF;
  return query
  select s.id, u.name, s.beginn, s.ende,
    array(select p.voller_name from public.stunden_lehrer sl join public.profiles p on p.id=sl.lehrer_id where sl.stunde_id=s.id)
  from public.stunden s
  join public.unterricht u on u.id=s.unterricht_id
  where s.raum_id=p_raum_id
  and s.beginn::date between p_von and p_bis
  and s.status != 'abgesagt'
  order by s.beginn;
end;
$function$;

-- ── Datenexport (Art. 15): Zahlungsdaten aus der neuen Tabelle ──
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
      ) FROM profil_bankdaten WHERE profil_id = v_uid
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
