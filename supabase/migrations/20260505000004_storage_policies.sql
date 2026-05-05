-- Storage-Policies für alle Buckets außer vorstand-dateien
-- (vorstand-dateien-Policies sind in 20260428000004_vorstand_schema.sql)
-- Diese Policies müssen idempotent sein da sie sonst auch in seed.sql stehen.

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

DO $$ BEGIN
  CREATE POLICY "mitglied_update_mitglied" ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'mitglied-dateien' AND (SELECT rolle FROM public.profiles WHERE id = auth.uid()) = ANY(ARRAY['admin'::public.user_rolle, 'superadmin'::public.user_rolle]));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
