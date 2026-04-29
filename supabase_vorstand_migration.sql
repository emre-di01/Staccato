-- ─── Vorstandsmodul Migration ────────────────────────────────────────────────
-- Ausführen via:
--   docker exec -i supabase_db_staccato psql -U postgres -d postgres \
--     < supabase_vorstand_migration.sql

-- ── Neue Enum-Werte ───────────────────────────────────────────────────────────
ALTER TYPE public.user_rolle ADD VALUE IF NOT EXISTS 'vorstand';
ALTER TYPE public.event_typ  ADD VALUE IF NOT EXISTS 'vorstandssitzung';

-- ── Hilfsfunktion (verhindert rekursiven RLS-Loop) ────────────────────────────
CREATE OR REPLACE FUNCTION public.meine_schule_id()
  RETURNS uuid
  LANGUAGE sql
  STABLE SECURITY DEFINER
AS $$
  SELECT schule_id FROM public.profiles WHERE id = auth.uid();
$$;

-- ── Tabelle: Ziele ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vorstand_ziele (
  id                   uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  schule_id            uuid        NOT NULL REFERENCES public.schulen(id) ON DELETE CASCADE,
  titel                text        NOT NULL,
  beschreibung         text,
  zeitraum_typ         text        DEFAULT 'jahr'
                                   CHECK (zeitraum_typ = ANY (ARRAY['jahr', 'quartal'])),
  zeitraum_wert        text,
  verantwortlicher_id  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  status               text        DEFAULT 'offen'
                                   CHECK (status = ANY (ARRAY['offen', 'in_bearbeitung', 'erledigt'])),
  erstellt_von         uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  erstellt_am          timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vorstand_ziele_schule_idx ON public.vorstand_ziele (schule_id);

-- ── Tabelle: Aufgaben ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vorstand_aufgaben (
  id                   uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  schule_id            uuid        NOT NULL REFERENCES public.schulen(id) ON DELETE CASCADE,
  ziel_id              uuid        REFERENCES public.vorstand_ziele(id) ON DELETE SET NULL,
  titel                text        NOT NULL,
  beschreibung         text,
  verantwortlicher_id  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  faellig_am           date,
  status               text        DEFAULT 'offen'
                                   CHECK (status = ANY (ARRAY['offen', 'in_bearbeitung', 'erledigt'])),
  erstellt_von         uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  erstellt_am          timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vorstand_aufgaben_schule_idx ON public.vorstand_aufgaben (schule_id);
CREATE INDEX IF NOT EXISTS vorstand_aufgaben_ziel_idx   ON public.vorstand_aufgaben (ziel_id);

-- ── Tabelle: Protokolle ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vorstand_protokolle (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  schule_id       uuid        NOT NULL REFERENCES public.schulen(id) ON DELETE CASCADE,
  titel           text        NOT NULL,
  sitzungstyp     text        DEFAULT 'vorstandssitzung'
                              CHECK (sitzungstyp = ANY (ARRAY['vorstandssitzung', 'mitgliederversammlung', 'sonstiges'])),
  datum           date        NOT NULL,
  teilnehmer_ids  uuid[]      DEFAULT '{}',
  beschluesse     text,
  inhalt          text,
  event_id        uuid        REFERENCES public.events(id) ON DELETE SET NULL,
  erstellt_von    uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  erstellt_am     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vorstand_protokolle_schule_idx ON public.vorstand_protokolle (schule_id);
CREATE INDEX IF NOT EXISTS vorstand_protokolle_datum_idx  ON public.vorstand_protokolle (datum DESC);
CREATE INDEX IF NOT EXISTS vorstand_protokolle_event_idx  ON public.vorstand_protokolle (event_id);

-- ── Tabelle: Protokoll-Dateianhänge ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vorstand_protokoll_dateien (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  protokoll_id  uuid        NOT NULL REFERENCES public.vorstand_protokolle(id) ON DELETE CASCADE,
  schule_id     uuid        NOT NULL REFERENCES public.schulen(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  bucket_pfad   text        NOT NULL,
  erstellt_von  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  erstellt_am   timestamptz DEFAULT now()
);

-- ── RLS aktivieren ────────────────────────────────────────────────────────────
ALTER TABLE public.vorstand_ziele              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vorstand_aufgaben           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vorstand_protokolle         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vorstand_protokoll_dateien  ENABLE ROW LEVEL SECURITY;

-- ── RLS Policies ──────────────────────────────────────────────────────────────
CREATE POLICY "vorstand_ziele_zugriff" ON public.vorstand_ziele
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND rolle = ANY (ARRAY['vorstand'::public.user_rolle, 'admin'::public.user_rolle, 'superadmin'::public.user_rolle])
      AND schule_id = vorstand_ziele.schule_id
  ));

CREATE POLICY "vorstand_aufgaben_zugriff" ON public.vorstand_aufgaben
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND rolle = ANY (ARRAY['vorstand'::public.user_rolle, 'admin'::public.user_rolle, 'superadmin'::public.user_rolle])
      AND schule_id = vorstand_aufgaben.schule_id
  ));

