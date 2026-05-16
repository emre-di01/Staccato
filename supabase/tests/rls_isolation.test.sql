-- pgTAP RLS-Tests: Cross-School-Isolation und Rollen-Zugriff
-- Führe aus mit: supabase test db

BEGIN;
SELECT plan(25);

-- ─── Fixture: Fixtures sauber einfügen ─────────────────────────────────────
-- Konstanten als Variablen in Temp-Tabelle, damit die UUIDs konsistent bleiben

CREATE TEMP TABLE _t (k text PRIMARY KEY, v uuid);
INSERT INTO _t VALUES
  ('schule_a',  '11111111-1111-1111-1111-111111111111'),
  ('schule_b',  '22222222-2222-2222-2222-222222222222'),
  ('admin_a',   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('admin_b',   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  ('lehrer_a',  'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  ('schuel_a',  'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  ('vorst_a',   'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  ('sadmin',    'ffffffff-ffff-ffff-ffff-ffffffffffff'),
  ('kurs_a',    '10000000-0000-0000-0000-000000000001'),
  ('kurs_b',    '20000000-0000-0000-0000-000000000001'),
  ('event_a',   '10000000-0000-0000-0000-000000000002'),
  ('event_b',   '20000000-0000-0000-0000-000000000002'),
  ('raum_a',    '10000000-0000-0000-0000-000000000003'),
  ('raum_b',    '20000000-0000-0000-0000-000000000003');

-- Schulen
INSERT INTO schulen (id, name, aktiv)
  SELECT v, 'Test-Schule A', true FROM _t WHERE k = 'schule_a'
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
INSERT INTO schulen (id, name, aktiv)
  SELECT v, 'Test-Schule B', true FROM _t WHERE k = 'schule_b'
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Auth-User (brauchen mehr Felder als nur id+email+role)
INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  SELECT v, 'authenticated', 'authenticated', 'rls_admin_a@test.local', '', NOW(), NOW(), NOW() FROM _t WHERE k = 'admin_a'
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  SELECT v, 'authenticated', 'authenticated', 'rls_admin_b@test.local', '', NOW(), NOW(), NOW() FROM _t WHERE k = 'admin_b'
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  SELECT v, 'authenticated', 'authenticated', 'rls_lehrer_a@test.local', '', NOW(), NOW(), NOW() FROM _t WHERE k = 'lehrer_a'
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  SELECT v, 'authenticated', 'authenticated', 'rls_schuel_a@test.local', '', NOW(), NOW(), NOW() FROM _t WHERE k = 'schuel_a'
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  SELECT v, 'authenticated', 'authenticated', 'rls_vorst_a@test.local', '', NOW(), NOW(), NOW() FROM _t WHERE k = 'vorst_a'
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  SELECT v, 'authenticated', 'authenticated', 'rls_sadmin@test.local', '', NOW(), NOW(), NOW() FROM _t WHERE k = 'sadmin'
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

-- Profile (DO UPDATE damit stale Daten aus abgebrochenen Läufen überschrieben werden)
INSERT INTO profiles (id, voller_name, rolle, schule_id, letzte_schule_id)
  SELECT (SELECT v FROM _t WHERE k='admin_a'),  'Admin A',    'admin',      (SELECT v FROM _t WHERE k='schule_a'), (SELECT v FROM _t WHERE k='schule_a')
  ON CONFLICT (id) DO UPDATE SET rolle = 'admin', schule_id = EXCLUDED.schule_id, letzte_schule_id = EXCLUDED.letzte_schule_id;
INSERT INTO profiles (id, voller_name, rolle, schule_id, letzte_schule_id)
  SELECT (SELECT v FROM _t WHERE k='admin_b'),  'Admin B',    'admin',      (SELECT v FROM _t WHERE k='schule_b'), (SELECT v FROM _t WHERE k='schule_b')
  ON CONFLICT (id) DO UPDATE SET rolle = 'admin', schule_id = EXCLUDED.schule_id, letzte_schule_id = EXCLUDED.letzte_schule_id;
INSERT INTO profiles (id, voller_name, rolle, schule_id, letzte_schule_id)
  SELECT (SELECT v FROM _t WHERE k='lehrer_a'), 'Lehrer A',   'lehrer',     (SELECT v FROM _t WHERE k='schule_a'), (SELECT v FROM _t WHERE k='schule_a')
  ON CONFLICT (id) DO UPDATE SET rolle = 'lehrer', schule_id = EXCLUDED.schule_id, letzte_schule_id = EXCLUDED.letzte_schule_id;
INSERT INTO profiles (id, voller_name, rolle, schule_id, letzte_schule_id)
  SELECT (SELECT v FROM _t WHERE k='schuel_a'), 'Schüler A',  'schueler',   (SELECT v FROM _t WHERE k='schule_a'), (SELECT v FROM _t WHERE k='schule_a')
  ON CONFLICT (id) DO UPDATE SET rolle = 'schueler', schule_id = EXCLUDED.schule_id, letzte_schule_id = EXCLUDED.letzte_schule_id;
INSERT INTO profiles (id, voller_name, rolle, schule_id, letzte_schule_id)
  SELECT (SELECT v FROM _t WHERE k='vorst_a'),  'Vorstand A', 'vorstand',   (SELECT v FROM _t WHERE k='schule_a'), (SELECT v FROM _t WHERE k='schule_a')
  ON CONFLICT (id) DO UPDATE SET rolle = 'vorstand', schule_id = EXCLUDED.schule_id, letzte_schule_id = EXCLUDED.letzte_schule_id;
INSERT INTO profiles (id, voller_name, rolle, schule_id, letzte_schule_id)
  SELECT (SELECT v FROM _t WHERE k='sadmin'),   'Superadmin', 'superadmin', (SELECT v FROM _t WHERE k='schule_a'), (SELECT v FROM _t WHERE k='schule_a')
  ON CONFLICT (id) DO UPDATE SET rolle = 'superadmin', schule_id = EXCLUDED.schule_id, letzte_schule_id = EXCLUDED.letzte_schule_id;

-- Kurse
INSERT INTO unterricht (id, schule_id, name, typ, wochentag, uhrzeit_von, uhrzeit_bis)
  SELECT (SELECT v FROM _t WHERE k='kurs_a'), (SELECT v FROM _t WHERE k='schule_a'), 'Kurs A', 'einzel', 'mo', '10:00', '11:00'
  ON CONFLICT (id) DO UPDATE SET schule_id = EXCLUDED.schule_id;
INSERT INTO unterricht (id, schule_id, name, typ, wochentag, uhrzeit_von, uhrzeit_bis)
  SELECT (SELECT v FROM _t WHERE k='kurs_b'), (SELECT v FROM _t WHERE k='schule_b'), 'Kurs B', 'einzel', 'di', '10:00', '11:00'
  ON CONFLICT (id) DO UPDATE SET schule_id = EXCLUDED.schule_id;

-- Lehrer + Schüler zu Kurs A
INSERT INTO unterricht_lehrer (lehrer_id, unterricht_id)
  SELECT (SELECT v FROM _t WHERE k='lehrer_a'), (SELECT v FROM _t WHERE k='kurs_a')
  ON CONFLICT DO NOTHING;
INSERT INTO unterricht_schueler (schueler_id, unterricht_id)
  SELECT (SELECT v FROM _t WHERE k='schuel_a'), (SELECT v FROM _t WHERE k='kurs_a')
  ON CONFLICT DO NOTHING;

-- Events
INSERT INTO events (id, schule_id, titel, typ, beginn)
  SELECT (SELECT v FROM _t WHERE k='event_a'), (SELECT v FROM _t WHERE k='schule_a'), 'Event A', 'konzert', NOW()
  ON CONFLICT (id) DO UPDATE SET schule_id = EXCLUDED.schule_id;
INSERT INTO events (id, schule_id, titel, typ, beginn)
  SELECT (SELECT v FROM _t WHERE k='event_b'), (SELECT v FROM _t WHERE k='schule_b'), 'Event B', 'konzert', NOW()
  ON CONFLICT (id) DO UPDATE SET schule_id = EXCLUDED.schule_id;

-- Lehrer A als Teilnehmer bei Event A (RLS: lehrer sieht nur eigene/teilgenommene Events)
INSERT INTO event_teilnehmer (event_id, profil_id)
  SELECT (SELECT v FROM _t WHERE k='event_a'), (SELECT v FROM _t WHERE k='lehrer_a')
  ON CONFLICT DO NOTHING;

-- Räume
INSERT INTO raeume (id, schule_id, name)
  SELECT (SELECT v FROM _t WHERE k='raum_a'), (SELECT v FROM _t WHERE k='schule_a'), 'Raum A'
  ON CONFLICT (id) DO UPDATE SET schule_id = EXCLUDED.schule_id;
INSERT INTO raeume (id, schule_id, name)
  SELECT (SELECT v FROM _t WHERE k='raum_b'), (SELECT v FROM _t WHERE k='schule_b'), 'Raum B'
  ON CONFLICT (id) DO UPDATE SET schule_id = EXCLUDED.schule_id;

-- ─── 1. Admin A — nur Schule A ──────────────────────────────────────────────

SET LOCAL role = authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);

SELECT results_eq(
  $$ SELECT COUNT(*)::int FROM unterricht $$,
  ARRAY[1],
  'Admin A sieht nur 1 Kurs (Schule A)'
);

SELECT results_eq(
  $$ SELECT COUNT(*)::int FROM unterricht WHERE schule_id = '22222222-2222-2222-2222-222222222222'::uuid $$,
  ARRAY[0],
  'Admin A sieht keinen Kurs von Schule B'
);

SELECT results_eq(
  $$ SELECT COUNT(*)::int FROM events $$,
  ARRAY[1],
  'Admin A sieht nur 1 Event (Schule A)'
);

SELECT results_eq(
  $$ SELECT COUNT(*)::int FROM raeume $$,
  ARRAY[1],
  'Admin A sieht nur 1 Raum (Schule A)'
);

SELECT results_eq(
  $$ SELECT COUNT(*)::int FROM profiles WHERE schule_id = '11111111-1111-1111-1111-111111111111'::uuid $$,
  ARRAY[5],
  'Admin A sieht 5 Profile der eigenen Schule'
);

SELECT results_eq(
  $$ SELECT meine_schule_id() $$,
  ARRAY['11111111-1111-1111-1111-111111111111'::uuid],
  'meine_schule_id() gibt Schule A für Admin A zurück'
);

SELECT results_eq(
  $$ SELECT meine_rolle()::text $$,
  ARRAY['admin'],
  'meine_rolle() gibt admin für Admin A zurück'
);

-- ─── 2. Admin B — nur Schule B ──────────────────────────────────────────────

SET LOCAL role = authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);

SELECT results_eq(
  $$ SELECT COUNT(*)::int FROM unterricht $$,
  ARRAY[1],
  'Admin B sieht nur 1 Kurs (Schule B)'
);

SELECT results_eq(
  $$ SELECT COUNT(*)::int FROM events $$,
  ARRAY[1],
  'Admin B sieht nur 1 Event (Schule B)'
);

SELECT results_eq(
  $$ SELECT COUNT(*)::int FROM unterricht WHERE schule_id = '11111111-1111-1111-1111-111111111111'::uuid $$,
  ARRAY[0],
  'Admin B sieht keinen Kurs von Schule A'
);

-- ─── 3. Lehrer A — nur Schule A ─────────────────────────────────────────────

SET LOCAL role = authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}', true);

SELECT results_eq(
  $$ SELECT COUNT(*)::int FROM unterricht $$,
  ARRAY[1],
  'Lehrer A sieht nur Kurs der eigenen Schule'
);

SELECT results_eq(
  $$ SELECT COUNT(*)::int FROM unterricht WHERE schule_id = '22222222-2222-2222-2222-222222222222'::uuid $$,
  ARRAY[0],
  'Lehrer A sieht keinen Kurs von Schule B'
);

SELECT results_eq(
  $$ SELECT COUNT(*)::int FROM events $$,
  ARRAY[1],
  'Lehrer A sieht nur Event der eigenen Schule'
);

SELECT results_eq(
  $$ SELECT meine_rolle()::text $$,
  ARRAY['lehrer'],
  'meine_rolle() gibt lehrer für Lehrer A zurück'
);

-- ─── 4. Schüler A — nur eigene Schule ───────────────────────────────────────

SET LOCAL role = authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"dddddddd-dddd-dddd-dddd-dddddddddddd","role":"authenticated"}', true);

