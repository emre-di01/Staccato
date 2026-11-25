-- pgTAP: Bankdaten, Kalender-Schlüssel, Sicht auf Schulen und Räume
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path TO public, extensions;
SELECT plan(47);
CREATE FUNCTION pg_temp.als(p uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true), set_config('request.jwt.claim.sub', p::text, true), set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;
END $$;
CREATE FUNCTION pg_temp.niemand() RETURNS void LANGUAGE sql AS $$ SELECT set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claim.role', '', true); $$;
INSERT INTO schulen (id, name, aktiv, steuernummer) VALUES ('d1111111-1111-1111-1111-111111111111', 'DS A', true, 'A-1'), ('d2222222-2222-2222-2222-222222222222', 'DS B', true, 'B-2');
INSERT INTO auth.users (id, aud, role, email, encrypted_password, created_at, updated_at)
SELECT ('da000000-0000-0000-0000-00000000000' || n)::uuid, 'authenticated', 'authenticated', 'ds' || n || '@test.local', '', now(), now() FROM generate_series(1, 5) n;
INSERT INTO profiles (id, voller_name, rolle, schule_id, letzte_schule_id)
SELECT ('da000000-0000-0000-0000-00000000000' || n)::uuid, name, r::user_rolle, s::uuid, s::uuid FROM (VALUES
 (1, 'Admin A', 'admin', 'd1111111-1111-1111-1111-111111111111'), (2, 'Lehrer A', 'lehrer', 'd1111111-1111-1111-1111-111111111111'), (3, 'Schüler A', 'schueler', 'd1111111-1111-1111-1111-111111111111'),
 (4, 'Schüler A2', 'schueler', 'd1111111-1111-1111-1111-111111111111'), (5, 'Admin B', 'admin', 'd2222222-2222-2222-2222-222222222222')) v(n, name, r, s)
ON CONFLICT (id) DO UPDATE SET voller_name = EXCLUDED.voller_name, rolle = EXCLUDED.rolle, schule_id = EXCLUDED.schule_id, letzte_schule_id = EXCLUDED.letzte_schule_id;
INSERT INTO schul_mitgliedschaften (user_id, schule_id, rolle, aktiv) SELECT id, schule_id, rolle, true FROM profiles WHERE id::text LIKE 'da000000%'
ON CONFLICT (user_id, schule_id) DO UPDATE SET rolle = EXCLUDED.rolle, aktiv = true;
INSERT INTO unterricht (id, schule_id, name, typ, abrechnungs_typ) VALUES ('dc000000-0000-0000-0000-000000000001', 'd1111111-1111-1111-1111-111111111111', 'Kurs', 'gruppe', 'pauschale');
INSERT INTO unterricht_lehrer (unterricht_id, lehrer_id, rolle) VALUES ('dc000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000002', 'hauptlehrer');
INSERT INTO unterricht_schueler (unterricht_id, schueler_id, status) VALUES ('dc000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000003', 'aktiv');
INSERT INTO raeume (id, schule_id, name) VALUES ('de000000-0000-0000-0000-000000000001', 'd1111111-1111-1111-1111-111111111111', 'R');

