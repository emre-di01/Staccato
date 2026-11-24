-- Ticketverkauf für Veranstaltungen: Datenmodell und Rechte (Konzept: Claude-Docs „Staccato Ticketverkauf“)
--
-- Käufer, Zahlung und Ticket sind getrennte Datensätze, damit ein öffentlicher Shop und Onlinezahlung
-- später ohne Umbau dazukommen.
--
-- Clients schreiben direkt nur ticket_einstellungen und ticket_freigaben (Admins der Schule).
-- Bestellungen, Tickets, Zahlungen, Erstattungen und Scans haben KEINE Schreib-Policies: Kontingent,
-- Kapazität, Bezahlstatus und Entwerten laufen ausschließlich über SECURITY-DEFINER-Funktionen
-- (folgende Migrationen). Auch Personen mit Freigabe „Kasse“/„Scannen“ arbeiten nur über Funktionen,
-- damit niemand fremde QR-Codes auslesen kann.
--
-- Veranstaltungen mit Bestellungen sind nicht löschbar (Barzahlungen müssen nachvollziehbar bleiben).
-- Beim Löschen einer ganzen Schule verschwinden auch ihre Bestellungen.

-- ── Tabellen ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ticket_einstellungen (
  event_id            uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  aktiv               boolean NOT NULL DEFAULT false,            -- Verkauf eingeschaltet
  kapazitaet          integer NOT NULL CHECK (kapazitaet > 0),
  preis_normal        numeric(8,2) NOT NULL CHECK (preis_normal >= 0),
  preis_verguenstigt  numeric(8,2) CHECK (preis_verguenstigt >= 0),
  kontingent          integer NOT NULL DEFAULT 0 CHECK (kontingent >= 0),      -- vergünstigte Tickets pro Konto
  obergrenze          integer NOT NULL DEFAULT 10 CHECK (obergrenze > 0),      -- Tickets pro Konto insgesamt
  verkauf_von         timestamptz,                               -- null = sofort
  verkauf_bis         timestamptz,                               -- null = bis Veranstaltungsbeginn
  frist_tage          integer NOT NULL DEFAULT 7 CHECK (frist_tage > 0),       -- unbezahlte Reservierung verfällt
  bis_abendkasse      boolean NOT NULL DEFAULT false,            -- Reservierung gilt bis zur Abendkasse
  freigabe_minuten    integer NOT NULL DEFAULT 30 CHECK (freigabe_minuten >= 0), -- Minuten vor Beginn, zu denen nicht abgeholte Plätze frei werden
  aktualisiert_am     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ticket_einst_preis      CHECK (preis_verguenstigt IS NULL OR preis_verguenstigt <= preis_normal),
  CONSTRAINT ticket_einst_kontingent CHECK (kontingent <= obergrenze AND (kontingent = 0 OR preis_verguenstigt IS NOT NULL)),
  CONSTRAINT ticket_einst_zeitraum   CHECK (verkauf_von IS NULL OR verkauf_bis IS NULL OR verkauf_von < verkauf_bis)
);

CREATE TABLE IF NOT EXISTS public.ticket_freigaben (
  event_id    uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  profil_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scannen     boolean NOT NULL DEFAULT false,
  kasse       boolean NOT NULL DEFAULT false,
  erstellt_am timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, profil_id),
  CONSTRAINT ticket_freigabe_nicht_leer CHECK (scannen OR kasse)
);
CREATE INDEX IF NOT EXISTS ticket_freigaben_profil_idx ON public.ticket_freigaben (profil_id);

