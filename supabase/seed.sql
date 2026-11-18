-- ─── Schule ───────────────────────────────────────────────────
INSERT INTO public.schulen (id, name, sprachen, aktiv, zeitzone)
VALUES ('00000000-0000-0000-0000-000000000001', 'Musikschule', '{de}', true, 'Europe/Berlin')
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

-- stueck-dateien, kurs-dateien, schueler-dateien: Policies schulgebunden in Migration
-- 20261118000005 (vorher hier: jeder angemeldete Nutzer durfte alles)

-- mitglied-dateien: nur Admins der eigenen Schule bzw. Lehrer des Mitglieds
-- (Funktionen aus Migration 20261118000004)
DO $$ BEGIN
  CREATE POLICY "md-storage: admin lesen" ON storage.objects FOR SELECT
    USING (bucket_id = 'mitglied-dateien' AND public.ist_admin_von_mitglied((storage.foldername(name))[1]));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "md-storage: hochladen" ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'mitglied-dateien' AND (
      public.ist_admin_von_mitglied((storage.foldername(name))[1])
      OR public.ist_lehrer_von_mitglied((storage.foldername(name))[1])));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "mitglied_liest_eigene_datei" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'mitglied-dateien' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "md-storage: admin aendern" ON storage.objects FOR UPDATE
    USING (bucket_id = 'mitglied-dateien' AND public.ist_admin_von_mitglied((storage.foldername(name))[1]));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "md-storage: admin loeschen" ON storage.objects FOR DELETE
    USING (bucket_id = 'mitglied-dateien' AND public.ist_admin_von_mitglied((storage.foldername(name))[1]));
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
  p.kann_kurse_anlegen,
  p.iban,
  p.bic,
  p.kontoinhaber,
  p.zahlungsweise,
  p.zahlungsrhythmus,
  p.mitgliedsbeitrag,
  p.erziehungsberechtigter_name,
  p.erziehungsberechtigter_telefon,
  p.erziehungsberechtigter_email,
  p.aktualisiert_am,
  p.erstellt_am,
  u.email
FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.id
WHERE p.schule_id = public.meine_schule_id()
  AND (
    p.id = auth.uid()
    OR public.meine_rolle() IN ('admin', 'superadmin')
    OR public.ist_lehrer_von_schueler(p.id)
  );

GRANT SELECT ON public.mitglieder_mit_email TO authenticated;

-- ─── Realtime Broadcast Policies ──────────────────────────────
-- Supabase Realtime v2 "Broadcast via database" requires INSERT/SELECT
-- on realtime.messages — without these policies (RLS is enabled)
-- channel subscriptions get CHANNEL_ERROR and broadcasts are silently dropped.
DO $$ BEGIN
  CREATE POLICY "authenticated can insert" ON realtime.messages
    FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated can select" ON realtime.messages
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon can insert" ON realtime.messages
    FOR INSERT TO anon WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon can select" ON realtime.messages
    FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
