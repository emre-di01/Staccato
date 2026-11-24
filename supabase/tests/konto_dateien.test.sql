-- pgTAP: Dateien gelöschter Konten (supabase test db)
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path TO public, extensions;
SELECT plan(9);

INSERT INTO auth.users (id, aud, role, email, encrypted_password, created_at, updated_at)
SELECT id::uuid, 'authenticated', 'authenticated', 'kd_' || right(id, 1) || '@test.local', '', now(), now()
FROM unnest(ARRAY['9a000000-0000-0000-0000-000000000011', '9a000000-0000-0000-0000-000000000012']) AS id;
INSERT INTO storage.objects (bucket_id, name) VALUES
  ('avatare',          '9a000000-0000-0000-0000-000000000011/a.jpg'),
  ('mitglied-dateien', '9a000000-0000-0000-0000-000000000011/antrag.pdf'),
  ('kurs-dateien',     '9a000000-0000-0000-0000-000000000011/kurs.pdf'),
  ('avatare',          '9a000000-0000-0000-0000-000000000012/a.jpg');

SELECT is((SELECT count(*)::int FROM konto_dateien_offen()), 0, 'ohne Löschung nichts offen');
DELETE FROM auth.users WHERE id = '9a000000-0000-0000-0000-000000000011';
SELECT is((SELECT count(*)::int FROM geloeschte_konten WHERE konto_id = '9a000000-0000-0000-0000-000000000011'), 1, 'Konto vorgemerkt');
SELECT set_eq('SELECT bucket FROM konto_dateien_offen()', ARRAY['avatare', 'mitglied-dateien'], 'nur Konto-Buckets, nie Kursdateien');
SELECT is(konto_dateien_fertig(), 1, 'bleibt offen, solange Dateien da sind');
INSERT INTO geloeschte_konten (konto_id) VALUES ('9a000000-0000-0000-0000-000000000012');
SELECT is((SELECT count(*)::int FROM konto_dateien_offen() WHERE konto = '9a000000-0000-0000-0000-000000000012'), 0, 'bestehendes Konto nie');
SELECT is(konto_dateien_fertig(), 1, 'Vormerkung eines bestehenden Kontos fällt weg');

SELECT set_config('request.jwt.claims', '{"sub":"9a000000-0000-0000-0000-000000000012","role":"authenticated"}', true);
SELECT throws_ok('SELECT * FROM konto_dateien_offen()', '42501', NULL, 'Nutzer: kein Zugriff auf Liste');
SELECT throws_ok('SELECT konto_dateien_fertig()', '42501', NULL, 'Nutzer: kein Zugriff auf Abschluss');
SELECT ok(NOT has_table_privilege('authenticated', 'public.geloeschte_konten', 'SELECT'), 'Nutzer: kein Zugriff auf Tabelle');
SELECT * FROM finish();
ROLLBACK;
