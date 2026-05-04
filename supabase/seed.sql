-- ─── Schule ───────────────────────────────────────────────────
INSERT INTO public.schulen (id, name, sprachen, aktiv)
VALUES ('00000000-0000-0000-0000-000000000001', 'Musikschule', '{de}', true)
ON CONFLICT (id) DO NOTHING;

-- ─── Storage Buckets ──────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public) VALUES
  ('avatare',          'avatare',          true),
  ('stueck-dateien',   'stueck-dateien',   false),
  ('kurs-dateien',     'kurs-dateien',     false),
  ('schueler-dateien', 'schueler-dateien', false),
  ('mitglied-dateien', 'mitglied-dateien', false),
  ('vorstand-dateien', 'vorstand-dateien', false)
ON CONFLICT (id) DO NOTHING;

-- ─── Storage Policies (alle idempotent) ───────────────────────

DO $$ BEGIN
  CREATE POLICY "avatar_upload" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'avatare' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "avatar_lesen" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'avatare');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "avatar_update" ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'avatare' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "avatar_loeschen" ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'avatare' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "admin_loeschen_avatar_admin" ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'avatare' AND (SELECT rolle FROM public.profiles WHERE id = auth.uid()) = ANY(ARRAY['admin'::public.user_rolle, 'superadmin'::public.user_rolle]));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authentifizierte können hochladen" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = ANY(ARRAY['stueck-dateien', 'kurs-dateien', 'schueler-dateien']));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authentifizierte können lesen" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = ANY(ARRAY['stueck-dateien', 'kurs-dateien', 'schueler-dateien']));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authentifizierte können updaten" ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = ANY(ARRAY['stueck-dateien', 'kurs-dateien', 'schueler-dateien']));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authentifizierte können löschen" ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = ANY(ARRAY['stueck-dateien', 'kurs-dateien', 'schueler-dateien']));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "admin_upload" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'mitglied-dateien' AND (SELECT rolle FROM public.profiles WHERE id = auth.uid()) = ANY(ARRAY['admin'::public.user_rolle, 'superadmin'::public.user_rolle]));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "admin_lesen_mitglied" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'mitglied-dateien' AND (SELECT rolle FROM public.profiles WHERE id = auth.uid()) = ANY(ARRAY['admin'::public.user_rolle, 'superadmin'::public.user_rolle]));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "mitglied_liest_eigene_datei" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'mitglied-dateien' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "admin_loeschen_mitglied" ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'mitglied-dateien' AND (SELECT rolle FROM public.profiles WHERE id = auth.uid()) = ANY(ARRAY['admin'::public.user_rolle, 'superadmin'::public.user_rolle]));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── View: mitglieder_mit_email ───────────────────────────────
-- Verbindet profiles mit auth.users für die E-Mail-Anzeige in der Mitgliederverwaltung.
-- security_invoker=false damit auth.users als postgres-User lesbar ist.
CREATE OR REPLACE VIEW public.mitglieder_mit_email
WITH (security_invoker = false)
AS
SELECT
  p.id,
  p.voller_name,
  p.rolle,
  p.schule_id,
  p.sprache,
  p.telefon,
  p.adresse,
  p.geburtsdatum,
  p.aktiv,
  p.notizen,
  p.avatar_url,
  p.aktualisiert_am,
  p.erstellt_am,
  u.email
FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.id;

GRANT SELECT ON public.mitglieder_mit_email TO authenticated;

-- ─── Admin-User ───────────────────────────────────────────────
SELECT public.create_user('emre.dingil01@gmail.com', '123456', 'Emre Dingil', 'superadmin');
