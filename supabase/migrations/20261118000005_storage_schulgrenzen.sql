-- Datei-Buckets an Schulgrenzen binden. Vorher:
--   stueck-dateien, kurs-dateien, schueler-dateien: jeder angemeldete Nutzer jeder
--     Schule durfte lesen, hochladen, überschreiben und LÖSCHEN
--   vorstand-dateien: jedes Vorstandsmitglied/jeder Admin jeder Schule
--   ausgaben-dateien: jeder Admin jeder Schule
--   stueck_dateien (Tabelle): Lehrer jeder Schule durften Einträge ändern
-- Pfad-Konventionen (erster Ordner): stueck-dateien → stueck_id, kurs-dateien → unterricht_id,
-- schueler-dateien → schueler_id, vorstand-dateien / ausgaben-dateien → schule_id.
-- Hilfsfunktionen nehmen Text, weil Storage den Ordnernamen als Text liefert.

-- ─── Hilfsfunktionen ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.stueck_schule(p_stueck text)
 RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ SELECT schule_id FROM public.stuecke WHERE id::text = p_stueck; $function$;

CREATE OR REPLACE FUNCTION public.kurs_schule(p_kurs text)
 RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ SELECT schule_id FROM public.unterricht WHERE id::text = p_kurs; $function$;

-- Kursdateien: Lehrer des Kurses oder Admin der Schule (schreiben),
-- zusätzlich Teilnehmende und deren Eltern (lesen)
CREATE OR REPLACE FUNCTION public.darf_kursdatei(p_kurs text, p_schreiben boolean)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.unterricht_lehrer WHERE unterricht_id::text = p_kurs AND lehrer_id = auth.uid())
      OR (public.kurs_schule(p_kurs) = public.meine_schule_id() AND public.ist_admin_von_schule(public.meine_schule_id()))
      OR (NOT p_schreiben AND EXISTS (
            SELECT 1 FROM public.unterricht_schueler us
            WHERE us.unterricht_id::text = p_kurs
              AND (us.schueler_id = auth.uid() OR public.ist_elternteil_von(us.schueler_id))));
$function$;

-- Schülerdateien: Lehrer des Schülers oder Admin der Schule (schreiben),
-- zusätzlich der Schüler selbst und seine Eltern (lesen)
CREATE OR REPLACE FUNCTION public.darf_schuelerdatei(p_schueler text, p_schreiben boolean)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT public.ist_lehrer_von_mitglied(p_schueler)
      OR public.ist_admin_von_mitglied(p_schueler)
      OR (NOT p_schreiben AND (
            p_schueler = auth.uid()::text
            OR EXISTS (SELECT 1 FROM public.eltern_schueler
                       WHERE eltern_id = auth.uid() AND schueler_id::text = p_schueler)));
$function$;

-- ─── stueck-dateien ───────────────────────────────────────────
-- kurs-dateien/schueler-dateien teilten sich diese Policies mit stueck-dateien
DROP POLICY IF EXISTS "Authentifizierte können hochladen" ON storage.objects;
DROP POLICY IF EXISTS "Authentifizierte können lesen"     ON storage.objects;
DROP POLICY IF EXISTS "Authentifizierte können updaten"   ON storage.objects;
DROP POLICY IF EXISTS "Authentifizierte können löschen"   ON storage.objects;

DO $$ BEGIN
  CREATE POLICY "stueck-dateien: lesen" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'stueck-dateien' AND public.stueck_schule((storage.foldername(name))[1]) = public.meine_schule_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "stueck-dateien: hochladen" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'stueck-dateien' AND public.ist_lehrkraft_von_schule(public.stueck_schule((storage.foldername(name))[1])));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "stueck-dateien: aendern" ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'stueck-dateien' AND public.ist_lehrkraft_von_schule(public.stueck_schule((storage.foldername(name))[1])));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "stueck-dateien: loeschen" ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'stueck-dateien' AND public.ist_lehrkraft_von_schule(public.stueck_schule((storage.foldername(name))[1])));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── kurs-dateien ─────────────────────────────────────────────