CREATE TABLE IF NOT EXISTS public.ticket_bestellungen (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schule_id    uuid NOT NULL REFERENCES public.schulen(id) ON DELETE CASCADE,
  event_id     uuid NOT NULL REFERENCES public.events(id),       -- bewusst kein CASCADE, siehe oben
  herkunft     text NOT NULL DEFAULT 'mitglied' CHECK (herkunft IN ('mitglied', 'abendkasse', 'shop')),
  kaeufer_id   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,   -- null: Abendkasse ohne Namen, gelöschtes Konto
  kaeufer_name text,                                             -- für den späteren Shop
  status       text NOT NULL DEFAULT 'reserviert' CHECK (status IN ('reserviert', 'bezahlt', 'storniert', 'verfallen')),
  frist        timestamptz,                                      -- Zahlungsfrist, null sobald bezahlt
  erstellt_von uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  erstellt_am  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ticket_bestellung_frist CHECK (status <> 'reserviert' OR frist IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS ticket_bestellungen_event_idx   ON public.ticket_bestellungen (event_id);
CREATE INDEX IF NOT EXISTS ticket_bestellungen_kaeufer_idx ON public.ticket_bestellungen (kaeufer_id);
CREATE INDEX IF NOT EXISTS ticket_bestellungen_frist_idx   ON public.ticket_bestellungen (frist) WHERE status = 'reserviert';

CREATE TABLE IF NOT EXISTS public.tickets (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bestellung_id  uuid NOT NULL REFERENCES public.ticket_bestellungen(id) ON DELETE CASCADE,
  event_id       uuid NOT NULL REFERENCES public.events(id),
  preis          numeric(8,2) NOT NULL CHECK (preis >= 0),       -- Preis zum Zeitpunkt der Reservierung
  verguenstigt   boolean NOT NULL DEFAULT false,
  status         text NOT NULL DEFAULT 'reserviert' CHECK (status IN ('reserviert', 'gueltig', 'eingeloest', 'storniert', 'verfallen')),
  code           text UNIQUE,                                    -- entsteht erst mit bestätigtem Geldeingang
  eingeloest_am  timestamptz,
  storniert_am   timestamptz,
  storniert_von  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  erstellt_am    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ticket_code_nur_bezahlt CHECK (status NOT IN ('gueltig', 'eingeloest') OR code IS NOT NULL),
  CONSTRAINT ticket_code_nicht_vorher CHECK (status NOT IN ('reserviert', 'verfallen') OR code IS NULL)
);
CREATE INDEX IF NOT EXISTS tickets_bestellung_idx   ON public.tickets (bestellung_id);
CREATE INDEX IF NOT EXISTS tickets_event_status_idx ON public.tickets (event_id, status);

CREATE TABLE IF NOT EXISTS public.ticket_zahlungen (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bestellung_id  uuid NOT NULL REFERENCES public.ticket_bestellungen(id) ON DELETE CASCADE,
  methode        text NOT NULL DEFAULT 'bar' CHECK (methode IN ('bar')),
  betrag         numeric(8,2) NOT NULL CHECK (betrag >= 0),
  angenommen_von uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  zeitpunkt      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ticket_zahlungen_bestellung_idx ON public.ticket_zahlungen (bestellung_id);

CREATE TABLE IF NOT EXISTS public.ticket_erstattungen (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zahlung_id    uuid NOT NULL REFERENCES public.ticket_zahlungen(id) ON DELETE CASCADE,
  betrag        numeric(8,2) NOT NULL CHECK (betrag > 0),
  erstattet_von uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  zeitpunkt     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ticket_erstattungen_zahlung_idx ON public.ticket_erstattungen (zahlung_id);

CREATE TABLE IF NOT EXISTS public.ticket_scans (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  ticket_id    uuid REFERENCES public.tickets(id) ON DELETE CASCADE,   -- null: unbekannter Code
  gescannt_von uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  zeitpunkt    timestamptz NOT NULL DEFAULT now(),
  ergebnis     text NOT NULL CHECK (ergebnis IN ('ok', 'schon_eingeloest', 'storniert', 'falsche_veranstaltung', 'unbekannt'))
);
CREATE INDEX IF NOT EXISTS ticket_scans_event_idx ON public.ticket_scans (event_id, zeitpunkt);

-- ── Helfer ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.ist_admin_von_event(p_event_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $function$
  SELECT COALESCE((SELECT public.ist_admin_von_schule(e.schule_id) FROM public.events e WHERE e.id = p_event_id), false);
$function$;

-- Freigaben nur für aktive Mitglieder der Schule; nur Admins der Schule erfahren das Ergebnis
CREATE OR REPLACE FUNCTION public.darf_ticket_freigabe(p_event_id uuid, p_profil_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $function$
  SELECT public.ist_admin_von_event(p_event_id) AND EXISTS (
    SELECT 1 FROM public.events e
    JOIN public.schul_mitgliedschaften m ON m.schule_id = e.schule_id
    WHERE e.id = p_event_id AND m.user_id = p_profil_id AND m.aktiv);
$function$;

CREATE OR REPLACE FUNCTION public.ist_ticket_kaeufer(p_bestellung_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.ticket_bestellungen b WHERE b.id = p_bestellung_id AND b.kaeufer_id = auth.uid());
$function$;

CREATE OR REPLACE FUNCTION public.ist_admin_von_bestellung(p_bestellung_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $function$
  SELECT COALESCE((SELECT public.ist_admin_von_schule(b.schule_id) FROM public.ticket_bestellungen b WHERE b.id = p_bestellung_id), false);
$function$;

-- Hat die Veranstaltung Bestellungen? (Löschsperre; auch für Lehrkräfte, die eigene Events löschen)
CREATE OR REPLACE FUNCTION public.event_hat_tickets(p_event_id uuid)
 RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.events e WHERE e.id = p_event_id
      AND (public.ist_admin_von_schule(e.schule_id)
           OR (e.schule_id = public.meine_schule_id() AND e.erstellt_von = auth.uid()))) THEN
    RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501';
  END IF;
  RETURN EXISTS (SELECT 1 FROM public.ticket_bestellungen b WHERE b.event_id = p_event_id);
END;
$function$;

-- Kapazität nicht unter die belegten Plätze senken, Zeitstempel führen
CREATE OR REPLACE FUNCTION public.ticket_einstellungen_pruefen()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_belegt integer;
BEGIN
  NEW.aktualisiert_am := now();
  IF TG_OP = 'UPDATE' AND NEW.event_id <> OLD.event_id THEN
    RAISE EXCEPTION 'Veranstaltung kann nicht geändert werden' USING ERRCODE = '22023';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.kapazitaet < OLD.kapazitaet THEN
    SELECT count(*) INTO v_belegt
    FROM public.tickets t JOIN public.ticket_bestellungen b ON b.id = t.bestellung_id
    WHERE t.event_id = NEW.event_id
      AND (t.status IN ('gueltig', 'eingeloest') OR (t.status = 'reserviert' AND b.frist > now()));
    IF NEW.kapazitaet < v_belegt THEN
      RAISE EXCEPTION 'ticket_kapazitaet_belegt:%', v_belegt USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS ticket_einstellungen_pruefen ON public.ticket_einstellungen;
CREATE TRIGGER ticket_einstellungen_pruefen BEFORE INSERT OR UPDATE ON public.ticket_einstellungen
  FOR EACH ROW EXECUTE FUNCTION public.ticket_einstellungen_pruefen();

-- ── RLS ────────────────────────────────────────────────────────────────────────

ALTER TABLE public.ticket_einstellungen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_freigaben     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_bestellungen  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_zahlungen     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_erstattungen  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_scans         ENABLE ROW LEVEL SECURITY;

-- Einstellungen: lesen, wer die Veranstaltung sieht (die events-Policies gelten in der Unterabfrage mit)
DROP POLICY IF EXISTS "tke: lesen" ON public.ticket_einstellungen;
CREATE POLICY "tke: lesen" ON public.ticket_einstellungen FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id));
DROP POLICY IF EXISTS "tke: anlegen" ON public.ticket_einstellungen;
CREATE POLICY "tke: anlegen" ON public.ticket_einstellungen FOR INSERT TO authenticated
  WITH CHECK (public.ist_admin_von_event(event_id));
DROP POLICY IF EXISTS "tke: aendern" ON public.ticket_einstellungen;
CREATE POLICY "tke: aendern" ON public.ticket_einstellungen FOR UPDATE TO authenticated
  USING (public.ist_admin_von_event(event_id)) WITH CHECK (public.ist_admin_von_event(event_id));

DROP POLICY IF EXISTS "tkf: lesen" ON public.ticket_freigaben;
CREATE POLICY "tkf: lesen" ON public.ticket_freigaben FOR SELECT TO authenticated
  USING (profil_id = auth.uid() OR public.ist_admin_von_event(event_id));
DROP POLICY IF EXISTS "tkf: anlegen" ON public.ticket_freigaben;
CREATE POLICY "tkf: anlegen" ON public.ticket_freigaben FOR INSERT TO authenticated
  WITH CHECK (public.darf_ticket_freigabe(event_id, profil_id));
DROP POLICY IF EXISTS "tkf: aendern" ON public.ticket_freigaben;
CREATE POLICY "tkf: aendern" ON public.ticket_freigaben FOR UPDATE TO authenticated
  USING (public.ist_admin_von_event(event_id)) WITH CHECK (public.darf_ticket_freigabe(event_id, profil_id));
DROP POLICY IF EXISTS "tkf: loeschen" ON public.ticket_freigaben;
CREATE POLICY "tkf: loeschen" ON public.ticket_freigaben FOR DELETE TO authenticated
  USING (public.ist_admin_von_event(event_id));

DROP POLICY IF EXISTS "tkb: lesen" ON public.ticket_bestellungen;
CREATE POLICY "tkb: lesen" ON public.ticket_bestellungen FOR SELECT TO authenticated
  USING (kaeufer_id = auth.uid() OR public.ist_admin_von_schule(schule_id));

DROP POLICY IF EXISTS "tkt: lesen" ON public.tickets;
CREATE POLICY "tkt: lesen" ON public.tickets FOR SELECT TO authenticated
  USING (public.ist_ticket_kaeufer(bestellung_id) OR public.ist_admin_von_bestellung(bestellung_id));

DROP POLICY IF EXISTS "tkz: lesen" ON public.ticket_zahlungen;
CREATE POLICY "tkz: lesen" ON public.ticket_zahlungen FOR SELECT TO authenticated
  USING (public.ist_ticket_kaeufer(bestellung_id) OR public.ist_admin_von_bestellung(bestellung_id));

DROP POLICY IF EXISTS "tkr: lesen" ON public.ticket_erstattungen;
CREATE POLICY "tkr: lesen" ON public.ticket_erstattungen FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ticket_zahlungen z WHERE z.id = zahlung_id));

DROP POLICY IF EXISTS "tks: lesen" ON public.ticket_scans;
CREATE POLICY "tks: lesen" ON public.ticket_scans FOR SELECT TO authenticated
  USING (public.ist_admin_von_event(event_id));

-- ── Demo-Schulen löschen: Bestellungen vor den Events entfernen (sonst unverändert, Stand 20261027000000) ──

CREATE OR REPLACE FUNCTION public.demo_schule_loeschen(p_schule_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF NOT public.ist_intern() AND public.meine_rolle() IS DISTINCT FROM 'superadmin' THEN RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501'; END IF;
  UPDATE demo_anfragen SET status = 'archiviert' WHERE schule_id = p_schule_id;

  -- Ticketbestellungen zuerst (Events mit Bestellungen sind sonst nicht löschbar); Tickets und Zahlungen per CASCADE
  DELETE FROM ticket_bestellungen WHERE schule_id = p_schule_id;

  -- Sessions
  DELETE FROM session_reaktionen
    WHERE session_id IN (SELECT id FROM unterricht_sessions WHERE schule_id = p_schule_id);
  DELETE FROM session_teilnehmer
    WHERE session_id IN (SELECT id FROM unterricht_sessions WHERE schule_id = p_schule_id);
  DELETE FROM unterricht_sessions WHERE schule_id = p_schule_id;

  -- Stunden + Anwesenheit
  DELETE FROM anwesenheit
    WHERE stunde_id IN (
      SELECT s.id FROM stunden s
      JOIN unterricht u ON u.id = s.unterricht_id
      WHERE u.schule_id = p_schule_id
    );
  DELETE FROM stunden_lehrer
    WHERE stunde_id IN (
      SELECT s.id FROM stunden s
      JOIN unterricht u ON u.id = s.unterricht_id
      WHERE u.schule_id = p_schule_id
    );
  DELETE FROM stunden
    WHERE unterricht_id IN (SELECT id FROM unterricht WHERE schule_id = p_schule_id);

  -- Unterricht-Verknüpfungen
  DELETE FROM unterricht_stuecke
    WHERE unterricht_id IN (SELECT id FROM unterricht WHERE schule_id = p_schule_id);
  DELETE FROM unterricht_schueler
    WHERE unterricht_id IN (SELECT id FROM unterricht WHERE schule_id = p_schule_id);
  DELETE FROM unterricht_lehrer
    WHERE unterricht_id IN (SELECT id FROM unterricht WHERE schule_id = p_schule_id);
  DELETE FROM unterricht WHERE schule_id = p_schule_id;

  -- Events
  DELETE FROM event_stuecke
    WHERE event_id IN (SELECT id FROM events WHERE schule_id = p_schule_id);
  DELETE FROM event_teilnehmer
    WHERE event_id IN (SELECT id FROM events WHERE schule_id = p_schule_id);
  DELETE FROM events WHERE schule_id = p_schule_id;

  -- Nachrichten
  DELETE FROM nachricht_gelesen
    WHERE nachricht_id IN (SELECT id FROM nachrichten WHERE schule_id = p_schule_id);
  DELETE FROM nachricht_geloescht
    WHERE nachricht_id IN (SELECT id FROM nachrichten WHERE schule_id = p_schule_id);
  DELETE FROM nachrichten WHERE schule_id = p_schule_id;

  -- Repertoire
  DELETE FROM stueck_dateien
    WHERE stueck_id IN (SELECT id FROM stuecke WHERE schule_id = p_schule_id);
  DELETE FROM event_stuecke
    WHERE stueck_id IN (SELECT id FROM stuecke WHERE schule_id = p_schule_id);
  DELETE FROM stuecke WHERE schule_id = p_schule_id;

  -- Räume, Instrumente, Sonstiges
  DELETE FROM raeume        WHERE schule_id = p_schule_id;
  DELETE FROM instrumente   WHERE schule_id = p_schule_id;
  DELETE FROM interessenten WHERE schule_id = p_schule_id;
  DELETE FROM rechnungen    WHERE schule_id = p_schule_id;
  DELETE FROM dateien       WHERE schule_id = p_schule_id;

  -- Nur User löschen die AUSSCHLIESSLICH in dieser Schule sind
  -- UND keine Superadmins sind (Superadmins werden nie automatisch gelöscht).
  PERFORM delete_auth_user(sm.user_id)
    FROM schul_mitgliedschaften sm
    JOIN public.profiles p ON p.id = sm.user_id
    WHERE sm.schule_id = p_schule_id
      AND p.rolle <> 'superadmin'
      AND NOT EXISTS (
        SELECT 1 FROM schul_mitgliedschaften sm2
        WHERE sm2.user_id = sm.user_id
          AND sm2.schule_id <> p_schule_id
          AND sm2.aktiv = true
      );

  DELETE FROM schulen WHERE id = p_schule_id;
END;
$function$;