CREATE POLICY "vorstand_protokolle_zugriff" ON public.vorstand_protokolle
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND rolle = ANY (ARRAY['vorstand'::public.user_rolle, 'admin'::public.user_rolle, 'superadmin'::public.user_rolle])
      AND schule_id = vorstand_protokolle.schule_id
  ));

CREATE POLICY "vorstand_protokoll_dateien_zugriff" ON public.vorstand_protokoll_dateien
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND rolle = ANY (ARRAY['vorstand'::public.user_rolle, 'admin'::public.user_rolle, 'superadmin'::public.user_rolle])
      AND schule_id = vorstand_protokoll_dateien.schule_id
  ));

-- ── profiles: lesen — Vorstand-User sehen alle Vorstand/Admin-Profile der Schule
DROP POLICY IF EXISTS "profiles: lesen" ON public.profiles;
CREATE POLICY "profiles: lesen" ON public.profiles FOR SELECT USING (
  id = auth.uid()
  OR public.meine_rolle() = ANY (ARRAY['admin'::public.user_rolle, 'superadmin'::public.user_rolle])
  OR public.ist_lehrer_von_schueler(id)
  OR public.ist_elternteil_von(id)
  OR EXISTS (SELECT 1 FROM public.unterricht_lehrer ul WHERE ul.lehrer_id = profiles.id)
  OR (
    public.meine_rolle() = 'vorstand'::public.user_rolle
    AND public.meine_schule_id() = schule_id
    AND rolle = ANY (ARRAY['vorstand'::public.user_rolle, 'admin'::public.user_rolle, 'superadmin'::public.user_rolle])
  )
);

-- ── events: lesen — Vorstand sieht alle Events der eigenen Schule ─────────────
DROP POLICY IF EXISTS "evt: lesen" ON public.events;
CREATE POLICY "evt: lesen" ON public.events FOR SELECT USING (
  oeffentlich = true
  OR public.meine_rolle() = ANY (ARRAY['admin'::public.user_rolle, 'superadmin'::public.user_rolle, 'lehrer'::public.user_rolle])
  OR EXISTS (
    SELECT 1 FROM public.event_teilnehmer
    WHERE event_teilnehmer.event_id = events.id
      AND event_teilnehmer.profil_id = auth.uid()
  )
  OR (public.meine_rolle() = 'vorstand'::public.user_rolle AND public.meine_schule_id() = schule_id)
);

-- ── Storage Bucket ────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('vorstand-dateien', 'vorstand-dateien', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "vorstand_dateien_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vorstand-dateien' AND (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid()
    AND rolle = ANY(ARRAY['vorstand'::public.user_rolle, 'admin'::public.user_rolle, 'superadmin'::public.user_rolle])
  )));

CREATE POLICY "vorstand_dateien_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'vorstand-dateien' AND (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid()
    AND rolle = ANY(ARRAY['vorstand'::public.user_rolle, 'admin'::public.user_rolle, 'superadmin'::public.user_rolle])
  )));

CREATE POLICY "vorstand_dateien_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'vorstand-dateien' AND (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid()
    AND rolle = ANY(ARRAY['vorstand'::public.user_rolle, 'admin'::public.user_rolle, 'superadmin'::public.user_rolle])
  )));

-- ── Grants ────────────────────────────────────────────────────────────────────
GRANT ALL ON TABLE public.vorstand_ziele             TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.vorstand_aufgaben          TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.vorstand_protokolle        TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.vorstand_protokoll_dateien TO anon, authenticated, service_role;
