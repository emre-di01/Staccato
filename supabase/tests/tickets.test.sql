-- pgTAP: Ticketverkauf – Rechte, Schulgrenzen, Datenregeln
-- Führe aus mit: supabase test db   (läuft in einer Transaktion, ROLLBACK am Ende)

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path TO public, extensions;
SELECT plan(38);

CREATE FUNCTION pg_temp.als(p uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;
END $$;

-- Fixtures: Schule A und B, je ein Admin; in A zwei Schüler und eine Lehrkraft
INSERT INTO schulen (id, name, aktiv) VALUES
  ('71111111-1111-1111-1111-111111111111', 'Ticket-Schule A', true),
  ('72222222-2222-2222-2222-222222222222', 'Ticket-Schule B', true);
INSERT INTO auth.users (id, aud, role, email, encrypted_password, created_at, updated_at)
SELECT id::uuid, 'authenticated', 'authenticated', 'tk_' || left(id, 2) || '@test.local', '', now(), now()
FROM unnest(ARRAY['7a000000-0000-0000-0000-000000000000','7b000000-0000-0000-0000-000000000000','7c000000-0000-0000-0000-000000000000',
                  '7d000000-0000-0000-0000-000000000000','7e000000-0000-0000-0000-000000000000']) AS id;
INSERT INTO profiles (id, voller_name, rolle, schule_id, letzte_schule_id)
SELECT id::uuid, name, rolle::user_rolle, schule::uuid, schule::uuid FROM (VALUES
  ('7a000000-0000-0000-0000-000000000000', 'Admin A',   'admin',    '71111111-1111-1111-1111-111111111111'),
  ('7b000000-0000-0000-0000-000000000000', 'Admin B',   'admin',    '72222222-2222-2222-2222-222222222222'),
  ('7c000000-0000-0000-0000-000000000000', 'Schüler A', 'schueler', '71111111-1111-1111-1111-111111111111'),
  ('7d000000-0000-0000-0000-000000000000', 'Schüler 2', 'schueler', '71111111-1111-1111-1111-111111111111'),
  ('7e000000-0000-0000-0000-000000000000', 'Lehrer A',  'lehrer',   '71111111-1111-1111-1111-111111111111')) v(id, name, rolle, schule)
ON CONFLICT (id) DO UPDATE SET rolle = EXCLUDED.rolle, schule_id = EXCLUDED.schule_id, letzte_schule_id = EXCLUDED.letzte_schule_id;
INSERT INTO schul_mitgliedschaften (user_id, schule_id, rolle, aktiv)
SELECT id, schule_id, rolle, true FROM profiles WHERE id::text LIKE '7_000000-0000-0000-0000-000000000000'
ON CONFLICT (user_id, schule_id) DO UPDATE SET rolle = EXCLUDED.rolle, aktiv = true;
INSERT INTO events (id, schule_id, titel, typ, beginn, oeffentlich, erstellt_von) VALUES
  ('73000000-0000-0000-0000-000000000001', '71111111-1111-1111-1111-111111111111', 'Öffentlich', 'konzert', now() + interval '30 days', true,  '7e000000-0000-0000-0000-000000000000'),
  ('73000000-0000-0000-0000-000000000002', '71111111-1111-1111-1111-111111111111', 'Intern',     'konzert', now() + interval '30 days', false, '7a000000-0000-0000-0000-000000000000'),
  ('73000000-0000-0000-0000-000000000003', '72222222-2222-2222-2222-222222222222', 'Schule B',   'konzert', now() + interval '30 days', true,  '7b000000-0000-0000-0000-000000000000');

-- ── Einstellungen ──
SELECT pg_temp.als('7a000000-0000-0000-0000-000000000000');
SELECT lives_ok($$INSERT INTO ticket_einstellungen (event_id, kapazitaet, preis_normal, preis_verguenstigt, kontingent) VALUES ('73000000-0000-0000-0000-000000000001', 5, 15, 8, 3)$$, 'Admin legt Einstellungen an');
SELECT lives_ok($$INSERT INTO ticket_einstellungen (event_id, kapazitaet, preis_normal) VALUES ('73000000-0000-0000-0000-000000000002', 5, 15)$$, 'Admin legt Einstellungen für internes Event an');
SELECT throws_ok($$INSERT INTO ticket_einstellungen (event_id, kapazitaet, preis_normal) VALUES ('73000000-0000-0000-0000-000000000003', 5, 15)$$, '42501', NULL, 'Admin A nicht für Event der Schule B');
SELECT throws_ok($$UPDATE ticket_einstellungen SET preis_verguenstigt = 20 WHERE event_id = '73000000-0000-0000-0000-000000000001'$$, '23514', NULL, 'Vergünstigt nicht teurer als normal');
SELECT throws_ok($$UPDATE ticket_einstellungen SET preis_abendkasse = 10 WHERE event_id = '73000000-0000-0000-0000-000000000001'$$, '23514', NULL, 'Abendkasse nicht günstiger als normal');
SELECT lives_ok($$UPDATE ticket_einstellungen SET preis_abendkasse = 18 WHERE event_id = '73000000-0000-0000-0000-000000000001'$$, 'Abendkasse darf teurer sein');
SELECT throws_ok($$UPDATE ticket_einstellungen SET obergrenze = 2 WHERE event_id = '73000000-0000-0000-0000-000000000001'$$, '23514', NULL, 'Kontingent nicht über Obergrenze');
SELECT throws_ok($$UPDATE ticket_einstellungen SET kontingent = 1 WHERE event_id = '73000000-0000-0000-0000-000000000002'$$, '23514', NULL, 'Kontingent braucht vergünstigten Preis');
SELECT throws_ok($$UPDATE ticket_einstellungen SET verkauf_von = now(), verkauf_bis = now() - interval '1 day' WHERE event_id = '73000000-0000-0000-0000-000000000001'$$, '23514', NULL, 'Verkaufsende nach Verkaufsstart');
RESET ROLE;

SELECT pg_temp.als('7c000000-0000-0000-0000-000000000000');
SELECT is((SELECT count(*) FROM ticket_einstellungen WHERE event_id::text LIKE '73%'), 1::bigint, 'Schüler sieht nur Einstellungen sichtbarer Events');
UPDATE ticket_einstellungen SET preis_normal = 0 WHERE event_id = '73000000-0000-0000-0000-000000000001';
SELECT is((SELECT preis_normal FROM ticket_einstellungen WHERE event_id = '73000000-0000-0000-0000-000000000001'), 15::numeric, 'Schüler kann Preis nicht ändern');
SELECT throws_ok($$INSERT INTO ticket_bestellungen (schule_id, event_id, kaeufer_id, status) VALUES ('71111111-1111-1111-1111-111111111111', '73000000-0000-0000-0000-000000000001', '7c000000-0000-0000-0000-000000000000', 'bezahlt')$$, '42501', NULL, 'Schüler legt keine Bestellung direkt an');
SELECT throws_ok($$INSERT INTO ticket_freigaben (event_id, profil_id, kasse) VALUES ('73000000-0000-0000-0000-000000000001', '7c000000-0000-0000-0000-000000000000', true)$$, '42501', NULL, 'Schüler gibt sich nicht selbst frei');
RESET ROLE;

SELECT pg_temp.als('7e000000-0000-0000-0000-000000000000');
UPDATE ticket_einstellungen SET kapazitaet = 99 WHERE event_id = '73000000-0000-0000-0000-000000000001';
SELECT is((SELECT kapazitaet FROM ticket_einstellungen WHERE event_id = '73000000-0000-0000-0000-000000000001'), 5, 'Lehrkraft ändert Einstellungen nicht, auch nicht beim eigenen Event');
RESET ROLE;

SELECT pg_temp.als('7b000000-0000-0000-0000-000000000000');
SELECT is((SELECT count(*) FROM ticket_einstellungen WHERE event_id::text LIKE '73%'), 0::bigint, 'Admin B sieht nichts aus Schule A');
RESET ROLE;

-- ── Freigaben ──
SELECT pg_temp.als('7a000000-0000-0000-0000-000000000000');
SELECT lives_ok($$INSERT INTO ticket_freigaben (event_id, profil_id, scannen) VALUES ('73000000-0000-0000-0000-000000000001', '7d000000-0000-0000-0000-000000000000', true)$$, 'Admin gibt Mitglied frei');
SELECT throws_ok($$INSERT INTO ticket_freigaben (event_id, profil_id, scannen) VALUES ('73000000-0000-0000-0000-000000000001', '7b000000-0000-0000-0000-000000000000', true)$$, '42501', NULL, 'Keine Freigabe für Personen anderer Schulen');
SELECT throws_ok($$INSERT INTO ticket_freigaben (event_id, profil_id) VALUES ('73000000-0000-0000-0000-000000000001', '7c000000-0000-0000-0000-000000000000')$$, '23514', NULL, 'Leere Freigabe abgelehnt');
RESET ROLE;
SELECT pg_temp.als('7d000000-0000-0000-0000-000000000000');
SELECT is((SELECT count(*) FROM ticket_freigaben WHERE event_id::text LIKE '73%'), 1::bigint, 'Freigegebene Person sieht ihre Freigabe');
UPDATE ticket_freigaben SET kasse = true WHERE profil_id = '7d000000-0000-0000-0000-000000000000';
SELECT is((SELECT kasse FROM ticket_freigaben WHERE profil_id = '7d000000-0000-0000-0000-000000000000'), false, 'Freigabe nicht selbst erweiterbar');
RESET ROLE;
SELECT pg_temp.als('7c000000-0000-0000-0000-000000000000');
SELECT is((SELECT count(*) FROM ticket_freigaben WHERE event_id::text LIKE '73%'), 0::bigint, 'Andere sehen Freigaben nicht');
RESET ROLE;

-- ── Bestellungen und Tickets (wie später per Funktion angelegt) ──
INSERT INTO ticket_bestellungen (id, schule_id, event_id, kaeufer_id, status, frist) VALUES
  ('74000000-0000-0000-0000-000000000001', '71111111-1111-1111-1111-111111111111', '73000000-0000-0000-0000-000000000001', '7c000000-0000-0000-0000-000000000000', 'bezahlt', NULL);
INSERT INTO tickets (bestellung_id, event_id, preis, status, code) VALUES
  ('74000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', 8, 'gueltig', 'testcode1'),
  ('74000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', 8, 'gueltig', 'testcode2');
INSERT INTO ticket_zahlungen (bestellung_id, betrag) VALUES ('74000000-0000-0000-0000-000000000001', 16);
SELECT throws_ok($$INSERT INTO tickets (bestellung_id, event_id, preis, status) VALUES ('74000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', 8, 'gueltig')$$, '23514', NULL, 'Gültiges Ticket braucht Code');
SELECT throws_ok($$INSERT INTO tickets (bestellung_id, event_id, preis, code) VALUES ('74000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', 8, 'zu-frueh')$$, '23514', NULL, 'Kein Code vor Geldeingang');
SELECT throws_ok($$INSERT INTO tickets (bestellung_id, event_id, preis, status, code) VALUES ('74000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', 8, 'gueltig', 'testcode1')$$, '23505', NULL, 'Code ist eindeutig');
SELECT throws_ok($$INSERT INTO ticket_bestellungen (schule_id, event_id) VALUES ('71111111-1111-1111-1111-111111111111', '73000000-0000-0000-0000-000000000001')$$, '23514', NULL, 'Reservierung braucht Frist');

SELECT pg_temp.als('7c000000-0000-0000-0000-000000000000');
SELECT is((SELECT count(*) FROM tickets WHERE event_id::text LIKE '73%'), 2::bigint, 'Käufer sieht eigene Tickets');
SELECT is((SELECT count(*) FROM ticket_zahlungen WHERE bestellung_id::text LIKE '74%'), 1::bigint, 'Käufer sieht eigene Zahlung');
RESET ROLE;
SELECT pg_temp.als('7d000000-0000-0000-0000-000000000000');
SELECT is((SELECT count(*) FROM tickets WHERE event_id::text LIKE '73%') + (SELECT count(*) FROM ticket_bestellungen WHERE event_id::text LIKE '73%')
        + (SELECT count(*) FROM ticket_zahlungen WHERE bestellung_id::text LIKE '74%'), 0::bigint, 'Scanner liest keine fremden Tickets, Codes oder Zahlungen');
RESET ROLE;
SELECT pg_temp.als('7b000000-0000-0000-0000-000000000000');
SELECT is((SELECT count(*) FROM tickets WHERE event_id::text LIKE '73%'), 0::bigint, 'Admin B sieht keine Tickets der Schule A');
RESET ROLE;
SELECT pg_temp.als('7a000000-0000-0000-0000-000000000000');
SELECT is((SELECT count(*) FROM tickets WHERE event_id::text LIKE '73%'), 2::bigint, 'Admin A sieht Tickets');
SELECT throws_ok($$UPDATE ticket_einstellungen SET kapazitaet = 1 WHERE event_id = '73000000-0000-0000-0000-000000000001'$$, '23514', 'ticket_kapazitaet_belegt:2', 'Kapazität nicht unter belegte Plätze');
SELECT lives_ok($$UPDATE ticket_einstellungen SET kapazitaet = 2 WHERE event_id = '73000000-0000-0000-0000-000000000001'$$, 'Kapazität bis auf belegte Plätze senkbar');
SELECT is(event_hat_tickets('73000000-0000-0000-0000-000000000001'), true, 'event_hat_tickets für Admin');
SELECT throws_ok($$DELETE FROM events WHERE id = '73000000-0000-0000-0000-000000000001'$$, '23503', NULL, 'Event mit Bestellungen nicht löschbar');
RESET ROLE;
SELECT pg_temp.als('7c000000-0000-0000-0000-000000000000');
SELECT throws_ok($$SELECT event_hat_tickets('73000000-0000-0000-0000-000000000001')$$, '42501', NULL, 'event_hat_tickets nicht für Schüler');
RESET ROLE;

-- Konto gelöscht: Bestellung bleibt ohne Personenbezug
DELETE FROM profiles WHERE id = '7c000000-0000-0000-0000-000000000000';
SELECT is((SELECT kaeufer_id FROM ticket_bestellungen WHERE id = '74000000-0000-0000-0000-000000000001'), NULL, 'Kontolöschung löst Käufer, Bestellung bleibt');

-- Demo-Schule mit Bestellungen löschbar
SELECT set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claim.role', '', true);
UPDATE profiles SET rolle = 'superadmin', schule_id = '72222222-2222-2222-2222-222222222222', letzte_schule_id = '72222222-2222-2222-2222-222222222222' WHERE id = '7b000000-0000-0000-0000-000000000000';
SELECT set_config('request.jwt.claims', '{"sub":"7b000000-0000-0000-0000-000000000000","role":"authenticated"}', true), set_config('request.jwt.claim.sub', '7b000000-0000-0000-0000-000000000000', true), set_config('request.jwt.claim.role', 'authenticated', true);
SELECT lives_ok($$SELECT demo_schule_loeschen('71111111-1111-1111-1111-111111111111')$$, 'Demo-Schule mit Tickets löschbar');
SELECT is((SELECT count(*) FROM ticket_bestellungen WHERE event_id::text LIKE '73%'), 0::bigint, 'Bestellungen der Schule sind weg');

SELECT * FROM finish();
ROLLBACK;
