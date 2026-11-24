-- pgTAP: Ticketverkauf – Rechte, Schulgrenzen, Datenregeln
-- Führe aus mit: supabase test db   (läuft in einer Transaktion, ROLLBACK am Ende)

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path TO public, extensions;
SELECT plan(70);

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

-- ── Reservieren (Event 4: 5 Plätze, 15 €, vergünstigt 8 € × 3, höchstens 4) ──
INSERT INTO events (id, schule_id, titel, typ, beginn, oeffentlich, erstellt_von) VALUES
  ('73000000-0000-0000-0000-000000000004', '71111111-1111-1111-1111-111111111111', 'Reservierung', 'konzert', now() + interval '30 days', true, '7a000000-0000-0000-0000-000000000000'),
  ('73000000-0000-0000-0000-000000000005', '71111111-1111-1111-1111-111111111111', 'Gratis', 'konzert', now() + interval '2 hours', true, '7a000000-0000-0000-0000-000000000000');
INSERT INTO ticket_einstellungen (event_id, aktiv, kapazitaet, preis_normal, preis_verguenstigt, kontingent, obergrenze) VALUES
  ('73000000-0000-0000-0000-000000000004', false, 5, 15, 8, 3, 4);
INSERT INTO ticket_einstellungen (event_id, aktiv, kapazitaet, preis_normal, bis_abendkasse) VALUES
  ('73000000-0000-0000-0000-000000000005', true, 5, 0, true);
INSERT INTO event_teilnehmer (event_id, profil_id) VALUES ('73000000-0000-0000-0000-000000000003', '7d000000-0000-0000-0000-000000000000');
CREATE FUNCTION pg_temp.res(p_event int, p_n int, p_betrag numeric) RETURNS text LANGUAGE sql AS
  $$SELECT coalesce(r->>'grund', 'ok') FROM tickets_reservieren(('73000000-0000-0000-0000-00000000000' || p_event)::uuid, p_n, p_betrag) r$$;

SELECT pg_temp.als('7c000000-0000-0000-0000-000000000000');
SELECT is(pg_temp.res(4, 1, 8), 'nicht_verfuegbar', 'Verkauf aus: keine Reservierung');
RESET ROLE;
UPDATE ticket_einstellungen SET aktiv = true, verkauf_von = now() + interval '1 day' WHERE event_id = '73000000-0000-0000-0000-000000000004';
UPDATE ticket_einstellungen SET aktiv = true WHERE event_id = '73000000-0000-0000-0000-000000000002';
SELECT pg_temp.als('7c000000-0000-0000-0000-000000000000');
SELECT is(pg_temp.res(4, 1, 8), 'noch_nicht', 'Vor Verkaufsstart');
SELECT is(pg_temp.res(2, 1, 15), 'nicht_verfuegbar', 'Nicht sichtbares Event');
RESET ROLE;
UPDATE ticket_einstellungen SET verkauf_von = NULL, verkauf_bis = now() - interval '1 minute' WHERE event_id = '73000000-0000-0000-0000-000000000004';
SELECT pg_temp.als('7c000000-0000-0000-0000-000000000000');
SELECT is(pg_temp.res(4, 1, 8), 'beendet', 'Nach Verkaufsende');
RESET ROLE;
UPDATE ticket_einstellungen SET verkauf_bis = now() + interval '3 days' WHERE event_id = '73000000-0000-0000-0000-000000000004';

SELECT pg_temp.als('7c000000-0000-0000-0000-000000000000');
SELECT is(pg_temp.res(4, 0, 0), 'anzahl', 'Anzahl 0');
SELECT is(pg_temp.res(4, -1, -8), 'anzahl', 'Negative Anzahl');
SELECT is(pg_temp.res(4, NULL, 0), 'anzahl', 'Anzahl NULL');
SELECT is(pg_temp.res(4, 5, 54), 'obergrenze', 'Über Obergrenze');
SELECT is(pg_temp.res(4, 2, 2), 'preis_geaendert', 'Abweichender Betrag');
SELECT is(pg_temp.res(4, 2, NULL), 'preis_geaendert', 'Betrag NULL');
SELECT is(pg_temp.res(4, 2, 16), 'ok', '2 vergünstigte');
SELECT is((SELECT frist FROM ticket_bestellungen WHERE event_id = '73000000-0000-0000-0000-000000000004'), now() + interval '3 days', 'Frist spätestens Verkaufsende');
SELECT is((SELECT count(*) FROM tickets WHERE event_id = '73000000-0000-0000-0000-000000000004' AND code IS NULL AND status = 'reserviert'), 2::bigint, 'Reserviert ohne Code');
SELECT is(pg_temp.res(4, 2, 23), 'ok', 'Rest: 1 vergünstigt + 1 normal');
SELECT is(pg_temp.res(4, 1, 15), 'obergrenze', 'Obergrenze erreicht');
RESET ROLE;
SELECT is((SELECT array_agg(preis ORDER BY preis) FROM tickets WHERE event_id = '73000000-0000-0000-0000-000000000004'), ARRAY[8,8,8,15]::numeric[], 'Preise am Ticket gespeichert');