SELECT results_eq(
  $$ SELECT COUNT(*)::int FROM events WHERE schule_id != '11111111-1111-1111-1111-111111111111'::uuid $$,
  ARRAY[0],
  'Schüler A sieht keine Events von Schule B'
);

SELECT results_eq(
  $$ SELECT COUNT(*)::int FROM profiles WHERE id = auth.uid() $$,
  ARRAY[1],
  'Schüler A kann eigenes Profil lesen'
);

-- ─── 5. Vorstand A — Events der eigenen Schule ──────────────────────────────

SET LOCAL role = authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee","role":"authenticated"}', true);

SELECT results_eq(
  $$ SELECT COUNT(*)::int FROM events $$,
  ARRAY[1],
  'Vorstand A sieht nur Events der eigenen Schule'
);

SELECT results_eq(
  $$ SELECT COUNT(*)::int FROM events WHERE schule_id = '22222222-2222-2222-2222-222222222222'::uuid $$,
  ARRAY[0],
  'Vorstand A sieht keine Events von Schule B'
);

-- ─── 6. Superadmin — sieht alle Schulen ─────────────────────────────────────

SET LOCAL role = authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"ffffffff-ffff-ffff-ffff-ffffffffffff","role":"authenticated"}', true);

SELECT results_eq(
  $$ SELECT COUNT(*)::int FROM schulen WHERE id IN (
       '11111111-1111-1111-1111-111111111111'::uuid,
       '22222222-2222-2222-2222-222222222222'::uuid) $$,
  ARRAY[2],
  'Superadmin sieht beide Schulen'
);

