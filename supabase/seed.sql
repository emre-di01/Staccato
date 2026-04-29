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

-- ─── Storage Policies: avatare ────────────────────────────────
CREATE POLICY "avatar_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatare' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatar_lesen" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatare');

CREATE POLICY "avatar_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatare' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatar_loeschen" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatare' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "admin_loeschen_avatar_admin" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatare' AND (SELECT rolle FROM public.profiles WHERE id = auth.uid()) = ANY(ARRAY['admin'::public.user_rolle, 'superadmin'::public.user_rolle]));

-- ─── Storage Policies: stueck/kurs/schueler-dateien ──────────
CREATE POLICY "Authentifizierte können hochladen" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = ANY(ARRAY['stueck-dateien', 'kurs-dateien', 'schueler-dateien']));

CREATE POLICY "Authentifizierte können lesen" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = ANY(ARRAY['stueck-dateien', 'kurs-dateien', 'schueler-dateien']));

CREATE POLICY "Authentifizierte können updaten" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = ANY(ARRAY['stueck-dateien', 'kurs-dateien', 'schueler-dateien']));

CREATE POLICY "Authentifizierte können löschen" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = ANY(ARRAY['stueck-dateien', 'kurs-dateien', 'schueler-dateien']));

-- ─── Storage Policies: mitglied-dateien ──────────────────────
CREATE POLICY "admin_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'mitglied-dateien' AND (SELECT rolle FROM public.profiles WHERE id = auth.uid()) = ANY(ARRAY['admin'::public.user_rolle, 'superadmin'::public.user_rolle]));

CREATE POLICY "admin_lesen_mitglied" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'mitglied-dateien' AND (SELECT rolle FROM public.profiles WHERE id = auth.uid()) = ANY(ARRAY['admin'::public.user_rolle, 'superadmin'::public.user_rolle]));

CREATE POLICY "mitglied_liest_eigene_datei" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'mitglied-dateien' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "admin_loeschen_mitglied" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'mitglied-dateien' AND (SELECT rolle FROM public.profiles WHERE id = auth.uid()) = ANY(ARRAY['admin'::public.user_rolle, 'superadmin'::public.user_rolle]));

-- ─── Storage Policies: vorstand-dateien ──────────────────────
CREATE POLICY "vorstand_dateien_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vorstand-dateien' AND (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
    AND rolle = ANY(ARRAY['vorstand'::public.user_rolle, 'admin'::public.user_rolle, 'superadmin'::public.user_rolle])
  )));

CREATE POLICY "vorstand_dateien_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'vorstand-dateien' AND (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
    AND rolle = ANY(ARRAY['vorstand'::public.user_rolle, 'admin'::public.user_rolle, 'superadmin'::public.user_rolle])
  )));

CREATE POLICY "vorstand_dateien_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'vorstand-dateien' AND (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
    AND rolle = ANY(ARRAY['vorstand'::public.user_rolle, 'admin'::public.user_rolle, 'superadmin'::public.user_rolle])
  )));

-- ─── Admin User ───────────────────────────────────────────────
SELECT public.create_user('emre.dingil01@gmail.com', 'Musik123!', 'Emre Dingil', 'admin');