DO $$ BEGIN
  CREATE POLICY "kurs-dateien: lesen" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'kurs-dateien' AND public.darf_kursdatei((storage.foldername(name))[1], false));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "kurs-dateien: hochladen" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'kurs-dateien' AND public.darf_kursdatei((storage.foldername(name))[1], true));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "kurs-dateien: aendern" ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'kurs-dateien' AND public.darf_kursdatei((storage.foldername(name))[1], true));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "kurs-dateien: loeschen" ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'kurs-dateien' AND public.darf_kursdatei((storage.foldername(name))[1], true));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── schueler-dateien ─────────────────────────────────────────
DO $$ BEGIN
  CREATE POLICY "schueler-dateien: lesen" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'schueler-dateien' AND public.darf_schuelerdatei((storage.foldername(name))[1], false));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "schueler-dateien: hochladen" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'schueler-dateien' AND public.darf_schuelerdatei((storage.foldername(name))[1], true));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "schueler-dateien: aendern" ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'schueler-dateien' AND public.darf_schuelerdatei((storage.foldername(name))[1], true));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "schueler-dateien: loeschen" ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'schueler-dateien' AND public.darf_schuelerdatei((storage.foldername(name))[1], true));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── vorstand-dateien ─────────────────────────────────────────
DROP POLICY IF EXISTS vorstand_dateien_insert ON storage.objects;
DROP POLICY IF EXISTS vorstand_dateien_select ON storage.objects;
DROP POLICY IF EXISTS vorstand_dateien_delete ON storage.objects;

CREATE OR REPLACE FUNCTION public.darf_vorstandsdatei(p_schule text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT public.meine_rolle() = 'superadmin'
      OR (public.meine_rolle() IN ('vorstand', 'admin') AND p_schule = public.meine_schule_id()::text);
$function$;

DO $$ BEGIN
  CREATE POLICY "vorstand-dateien: lesen" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'vorstand-dateien' AND public.darf_vorstandsdatei((storage.foldername(name))[1]));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "vorstand-dateien: hochladen" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'vorstand-dateien' AND public.darf_vorstandsdatei((storage.foldername(name))[1]));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "vorstand-dateien: loeschen" ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'vorstand-dateien' AND public.darf_vorstandsdatei((storage.foldername(name))[1]));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── ausgaben-dateien (derzeit ungenutzt) ─────────────────────
DROP POLICY IF EXISTS "ausgaben-dateien: admin upload"   ON storage.objects;
DROP POLICY IF EXISTS "ausgaben-dateien: admin lesen"    ON storage.objects;
DROP POLICY IF EXISTS "ausgaben-dateien: admin loeschen" ON storage.objects;

DO $$ BEGIN
  CREATE POLICY "ausgaben-dateien: admin lesen" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'ausgaben-dateien' AND public.ist_admin_von_schule(public.meine_schule_id())
           AND (storage.foldername(name))[1] = public.meine_schule_id()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "ausgaben-dateien: admin upload" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'ausgaben-dateien' AND public.ist_admin_von_schule(public.meine_schule_id())
                AND (storage.foldername(name))[1] = public.meine_schule_id()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "ausgaben-dateien: admin loeschen" ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'ausgaben-dateien' AND public.ist_admin_von_schule(public.meine_schule_id())
           AND (storage.foldername(name))[1] = public.meine_schule_id()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── stueck_dateien (Tabelle) ─────────────────────────────────
DROP POLICY IF EXISTS "sdf: admin+lehrer" ON public.stueck_dateien;
DROP POLICY IF EXISTS "sdf: lesen"        ON public.stueck_dateien;
DO $$ BEGIN
  CREATE POLICY "sdf: lehrkraft der schule" ON public.stueck_dateien FOR ALL
    USING (public.ist_lehrkraft_von_schule(public.stueck_schule(stueck_id::text)))
    WITH CHECK (public.ist_lehrkraft_von_schule(public.stueck_schule(stueck_id::text)));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "sdf: lesen" ON public.stueck_dateien FOR SELECT
    USING (auth.uid() IS NOT NULL AND public.stueck_schule(stueck_id::text) = public.meine_schule_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