-- ─── 7. Cross-School-Write blockiert ────────────────────────────────────────

SET LOCAL role = authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);

SELECT throws_ok(
  $$ INSERT INTO raeume (schule_id, name) VALUES ('22222222-2222-2222-2222-222222222222', 'Hack-Raum') $$,
  '42501',
  NULL,
  'Admin A kann keinen Raum in Schule B erstellen (RLS-Block)'
);

-- ─── 8. meine_schule_id() bei verschiedenen Rollen ──────────────────────────

SET LOCAL role = authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}', true);

SELECT results_eq(
  $$ SELECT meine_schule_id() $$,
  ARRAY['11111111-1111-1111-1111-111111111111'::uuid],
  'meine_schule_id() gibt Schule A für Lehrer A zurück'
);

SET LOCAL role = authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);

SELECT results_eq(
  $$ SELECT meine_schule_id() $$,
  ARRAY['22222222-2222-2222-2222-222222222222'::uuid],
  'meine_schule_id() gibt Schule B für Admin B zurück'
);

-- ─── 9. Profile-Isolation: andere Schule nicht sichtbar ─────────────────────

SET LOCAL role = authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);

SELECT results_eq(
  $$ SELECT COUNT(*)::int FROM profiles WHERE schule_id = '22222222-2222-2222-2222-222222222222'::uuid $$,
  ARRAY[0],
  'Admin A sieht keine Profile von Schule B'
);

-- ─── 10. Anon-User sieht keine internen Daten ───────────────────────────────

SET LOCAL role = anon;
SELECT set_config('request.jwt.claims', '{}', true);

SELECT results_eq(
  $$ SELECT COUNT(*)::int FROM profiles $$,
  ARRAY[0],
  'Anon-User sieht keine Profile'
);

SELECT results_eq(
  $$ SELECT COUNT(*)::int FROM unterricht $$,
  ARRAY[0],
  'Anon-User sieht keine Kurse'
);

SELECT * FROM finish();

ROLLBACK;