-- ── Schüler pflegt die eigene Bankverbindung ──
SELECT pg_temp.als('da000000-0000-0000-0000-000000000003');
SELECT lives_ok($$SELECT bankdaten_setzen('da000000-0000-0000-0000-000000000003', '{"zahlungsweise":"sepa","iban":"DE89370400440532013000","kontoinhaber":"K","bic":""}')$$, 'Eigene Bankdaten setzen');
SELECT is((SELECT iban || '|' || coalesce(bic, '-') FROM profil_bankdaten), 'DE89370400440532013000|-', 'Eigene Zeile lesbar, leer = null');
SELECT throws_ok($$SELECT bankdaten_setzen('da000000-0000-0000-0000-000000000003', '{"mitgliedsbeitrag":1}')$$, '42501', NULL, 'Beitrag nicht selbst');
SELECT throws_ok($$SELECT bankdaten_setzen('da000000-0000-0000-0000-000000000003', '{"zahlungsrhythmus":"jaehrlich"}')$$, '42501', NULL, 'Rhythmus nicht selbst');
SELECT throws_ok($$SELECT bankdaten_setzen('da000000-0000-0000-0000-000000000004', '{"iban":"X"}')$$, '42501', NULL, 'Nicht für andere');
SELECT throws_ok($$SELECT bankdaten_uebernehmen('da000000-0000-0000-0000-000000000004', '{"iban":"X"}')$$, '42501', NULL, 'Interne Funktion nicht nutzbar');
SELECT throws_ok($$INSERT INTO profil_bankdaten (profil_id) VALUES ('da000000-0000-0000-0000-000000000003')$$, '42501', NULL, 'Kein direktes Schreiben');
SELECT throws_ok($$UPDATE profil_bankdaten SET mitgliedsbeitrag = 0$$, '42501', NULL, 'Kein direktes Ändern');
SELECT throws_ok($$SELECT * FROM profil_kalender$$, '42501', NULL, 'Kalender-Tabelle gesperrt');
SELECT throws_ok($$UPDATE profiles SET mitgliedsbeitrag = 1 WHERE id = auth.uid()$$, '42501', NULL, 'Alter Schreibweg: Beitrag nicht selbst');
SELECT throws_ok($$UPDATE profiles SET zahlungsrhythmus = 'jaehrlich' WHERE id = auth.uid()$$, '42501', NULL, 'Alter Schreibweg: Rhythmus nicht selbst');
SELECT lives_ok($$UPDATE profiles SET iban = 'DE02120300000000202051', telefon = '1' WHERE id = auth.uid()$$, 'Alter Schreibweg: IBAN');
SELECT is((SELECT iban FROM profil_bankdaten), 'DE02120300000000202051', '… landet in der neuen Tabelle');
SELECT is((SELECT iban IS NULL AND telefon = '1' FROM profiles WHERE id = auth.uid()), true, '… nicht in profiles');
SELECT is((SELECT kontoinhaber FROM profil_bankdaten), 'K', '… andere Felder bleiben');
SELECT lives_ok($$UPDATE profiles SET iban = NULL, telefon = '2' WHERE id = auth.uid()$$, 'Alte App ohne Werte');
SELECT is((SELECT iban FROM profil_bankdaten), 'DE02120300000000202051', '… löscht nichts');
SELECT is((SELECT iban FROM mitglieder_mit_email WHERE id = auth.uid()), 'DE02120300000000202051', 'Eigene Daten in der View');
SELECT is((SELECT count(*) FROM mitglieder_mit_email), 1::bigint, 'View: nur ich');
SELECT is(meine_daten_exportieren()->'zahlungsdaten'->>'iban', 'DE02120300000000202051', 'Datenexport enthält Bankdaten');
-- Kalender
CREATE TEMP TABLE _k AS SELECT mein_kalender_token() AS t;
SELECT is(mein_kalender_token(), (SELECT t FROM _k), 'Kalender-Schlüssel bleibt');
SELECT isnt(mein_kalender_token(true), (SELECT t FROM _k), 'Neuer Schlüssel');
SELECT lives_ok($$UPDATE profiles SET kalender_token = 'dddddddd-dddd-dddd-dddd-dddddddddddd' WHERE id = auth.uid()$$, 'Alter Schreibweg: Schlüssel');
SELECT is(mein_kalender_token(), 'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid, '… übernommen');
SELECT is((SELECT kalender_token FROM profiles WHERE id = auth.uid()), NULL, '… nicht in profiles');
SELECT is((SELECT string_agg(name, ',') FROM schulen WHERE name LIKE 'DS %'), 'DS A', 'Nur die eigene Schule');
SELECT lives_ok($$SELECT * FROM raum_belegung('de000000-0000-0000-0000-000000000001')$$, 'Raum der eigenen Schule');
RESET ROLE;

-- ── Lehrkraft ──
SELECT pg_temp.als('da000000-0000-0000-0000-000000000002');
SELECT is((SELECT count(*) FROM profiles WHERE id = 'da000000-0000-0000-0000-000000000003'), 1::bigint, 'Lehrkraft sieht eigene Schüler');
SELECT is((SELECT count(coalesce(iban, kontoinhaber, zahlungsweise, kalender_token::text)) FROM profiles), 0::bigint, '… ohne Bankdaten und Schlüssel');
SELECT is((SELECT count(*) FROM mitglieder_mit_email WHERE email IS NOT NULL AND id = 'da000000-0000-0000-0000-000000000003'), 1::bigint, 'View zeigt E-Mail');
SELECT is((SELECT count(coalesce(iban, bic, kontoinhaber, zahlungsweise, zahlungsrhythmus, mitgliedsbeitrag::text)) FROM mitglieder_mit_email WHERE id <> auth.uid()), 0::bigint, '… aber keine Bankdaten');
SELECT is((SELECT count(*) FROM profil_bankdaten), 0::bigint, 'Keine fremden Bankdaten');
SELECT throws_ok($$SELECT bankdaten_setzen('da000000-0000-0000-0000-000000000003', '{"iban":"X"}')$$, '42501', NULL, 'Lehrkraft ändert keine Bankdaten');
RESET ROLE;

-- ── Admin ──
SELECT pg_temp.als('da000000-0000-0000-0000-000000000001');
SELECT lives_ok($$SELECT bankdaten_setzen('da000000-0000-0000-0000-000000000003', '{"mitgliedsbeitrag":"29.50","zahlungsrhythmus":"monatlich"}')$$, 'Admin setzt Beitrag');
SELECT is((SELECT iban || '|' || mitgliedsbeitrag || '|' || zahlungsrhythmus FROM mitglieder_mit_email WHERE id = 'da000000-0000-0000-0000-000000000003'), 'DE02120300000000202051|29.50|monatlich', 'Admin sieht Bankdaten der Schule');
SELECT lives_ok($$UPDATE profiles SET mitgliedsbeitrag = 31, zahlungsweise = 'bar' WHERE id = 'da000000-0000-0000-0000-000000000004'$$, 'Alter Schreibweg: Admin');
SELECT is((SELECT mitgliedsbeitrag || '|' || zahlungsweise FROM mitglieder_mit_email WHERE id = 'da000000-0000-0000-0000-000000000004'), '31.00|bar', '… übernommen');
SELECT lives_ok($$SELECT bankdaten_setzen('da000000-0000-0000-0000-000000000003', '{"iban":null}')$$, 'Admin löscht IBAN');
SELECT is((SELECT iban FROM mitglieder_mit_email WHERE id = 'da000000-0000-0000-0000-000000000003'), NULL, '… gelöscht');
SELECT is((SELECT count(kalender_token) FROM profiles), 0::bigint, 'Admin sieht keine Kalender-Schlüssel');
SELECT lives_ok($$UPDATE schulen SET telefon = '1' WHERE id = 'd1111111-1111-1111-1111-111111111111'$$, 'Admin ändert eigene Schule');
RESET ROLE;

-- ── Admin der anderen Schule ──
SELECT pg_temp.als('da000000-0000-0000-0000-000000000005');
SELECT throws_ok($$SELECT bankdaten_setzen('da000000-0000-0000-0000-000000000003', '{"iban":"X"}')$$, '42501', NULL, 'Fremder Admin ändert nichts');
SELECT is((SELECT count(*) FROM mitglieder_mit_email WHERE id::text LIKE 'da%' AND id <> auth.uid()), 0::bigint, '… und sieht nichts');
SELECT throws_ok($$SELECT * FROM raum_belegung('de000000-0000-0000-0000-000000000001')$$, '42501', NULL, 'Raum einer anderen Schule gesperrt');
SELECT is((SELECT count(*) FROM schulen WHERE steuernummer = 'A-1'), 0::bigint, 'Steuernummer anderer Schulen unsichtbar');
RESET ROLE;
SELECT pg_temp.niemand();
SET LOCAL ROLE anon;
SELECT throws_ok($$SELECT mein_kalender_token()$$, '42501', NULL, 'Ohne Anmeldung kein Schlüssel');
RESET ROLE;
DELETE FROM profiles WHERE id = 'da000000-0000-0000-0000-000000000003';
SELECT is((SELECT count(*) FROM profil_bankdaten WHERE profil_id = 'da000000-0000-0000-0000-000000000003') + (SELECT count(*) FROM profil_kalender WHERE profil_id = 'da000000-0000-0000-0000-000000000003'), 0::bigint, 'Konto gelöscht: Bankdaten und Schlüssel weg');
SELECT * FROM finish();
ROLLBACK;