SELECT pg_temp.als('7d000000-0000-0000-0000-000000000000');
SELECT is(pg_temp.res(4, 2, 16), 'zu_wenig_frei', 'Nur noch 1 Platz');
SELECT is(pg_temp.res(4, 1, 8), 'ok', 'Letzter Platz, eigenes Kontingent');
SELECT is(pg_temp.res(4, 1, 8), 'ausverkauft', 'Ausverkauft');
SELECT is(pg_temp.res(3, 1, 8), 'nicht_verfuegbar', 'Eingeladen, aber ohne Ticketverkauf');
RESET ROLE;
INSERT INTO ticket_einstellungen (event_id, aktiv, kapazitaet, preis_normal) VALUES ('73000000-0000-0000-0000-000000000003', true, 5, 10);
SELECT pg_temp.als('7d000000-0000-0000-0000-000000000000');
SELECT is(pg_temp.res(3, 1, 10), 'kein_mitglied', 'Eingeladen, aber nicht Mitglied der Schule B');
RESET ROLE;

-- Verfall gibt Platz und Kontingent frei, auch vor dem Aufräumjob
UPDATE ticket_bestellungen SET frist = now() - interval '1 minute' WHERE event_id = '73000000-0000-0000-0000-000000000004' AND kaeufer_id = '7c000000-0000-0000-0000-000000000000';
SELECT pg_temp.als('7c000000-0000-0000-0000-000000000000');
SELECT is((ticket_info('73000000-0000-0000-0000-000000000004') - ARRAY['frist','verkauf_von','preis_normal','preis_verguenstigt','grund']),
  '{"ok": true, "frei": 4, "max": 4, "meine": 0, "rest_verguenstigt": 3}'::jsonb, 'Verfallene Reservierung zählt nicht mehr');
SELECT throws_ok('SELECT tickets_bereinigen()', '42501', NULL, 'Aufräumjob nicht für Nutzer');
RESET ROLE;
SELECT set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claim.role', '', true);
SELECT is(tickets_bereinigen(), 4, 'Aufräumjob setzt 4 Tickets auf verfallen');
SELECT is((SELECT count(*) FROM ticket_bestellungen WHERE event_id = '73000000-0000-0000-0000-000000000004' AND status = 'verfallen'), 2::bigint, 'Bestellungen verfallen');

-- Kostenlos: sofort gültig. Frist bei Reservierung bis Abendkasse: 30 min vor Beginn
SELECT pg_temp.als('7c000000-0000-0000-0000-000000000000');
SELECT is(pg_temp.res(5, 2, 0), 'ok', 'Kostenlose Tickets');
SELECT is((SELECT count(*) FROM tickets WHERE event_id = '73000000-0000-0000-0000-000000000005' AND status = 'gueltig' AND code IS NOT NULL), 2::bigint, 'Kostenlose Tickets sofort gültig');
SELECT is((ticket_info('73000000-0000-0000-0000-000000000005')->>'frist')::timestamptz, now() + interval '90 minutes', 'Abendkasse: Frist 30 min vor Beginn');
SELECT is(jsonb_array_length(meine_daten_exportieren()->'ticketbestellungen'), 4, 'DSGVO-Export enthält Ticketbestellungen');
RESET ROLE;

-- sieht_event() muss mit den events-Policies übereinstimmen
CREATE FUNCTION pg_temp.abweichung(p uuid) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE v_rls uuid[]; v_fn uuid[];
BEGIN
  PERFORM pg_temp.als(p);
  SELECT array_agg(id ORDER BY id) INTO v_rls FROM events WHERE id::text LIKE '73%';
  RESET ROLE;
  SELECT array_agg(id ORDER BY id) INTO v_fn FROM events WHERE id::text LIKE '73%' AND sieht_event(id);
  RETURN (v_rls IS DISTINCT FROM v_fn)::int;
END $$;
INSERT INTO events (id, schule_id, titel, typ, beginn, oeffentlich, erstellt_von) VALUES
  ('73000000-0000-0000-0000-000000000006', '71111111-1111-1111-1111-111111111111', 'Sitzung', 'vorstandssitzung', now() + interval '30 days', true, '7a000000-0000-0000-0000-000000000000'),
  ('73000000-0000-0000-0000-000000000007', '71111111-1111-1111-1111-111111111111', 'Lehrer intern', 'vorspiel', now() + interval '30 days', false, '7e000000-0000-0000-0000-000000000000');
SELECT is((SELECT sum(pg_temp.abweichung(id)) FROM (VALUES ('7a000000-0000-0000-0000-000000000000'::uuid), ('7b000000-0000-0000-0000-000000000000'),
  ('7c000000-0000-0000-0000-000000000000'), ('7d000000-0000-0000-0000-000000000000'), ('7e000000-0000-0000-0000-000000000000')) v(id)), 0::numeric, 'sieht_event = RLS (Admin, Schüler, Lehrkraft)');
SELECT set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claim.role', '', true);
UPDATE profiles SET rolle = 'vorstand' WHERE id = '7d000000-0000-0000-0000-000000000000';
SELECT is(pg_temp.abweichung('7d000000-0000-0000-0000-000000000000'), 0::bigint, 'sieht_event = RLS (Vorstand)');
RESET ROLE;
SELECT throws_ok($$SELECT set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.sub', '', true), ticket_info('73000000-0000-0000-0000-000000000004')$$, '42501', NULL, 'ticket_info nur angemeldet');

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
