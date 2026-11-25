-- pgTAP: Ticketverkauf – Rechte, Schulgrenzen, Datenregeln
-- Führe aus mit: supabase test db   (läuft in einer Transaktion, ROLLBACK am Ende)

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path TO public, extensions;
SELECT plan(276);

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
ON CONFLICT (id) DO UPDATE SET voller_name = EXCLUDED.voller_name, rolle = EXCLUDED.rolle, schule_id = EXCLUDED.schule_id, letzte_schule_id = EXCLUDED.letzte_schule_id;
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

UPDATE ticket_einstellungen SET verkauf_bis = NULL WHERE event_id = '73000000-0000-0000-0000-000000000004';
SELECT pg_temp.als('7c000000-0000-0000-0000-000000000000');
SELECT is(to_char((ticket_info('73000000-0000-0000-0000-000000000004')->>'frist')::timestamptz AT TIME ZONE 'Europe/Berlin', 'YYYY-MM-DD HH24:MI'),
  to_char((now() AT TIME ZONE 'Europe/Berlin')::date + 7, 'YYYY-MM-DD') || ' 23:59', 'Frist endet am Tagesende in Schulzeit');
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

-- Admins reservieren wie alle anderen Mitglieder, auch bei nicht öffentlichen Events
SELECT pg_temp.als('7a000000-0000-0000-0000-000000000000');
SELECT is(pg_temp.res(4, 1, 8), 'ok', 'Admin reserviert für sich (öffentlich)');
SELECT is(pg_temp.res(2, 1, 15), 'ok', 'Admin reserviert für sich (intern)');
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

-- ── Kasse, Storno, Erstattung (Event 8: 6 Plätze; 7c bestellt 4 = 3×8 + 15 = 39 €, 7e bestellt 1) ──
INSERT INTO events (id, schule_id, titel, typ, beginn, oeffentlich, erstellt_von) VALUES
  ('73000000-0000-0000-0000-000000000008', '71111111-1111-1111-1111-111111111111', 'Kasse', 'konzert', now() + interval '30 days', true, '7a000000-0000-0000-0000-000000000000');
INSERT INTO ticket_einstellungen (event_id, aktiv, kapazitaet, preis_normal, preis_verguenstigt, kontingent, obergrenze) VALUES
  ('73000000-0000-0000-0000-000000000008', true, 6, 15, 8, 3, 4);
INSERT INTO ticket_freigaben (event_id, profil_id, kasse, scannen) VALUES
  ('73000000-0000-0000-0000-000000000008', '7e000000-0000-0000-0000-000000000000', true, false),
  ('73000000-0000-0000-0000-000000000008', '7d000000-0000-0000-0000-000000000000', false, true);
SELECT pg_temp.als('7c000000-0000-0000-0000-000000000000');
SELECT is(pg_temp.res(8, 4, 39), 'ok', 'Kasse: 4 Tickets reserviert');
RESET ROLE;
SELECT pg_temp.als('7e000000-0000-0000-0000-000000000000');
SELECT is(pg_temp.res(8, 1, 8), 'ok', 'Kasse: 1 Ticket reserviert');
RESET ROLE;
CREATE TEMP TABLE _b AS SELECT kaeufer_id, id FROM ticket_bestellungen WHERE event_id = '73000000-0000-0000-0000-000000000008';
CREATE TEMP TABLE _t8 AS SELECT t.id, t.preis, row_number() OVER (ORDER BY t.preis DESC, t.id) AS nr FROM tickets t JOIN _b b ON b.id = t.bestellung_id WHERE b.kaeufer_id::text LIKE '7c%';
GRANT SELECT ON _b, _t8 TO authenticated;
CREATE FUNCTION pg_temp.b(p text) RETURNS uuid LANGUAGE sql AS $$SELECT id FROM _b WHERE kaeufer_id::text LIKE p || '%'$$;
CREATE FUNCTION pg_temp.tk(VARIADIC p int[]) RETURNS uuid[] LANGUAGE sql AS $$SELECT array_agg(id) FROM _t8 WHERE nr = ANY (p)$$;
CREATE FUNCTION pg_temp.zahl(p text, n numeric) RETURNS text LANGUAGE sql AS $$SELECT coalesce(r->>'grund', 'ok') FROM ticket_zahlung_bestaetigen(pg_temp.b(p), n) r$$;
CREATE FUNCTION pg_temp.storno(p text, t uuid[], n numeric) RETURNS text LANGUAGE sql AS $$SELECT coalesce(r->>'grund', 'ok') FROM tickets_stornieren(pg_temp.b(p), t, n) r$$;
CREATE FUNCTION pg_temp.erst(p text, n numeric) RETURNS text LANGUAGE sql AS $$SELECT coalesce(r->>'grund', 'ok') FROM ticket_erstattung_erfassen(pg_temp.b(p), n) r$$;

SELECT pg_temp.als('7c000000-0000-0000-0000-000000000000');
SELECT throws_ok($$SELECT pg_temp.zahl('7c', 39)$$, '42501', NULL, 'Käufer bestätigt nicht selbst');
SELECT throws_ok($$SELECT pg_temp.storno('7c', pg_temp.tk(1), 0)$$, '42501', NULL, 'Käufer storniert nicht selbst');
RESET ROLE;
SELECT pg_temp.als('7d000000-0000-0000-0000-000000000000');
SELECT throws_ok($$SELECT pg_temp.zahl('7c', 39)$$, '42501', NULL, 'Freigabe „Scannen“ reicht nicht zum Kassieren');
RESET ROLE;
SELECT pg_temp.als('7e000000-0000-0000-0000-000000000000');
SELECT throws_ok($$SELECT pg_temp.storno('7c', pg_temp.tk(1), 0)$$, '42501', NULL, 'Kasse storniert nicht');
SELECT throws_ok($$SELECT pg_temp.erst('7c', 1)$$, '42501', NULL, 'Kasse erstattet nicht');
SELECT is(ticket_erstattbar(pg_temp.b('7c')), 0::numeric, 'Kasse erfährt nichts über Erstattungen');
SELECT is(pg_temp.zahl('7c', 38), 'betrag', 'Falscher Betrag');
SELECT is(pg_temp.zahl('7c', NULL), 'betrag', 'Betrag NULL');
SELECT is(pg_temp.zahl('7c', 39), 'ok', 'Kasse bestätigt Geldeingang');
SELECT is(pg_temp.zahl('7c', 39), 'nicht_offen', 'Nicht doppelt kassierbar');
RESET ROLE;
SELECT is((SELECT (z.betrag, z.angenommen_von)::text FROM ticket_zahlungen z WHERE bestellung_id = pg_temp.b('7c')), '(39.00,7e000000-0000-0000-0000-000000000000)', 'Betrag und Person gespeichert');
SELECT is((SELECT count(DISTINCT code) FROM tickets WHERE bestellung_id = pg_temp.b('7c') AND status = 'gueltig'), 4::bigint, 'Jedes Ticket gültig mit eigenem Code');
-- andere Schule
SELECT set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claim.role', '', true);
SELECT pg_temp.als('7b000000-0000-0000-0000-000000000000');
SELECT throws_ok($$SELECT pg_temp.zahl('7e', 8)$$, '42501', NULL, 'Admin B kassiert nicht für Schule A');
SELECT throws_ok($$SELECT pg_temp.storno('7c', pg_temp.tk(1), 0)$$, '42501', NULL, 'Admin B storniert nicht für Schule A');
RESET ROLE;

SELECT pg_temp.als('7a000000-0000-0000-0000-000000000000');
SELECT is(pg_temp.storno('7c', ARRAY[]::uuid[], 0), 'auswahl', 'Storno ohne Auswahl');
SELECT is(pg_temp.storno('7e', pg_temp.tk(1), 0), 'nicht_stornierbar', 'Ticket aus anderer Bestellung');
SELECT is(pg_temp.storno('7c', pg_temp.tk(1), 15.01), 'erstattung', 'Erstattung höher als Ticketpreis');
SELECT is(pg_temp.storno('7c', pg_temp.tk(1), -1), 'erstattung', 'Negative Erstattung');
SELECT is(pg_temp.storno('7c', pg_temp.tk(1), 10), 'ok', 'Teilstorno mit Teilerstattung');
SELECT is(pg_temp.storno('7c', pg_temp.tk(1), 0), 'nicht_stornierbar', 'Nicht doppelt stornierbar');
SELECT is(ticket_erstattbar(pg_temp.b('7c')), 5::numeric, 'Rest von 5 € erstattbar');
SELECT is(pg_temp.erst('7c', 6), 'erstattung', 'Nicht mehr als offen erstatten');
SELECT is(pg_temp.erst('7c', 5), 'ok', 'Rest nachträglich erstatten');
SELECT is(pg_temp.erst('7c', 0.01), 'erstattung', 'Danach nichts mehr erstattbar');
SELECT is((SELECT status FROM ticket_bestellungen WHERE id = pg_temp.b('7c')), 'bezahlt', 'Teilstorno lässt Bestellung bezahlt');
RESET ROLE;
UPDATE tickets SET status = 'eingeloest', eingeloest_am = now() WHERE id = ANY (pg_temp.tk(2));
SELECT pg_temp.als('7a000000-0000-0000-0000-000000000000');
SELECT is(pg_temp.storno('7c', pg_temp.tk(2, 3), 0), 'nicht_stornierbar', 'Eingelöstes Ticket nicht stornierbar');
SELECT is(pg_temp.storno('7c', pg_temp.tk(3, 4), 0), 'ok', 'Rest stornieren ohne Erstattung');
SELECT is((SELECT status FROM ticket_bestellungen WHERE id = pg_temp.b('7c')), 'bezahlt', 'Mit eingelöstem Ticket bleibt sie bezahlt');
RESET ROLE;
SELECT pg_temp.als('7c000000-0000-0000-0000-000000000000');
SELECT is((ticket_info('73000000-0000-0000-0000-000000000008') - ARRAY['frist','verkauf_von','preis_normal','preis_verguenstigt','grund','ok']),
  '{"frei": 4, "max": 3, "meine": 1, "rest_verguenstigt": 2}'::jsonb, 'Storno gibt Plätze und Kontingent frei');
RESET ROLE;
-- unbezahlt stornieren / abgelaufen
SELECT pg_temp.als('7a000000-0000-0000-0000-000000000000');
SELECT is(pg_temp.storno('7e', (SELECT array_agg(id) FROM tickets WHERE bestellung_id = pg_temp.b('7e')), 8), 'erstattung', 'Unbezahltes nicht erstattbar');
RESET ROLE;
UPDATE ticket_bestellungen SET frist = now() - interval '1 minute' WHERE id = pg_temp.b('7e');
SELECT pg_temp.als('7a000000-0000-0000-0000-000000000000');
SELECT is(pg_temp.zahl('7e', 8), 'verfallen', 'Abgelaufene Reservierung nicht mehr kassierbar');
RESET ROLE;
UPDATE ticket_bestellungen SET frist = now() + interval '1 day' WHERE id = pg_temp.b('7e');
SELECT pg_temp.als('7a000000-0000-0000-0000-000000000000');
SELECT is(pg_temp.storno('7e', (SELECT array_agg(id) FROM tickets WHERE bestellung_id = pg_temp.b('7e')), 0), 'ok', 'Unbezahltes stornieren');
SELECT is((SELECT status FROM ticket_bestellungen WHERE id = pg_temp.b('7e')), 'storniert', 'Komplett stornierte Bestellung');
SELECT is(pg_temp.zahl('7e', 0), 'nicht_offen', 'Stornierte Bestellung nicht kassierbar');
SELECT throws_ok($$SELECT ticket_zahlung_bestaetigen(gen_random_uuid(), 1)$$, '42501', NULL, 'Unbekannte Bestellung');
RESET ROLE;

-- ── Eigene Tickets ──
UPDATE events SET oeffentlich = false WHERE id = '73000000-0000-0000-0000-000000000008';
SELECT pg_temp.als('7c000000-0000-0000-0000-000000000000');
SELECT is((SELECT count(*) FROM events WHERE id = '73000000-0000-0000-0000-000000000008'), 0::bigint, 'Event ist für den Käufer nicht mehr sichtbar');
SELECT is((SELECT array_agg(tk->>'status' ORDER BY tk->>'status') FROM jsonb_array_elements(meine_tickets()) b, jsonb_array_elements(b->'tickets') tk
  WHERE b->'event'->>'id' = '73000000-0000-0000-0000-000000000008'), ARRAY['eingeloest','storniert','storniert','storniert'], 'Tickets bleiben trotzdem abrufbar');
SELECT is((SELECT count(*) FROM jsonb_array_elements(meine_tickets()) b, jsonb_array_elements(b->'tickets') tk WHERE (tk->>'code' IS NOT NULL) <> (tk->>'status' IN ('gueltig', 'eingeloest'))), 0::bigint, 'Codes nur für gültige und eingelöste Tickets');
SELECT is((SELECT count(*) FROM jsonb_array_elements(meine_tickets()) b WHERE b->>'status' = 'verfallen'), 0::bigint, 'Verfallene fehlen');
RESET ROLE;
SELECT pg_temp.als('7e000000-0000-0000-0000-000000000000');
SELECT is(meine_tickets(), '[]'::jsonb, 'Kasse sieht keine fremden Tickets; unbezahlt stornierte fehlen');
RESET ROLE;

-- ── Einlass (Event 9 heute Abend, Event 10 ebenfalls, Event 8 in 30 Tagen) ──
INSERT INTO events (id, schule_id, titel, typ, beginn, oeffentlich, erstellt_von) VALUES
  ('73000000-0000-0000-0000-000000000009', '71111111-1111-1111-1111-111111111111', 'Einlass', 'konzert', now() + interval '2 hours', false, '7a000000-0000-0000-0000-000000000000'),
  ('73000000-0000-0000-0000-000000000010', '71111111-1111-1111-1111-111111111111', 'Nebenan', 'konzert', now() + interval '2 hours', false, '7a000000-0000-0000-0000-000000000000');
INSERT INTO ticket_einstellungen (event_id, aktiv, kapazitaet, preis_normal) VALUES
  ('73000000-0000-0000-0000-000000000009', true, 50, 10), ('73000000-0000-0000-0000-000000000010', true, 50, 10);
INSERT INTO ticket_freigaben (event_id, profil_id, scannen, kasse) VALUES
  ('73000000-0000-0000-0000-000000000009', '7d000000-0000-0000-0000-000000000000', true, false),
  ('73000000-0000-0000-0000-000000000009', '7e000000-0000-0000-0000-000000000000', false, true);
INSERT INTO ticket_bestellungen (id, schule_id, event_id, kaeufer_id, status) VALUES
  ('74000000-0000-0000-0000-000000000009', '71111111-1111-1111-1111-111111111111', '73000000-0000-0000-0000-000000000009', '7c000000-0000-0000-0000-000000000000', 'bezahlt'),
  ('74000000-0000-0000-0000-000000000010', '71111111-1111-1111-1111-111111111111', '73000000-0000-0000-0000-000000000010', '7c000000-0000-0000-0000-000000000000', 'bezahlt'),
  ('74000000-0000-0000-0000-000000000011', '72222222-2222-2222-2222-222222222222', '73000000-0000-0000-0000-000000000003', '7b000000-0000-0000-0000-000000000000', 'bezahlt');
INSERT INTO tickets (bestellung_id, event_id, preis, status, code) VALUES
  ('74000000-0000-0000-0000-000000000009', '73000000-0000-0000-0000-000000000009', 10, 'gueltig', 'scan-a'),
  ('74000000-0000-0000-0000-000000000009', '73000000-0000-0000-0000-000000000009', 10, 'gueltig', 'scan-b'),
  ('74000000-0000-0000-0000-000000000009', '73000000-0000-0000-0000-000000000009', 10, 'storniert', 'scan-s'),
  ('74000000-0000-0000-0000-000000000010', '73000000-0000-0000-0000-000000000010', 10, 'gueltig', 'scan-n'),
  ('74000000-0000-0000-0000-000000000011', '73000000-0000-0000-0000-000000000003', 10, 'gueltig', 'scan-fremd');
CREATE FUNCTION pg_temp.scan(p_event int, p_code text, p_id text DEFAULT NULL) RETURNS text LANGUAGE sql AS
  $$SELECT ticket_scannen(('73000000-0000-0000-0000-0000000000' || lpad(p_event::text, 2, '0'))::uuid, p_code, coalesce(p_id::uuid, gen_random_uuid()))->>'ergebnis'$$;

SELECT pg_temp.als('7c000000-0000-0000-0000-000000000000');
SELECT throws_ok($$SELECT pg_temp.scan(9, 'scan-a')$$, '42501', NULL, 'Käufer scannt nicht selbst');
SELECT is(meine_scan_events(), '[]'::jsonb, 'Ohne Freigabe keine Einlass-Veranstaltungen');
RESET ROLE;
SELECT pg_temp.als('7e000000-0000-0000-0000-000000000000');
SELECT throws_ok($$SELECT pg_temp.scan(9, 'scan-a')$$, '42501', NULL, 'Freigabe „Kasse“ reicht nicht zum Scannen');
RESET ROLE;
SELECT pg_temp.als('7b000000-0000-0000-0000-000000000000');
SELECT throws_ok($$SELECT pg_temp.scan(9, 'scan-a')$$, '42501', NULL, 'Admin B scannt nicht bei Schule A');
RESET ROLE;

SELECT pg_temp.als('7d000000-0000-0000-0000-000000000000');
SELECT is((SELECT array_agg(v->>'titel') FROM jsonb_array_elements(meine_scan_events()) v WHERE (v->>'scanbar')::boolean), ARRAY['Einlass'], 'Freigegebene Person sieht nur ihre Veranstaltung');
SELECT throws_ok($$SELECT pg_temp.scan(10, 'scan-n')$$, '42501', NULL, 'Freigabe gilt nur für ihre Veranstaltung');
SELECT is(pg_temp.scan(8, 'scan-a'), 'zu_frueh', 'Tage vorher nicht scanbar');
SELECT is(pg_temp.scan(9, 'scan-a', '7f000000-0000-0000-0000-000000000001'), 'ok', 'Erster Scan');
SELECT is(pg_temp.scan(9, 'scan-a', '7f000000-0000-0000-0000-000000000001'), 'ok', 'Wiederholung mit gleicher ID bleibt ok');
SELECT is(pg_temp.scan(9, 'scan-a'), 'schon_eingeloest', 'Zweiter Scan abgelehnt');
SELECT throws_ok($$SELECT pg_temp.scan(9, 'scan-b', '7f000000-0000-0000-0000-000000000001')$$, '22023', NULL, 'Scan-ID nicht für anderes Ticket nutzbar');
SELECT is(pg_temp.scan(9, 'scan-s'), 'storniert', 'Storniertes Ticket');
SELECT is(pg_temp.scan(9, 'scan-n'), 'falsche_veranstaltung', 'Andere Veranstaltung');
SELECT is(pg_temp.scan(9, 'scan-fremd'), 'unbekannt', 'Ticket einer anderen Schule wird nicht verraten');
SELECT is(pg_temp.scan(9, 'gibts-nicht'), 'unbekannt', 'Unbekannter Code');
SELECT is(pg_temp.scan(9, NULL), 'unbekannt', 'Code NULL');
SELECT is((SELECT ticket_scannen('73000000-0000-0000-0000-000000000009', 'scan-b', gen_random_uuid()) - 'eingeloest_am'), '{"ergebnis": "ok", "event_titel": null, "eingelassen": 2, "gesamt": 2}'::jsonb, 'Ergebnis ohne Namen und Preise, mit Zähler');
SELECT is((SELECT count(*) FROM ticket_scans), 0::bigint, 'Scanner liest das Protokoll nicht');
RESET ROLE;
SELECT is((SELECT status FROM tickets WHERE code = 'scan-n'), 'gueltig', 'Falsche Veranstaltung entwertet nicht');
SELECT is((SELECT status FROM tickets WHERE code = 'scan-fremd'), 'gueltig', 'Fremdes Ticket unverändert');
SELECT is((SELECT count(*) FROM ticket_scans WHERE event_id = '73000000-0000-0000-0000-000000000009'), 8::bigint, 'Jeder Scan einmal protokolliert');
UPDATE schul_mitgliedschaften SET aktiv = false WHERE user_id = '7d000000-0000-0000-0000-000000000000';
SELECT pg_temp.als('7d000000-0000-0000-0000-000000000000');
SELECT throws_ok($$SELECT pg_temp.scan(9, 'scan-b')$$, '42501', NULL, 'Ausgetretene Person scannt nicht mehr');
RESET ROLE;
UPDATE events SET beginn = now() - interval '13 hours' WHERE id = '73000000-0000-0000-0000-000000000010';
SELECT pg_temp.als('7a000000-0000-0000-0000-000000000000');
SELECT is(pg_temp.scan(10, 'scan-n'), 'vorbei', 'Nach der Veranstaltung nicht mehr scanbar');
RESET ROLE;

-- ── Abendkasse (Event 11 in 2 h: 5 Plätze, 15 €, Abendkasse 18 €; Event 12 morgen) ──
UPDATE schul_mitgliedschaften SET aktiv = true WHERE user_id = '7d000000-0000-0000-0000-000000000000';
INSERT INTO events (id, schule_id, titel, typ, beginn, oeffentlich, erstellt_von) VALUES
  ('73000000-0000-0000-0000-000000000011', '71111111-1111-1111-1111-111111111111', 'Abendkasse', 'konzert', now() + interval '2 hours', true, '7a000000-0000-0000-0000-000000000000'),
  ('73000000-0000-0000-0000-000000000012', '71111111-1111-1111-1111-111111111111', 'Morgen', 'konzert', now() + interval '26 hours', true, '7a000000-0000-0000-0000-000000000000');
INSERT INTO ticket_einstellungen (event_id, aktiv, kapazitaet, preis_normal, preis_verguenstigt, kontingent, preis_abendkasse) VALUES
  ('73000000-0000-0000-0000-000000000011', true, 5, 15, 8, 3, 18), ('73000000-0000-0000-0000-000000000012', true, 5, 15, 8, 3, NULL);
INSERT INTO ticket_freigaben (event_id, profil_id, scannen, kasse) VALUES
  ('73000000-0000-0000-0000-000000000011', '7e000000-0000-0000-0000-000000000000', false, true),
  ('73000000-0000-0000-0000-000000000012', '7e000000-0000-0000-0000-000000000000', false, true),
  ('73000000-0000-0000-0000-000000000011', '7d000000-0000-0000-0000-000000000000', true, false);
SELECT pg_temp.als('7c000000-0000-0000-0000-000000000000');
SELECT is((SELECT coalesce(r->>'grund', 'ok') FROM tickets_reservieren('73000000-0000-0000-0000-000000000011', 2, 16) r), 'ok', 'Reservierung für die Abendkasse');
SELECT is((SELECT coalesce(r->>'grund', 'ok') FROM tickets_reservieren('73000000-0000-0000-0000-000000000012', 1, 8) r), 'ok', 'Reservierung für morgen');
RESET ROLE;
CREATE TEMP TABLE _ak AS SELECT event_id, id FROM ticket_bestellungen WHERE event_id IN ('73000000-0000-0000-0000-000000000011', '73000000-0000-0000-0000-000000000012');
GRANT SELECT ON _ak TO authenticated;
CREATE FUNCTION pg_temp.ak(p_event int, p_n int, p_betrag numeric, p_id text DEFAULT NULL) RETURNS text LANGUAGE sql AS
  $$SELECT coalesce(r->>'grund', 'ok') FROM abendkasse_verkaufen(('73000000-0000-0000-0000-0000000000' || p_event)::uuid, p_n, p_betrag, coalesce(p_id::uuid, gen_random_uuid())) r$$;
CREATE FUNCTION pg_temp.akb(p_event int) RETURNS uuid LANGUAGE sql AS $$SELECT id FROM _ak WHERE event_id = ('73000000-0000-0000-0000-0000000000' || p_event)::uuid$$;

SELECT pg_temp.als('7c000000-0000-0000-0000-000000000000');
SELECT throws_ok($$SELECT pg_temp.ak(11, 1, 18)$$, '42501', NULL, 'Mitglied verkauft nicht');
SELECT throws_ok($$SELECT abendkasse_kassieren(pg_temp.akb(11), 16)$$, '42501', NULL, 'Mitglied kassiert nicht');
SELECT throws_ok($$SELECT abendkasse_reservierungen('73000000-0000-0000-0000-000000000011')$$, '42501', NULL, 'Mitglied sieht keine Reservierungsliste');
SELECT is(meine_kassen_events(), '[]'::jsonb, 'Ohne Freigabe keine Kasse');
RESET ROLE;
SELECT pg_temp.als('7d000000-0000-0000-0000-000000000000');
SELECT throws_ok($$SELECT abendkasse_reservierungen('73000000-0000-0000-0000-000000000011')$$, '42501', NULL, 'Scanner sieht keine Namen');
RESET ROLE;
SELECT set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claim.role', '', true);
SELECT pg_temp.als('7b000000-0000-0000-0000-000000000000');
SELECT throws_ok($$SELECT pg_temp.ak(11, 1, 18)$$, '42501', NULL, 'Admin B verkauft nicht für Schule A');
RESET ROLE;

SELECT pg_temp.als('7e000000-0000-0000-0000-000000000000');
SELECT is((SELECT array_agg(v->>'titel' || ' ' || (v->>'offen') || ' ' || (v->>'preis') || ' ' || (v->>'frei') ORDER BY v->>'beginn') FROM jsonb_array_elements(meine_kassen_events()) v WHERE v->>'titel' IN ('Abendkasse', 'Morgen')),
  ARRAY['Abendkasse true 18.00 3', 'Morgen false 15.00 4'], 'Kasse: Preis, freie Plätze, Öffnung');
SELECT is((SELECT (r->0) - 'id' FROM abendkasse_reservierungen('73000000-0000-0000-0000-000000000011') r), '{"name": "Schüler A", "status": "reserviert", "anzahl": 2, "betrag": 16.00, "ticket_ids": null}'::jsonb, 'Reservierung mit Namen');
SELECT is(pg_temp.ak(12, 1, 15), 'geschlossen', 'Am Vortag kein Abendkassenverkauf');
SELECT is(pg_temp.ak(11, 0, 0), 'anzahl', 'Anzahl 0');
SELECT is(pg_temp.ak(11, 1, 8), 'betrag', 'Keine Vergünstigung an der Abendkasse');
SELECT is(pg_temp.ak(11, 1, 15), 'betrag', 'Normalpreis reicht nicht, wenn Abendkasse teurer ist');
SELECT is(pg_temp.ak(11, 4, 72), 'zu_wenig_frei', 'Reservierte Plätze nicht verkaufbar');
SELECT is(pg_temp.ak(11, 2, 36, '7f000000-0000-0000-0000-000000000021'), 'ok', '2 verkauft');
SELECT is(pg_temp.ak(11, 2, 36, '7f000000-0000-0000-0000-000000000021'), 'ok', 'Wiederholung mit gleichem Vorgang');
SELECT throws_ok($$SELECT pg_temp.ak(11, 1, 18, '7f000000-0000-0000-0000-000000000021')$$, '22023', NULL, 'Vorgang nicht für andere Anzahl');
SELECT throws_ok($$SELECT pg_temp.ak(11, 2, 36, pg_temp.akb(11)::text)$$, '22023', NULL, 'Vorgang kapert keine fremde Bestellung');
SELECT is((SELECT abendkasse_kassieren(pg_temp.akb(11), 15)->>'grund'), 'betrag', 'Falscher Betrag');
SELECT is((SELECT abendkasse_kassieren(pg_temp.akb(11), 16)), '{"ok": true, "anzahl": 2, "eingelassen": true}'::jsonb, 'Reservierung kassiert und eingelassen, zum reservierten Preis');
SELECT is((SELECT abendkasse_kassieren(pg_temp.akb(11), 16)), '{"ok": true, "anzahl": 2, "eingelassen": true}'::jsonb, 'Wiederholung bleibt ok');
SELECT is((SELECT abendkasse_kassieren(pg_temp.akb(12), 8)), '{"ok": true, "anzahl": 1, "eingelassen": false}'::jsonb, 'Vor Öffnung: bezahlt, aber nicht eingelassen');
SELECT is((SELECT v->>'kassiert' FROM jsonb_array_elements(meine_kassen_events()) v WHERE v->>'titel' = 'Abendkasse'), '52.00', 'Eigener Kassenstand');
SELECT throws_ok($$SELECT tickets_stornieren('7f000000-0000-0000-0000-000000000021', ARRAY[gen_random_uuid()], 0)$$, '42501', NULL, 'Kasse storniert nicht');
RESET ROLE;
SELECT is((SELECT count(*) FROM ticket_zahlungen WHERE bestellung_id IN ('7f000000-0000-0000-0000-000000000021', pg_temp.akb(11))), 2::bigint, 'Je Vorgang genau eine Zahlung');
SELECT is((SELECT array_agg(DISTINCT status || an_kasse) FROM tickets WHERE event_id = '73000000-0000-0000-0000-000000000011'), ARRAY['eingeloesttrue'], 'Alle an der Kasse eingelassen');
SELECT is((SELECT status || an_kasse FROM tickets WHERE event_id = '73000000-0000-0000-0000-000000000012'), 'gueltigfalse', 'Ticket für morgen gültig mit QR');

-- vertippt: Admin storniert Kassenverkauf
SELECT pg_temp.als('7a000000-0000-0000-0000-000000000000');
SELECT is((SELECT coalesce(r->>'grund', 'ok') FROM tickets_stornieren('7f000000-0000-0000-0000-000000000021', (SELECT array_agg(id) FROM (SELECT id FROM tickets WHERE bestellung_id = '7f000000-0000-0000-0000-000000000021' LIMIT 1) q), 18) r), 'ok', 'Admin storniert Kassenticket mit Erstattung');
SELECT is(pg_temp.ak(11, 2, 36), 'ok', 'Stornierter und freier Platz wieder verkaufbar');
SELECT is(pg_temp.ak(11, 1, 18), 'zu_wenig_frei', 'Danach voll');
RESET ROLE;

-- ── Einlass per Namen (Event 13 in 2 h: 7c hat 3 bezahlte; Event 12 morgen: 1 bezahltes) ──
INSERT INTO events (id, schule_id, titel, typ, beginn, oeffentlich, erstellt_von) VALUES
  ('73000000-0000-0000-0000-000000000013', '71111111-1111-1111-1111-111111111111', 'Per Name', 'konzert', now() + interval '2 hours', true, '7a000000-0000-0000-0000-000000000000');
INSERT INTO ticket_einstellungen (event_id, aktiv, kapazitaet, preis_normal) VALUES ('73000000-0000-0000-0000-000000000013', true, 5, 15);
INSERT INTO ticket_freigaben (event_id, profil_id, scannen, kasse) VALUES
  ('73000000-0000-0000-0000-000000000013', '7e000000-0000-0000-0000-000000000000', false, true),
  ('73000000-0000-0000-0000-000000000013', '7d000000-0000-0000-0000-000000000000', true, false);
INSERT INTO ticket_bestellungen (id, schule_id, event_id, kaeufer_id, status) VALUES
  ('74000000-0000-0000-0000-000000000013', '71111111-1111-1111-1111-111111111111', '73000000-0000-0000-0000-000000000013', '7c000000-0000-0000-0000-000000000000', 'bezahlt');
INSERT INTO tickets (id, bestellung_id, event_id, preis, status, code)
SELECT ('75000000-0000-0000-0000-00000000000' || n)::uuid, '74000000-0000-0000-0000-000000000013', '73000000-0000-0000-0000-000000000013', 15, 'gueltig', 'name-' || n FROM generate_series(1, 3) n;
CREATE FUNCTION pg_temp.ein(VARIADIC p int[]) RETURNS text LANGUAGE sql AS $$SELECT coalesce(r->>'grund', 'ok ' || (r->>'anzahl'))
  FROM abendkasse_einlassen('74000000-0000-0000-0000-000000000013', (SELECT array_agg(('75000000-0000-0000-0000-00000000000' || n)::uuid) FROM unnest(p) n)) r$$;
SELECT pg_temp.als('7c000000-0000-0000-0000-000000000000');
SELECT throws_ok($$SELECT pg_temp.ein(1)$$, '42501', NULL, 'Käufer lässt sich nicht selbst ein');
RESET ROLE;
SELECT pg_temp.als('7d000000-0000-0000-0000-000000000000');
SELECT throws_ok($$SELECT pg_temp.ein(1)$$, '42501', NULL, 'Scanner lässt nicht per Namen ein');
RESET ROLE;
SELECT pg_temp.als('7e000000-0000-0000-0000-000000000000');
SELECT is((SELECT r->0->>'status' || ' ' || (r->0->>'anzahl') || ' ' || jsonb_array_length(r->0->'ticket_ids') FROM abendkasse_reservierungen('73000000-0000-0000-0000-000000000013') r), 'bezahlt 3 3', 'Bezahlte erscheinen in der Namenssuche');
SELECT is((abendkasse_reservierungen('73000000-0000-0000-0000-000000000013')::text LIKE '%name-%'), false, 'Codes werden nicht verraten');
SELECT is((SELECT abendkasse_einlassen('74000000-0000-0000-0000-000000000013', ARRAY[]::uuid[])->>'grund'), 'anzahl', 'Leere Auswahl');
SELECT is((SELECT abendkasse_einlassen(pg_temp.akb(12), (SELECT array_agg(id) FROM tickets WHERE event_id = '73000000-0000-0000-0000-000000000012'))->>'grund'), 'geschlossen', 'Am Vortag kein Einlass');
SELECT is(pg_temp.ein(1, 2), 'ok 2', 'Zwei von drei eingelassen');
SELECT is(pg_temp.ein(1, 2), 'ok 2', 'Wiederholung bleibt ok');
SELECT is(pg_temp.ein(2, 3), 'schon_drin', 'Teilweise schon drin: nichts ändern');
SELECT is((SELECT (r->0->>'anzahl') FROM abendkasse_reservierungen('73000000-0000-0000-0000-000000000013') r), '1', 'Ein Ticket bleibt offen');
SELECT throws_ok($$SELECT pg_temp.scan(13, 'name-1')$$, '42501', NULL, 'Kasse allein scannt nicht');
RESET ROLE;
SELECT pg_temp.als('7d000000-0000-0000-0000-000000000000');
SELECT is(pg_temp.scan(13, 'name-1'), 'schon_eingeloest', 'QR danach abgelehnt');
SELECT is(pg_temp.scan(13, 'name-3'), 'ok', 'Drittes per QR');
RESET ROLE;
SELECT pg_temp.als('7e000000-0000-0000-0000-000000000000');
SELECT is(pg_temp.ein(3), 'schon_drin', 'Per QR eingelassenes nicht nochmal per Namen');
RESET ROLE;

-- ── Ticketshop (Schule A, Event 14: 6 Plätze, 15 €, 2 für Mitglieder zurückgehalten, höchstens 4) ──
CREATE FUNCTION pg_temp.intern() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true), set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claim.role', 'service_role', true);
  SET LOCAL ROLE service_role;
END $$;
INSERT INTO events (id, schule_id, titel, typ, beginn, oeffentlich, erstellt_von) VALUES
  ('73000000-0000-0000-0000-000000000014', '71111111-1111-1111-1111-111111111111', 'Shop', 'konzert', now() + interval '20 days', true, '7a000000-0000-0000-0000-000000000000');
INSERT INTO ticket_einstellungen (event_id, aktiv, kapazitaet, preis_normal, preis_verguenstigt, kontingent, obergrenze, shop_aktiv, mitglieder_reserve)
VALUES ('73000000-0000-0000-0000-000000000014', true, 6, 15, 8, 3, 4, true, 2);
CREATE FUNCTION pg_temp.shop(p_n int, p_betrag numeric, p_mail text DEFAULT 'gast@example.test', p_name text DEFAULT 'Gast Eins', p_ip text DEFAULT 'ip1') RETURNS text LANGUAGE sql AS
  $$SELECT coalesce(r->>'grund', 'ok') FROM shop_reservieren('73000000-0000-0000-0000-000000000014', p_n, p_betrag, p_name, p_mail, 'de', p_ip) r$$;

-- Rechte
SELECT pg_temp.als('7a000000-0000-0000-0000-000000000000');
SELECT lives_ok($$INSERT INTO ticket_shops (schule_id, slug) VALUES ('71111111-1111-1111-1111-111111111111', 'schule-a')$$, 'Admin legt Shop an');
SELECT throws_ok($$UPDATE ticket_shops SET aktiv = true WHERE schule_id = '71111111-1111-1111-1111-111111111111'$$, '23514', NULL, 'Ohne Impressum, AGB, Datenschutz kein Shop');
SELECT throws_ok($$INSERT INTO ticket_shops (schule_id, slug) VALUES ('72222222-2222-2222-2222-222222222222', 'schule-b')$$, '42501', NULL, 'Kein Shop für fremde Schule');
SELECT is((SELECT zahlungskonto_status('71111111-1111-1111-1111-111111111111')), '{"konten": [], "verbunden": false}'::jsonb, 'Noch kein Zahlungskonto');
SELECT throws_ok($$INSERT INTO schul_zahlungskonten (schule_id, schluessel, webhook_geheim, livemode, letzte4) VALUES ('71111111-1111-1111-1111-111111111111', 'v1:x', 'v1:y', false, '1234')$$, '42501', NULL, 'Admin schreibt Schlüssel nicht direkt');
SELECT throws_ok($$SELECT shop_info('schule-a')$$, '42501', NULL, 'Shop-Funktionen nicht für Nutzer');
SELECT throws_ok($$SELECT shop_bezahlt('71111111-1111-1111-1111-111111111111', gen_random_uuid(), 'cs', 'pi', 15, 'eur')$$, '42501', NULL, 'Admin bucht keine Onlinezahlung');
SELECT throws_ok($$SELECT shop_lage('73000000-0000-0000-0000-000000000014')$$, '42501', NULL, 'Lage nicht für Nutzer');
SELECT throws_ok($$UPDATE ticket_shops SET slug = 'Nicht Erlaubt' WHERE schule_id = '71111111-1111-1111-1111-111111111111'$$, '23514', NULL, 'Ungültige Adresse');
UPDATE ticket_shops SET impressum = 'I', agb = 'A', datenschutz = 'D', aktiv = true WHERE schule_id = '71111111-1111-1111-1111-111111111111';
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true), set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claim.role', 'anon', true);
SELECT throws_ok($$SELECT shop_reservieren('73000000-0000-0000-0000-000000000014', 1, 15, 'X Y', 'a@b.de', 'de', 'ip')$$, '42501', NULL, 'Gast ruft Datenbank nicht direkt');
SELECT throws_ok($$SELECT shop_bestellung(repeat('a', 64))$$, '42501', NULL, 'Gast liest Bestellungen nicht direkt');

SELECT pg_temp.intern();
SELECT is(pg_temp.shop(1, 15), 'nicht_verfuegbar', 'Ohne Zahlungskonto kein Verkauf');
INSERT INTO schul_zahlungskonten (schule_id, schluessel, webhook_geheim, livemode, letzte4) VALUES ('71111111-1111-1111-1111-111111111111', 'v1:geheim', 'v1:geheim2', true, '4242');
RESET ROLE;
SELECT pg_temp.als('7a000000-0000-0000-0000-000000000000');
SELECT is((SELECT count(*) FROM schul_zahlungskonten), 0::bigint, 'Auch Admins lesen keine Schlüssel');
SELECT is((SELECT zahlungskonto_status('71111111-1111-1111-1111-111111111111') - 'seit'), '{"konten": [{"art": "schluessel", "aktiv": true, "letzte4": "4242", "anbieter": "stripe", "haendler": null, "livemode": true, "neu_verbinden": false}], "verbunden": true, "anbieter": "stripe", "livemode": true, "letzte4": "4242"}'::jsonb, 'Status ohne Schlüssel');
RESET ROLE;
SELECT pg_temp.als('7c000000-0000-0000-0000-000000000000');
SELECT is((SELECT count(*) FROM schul_zahlungskonten) + (SELECT count(*) FROM ticket_shops), 0::bigint, 'Mitglieder sehen weder Schlüssel noch Shop-Einstellungen');
SELECT throws_ok($$SELECT zahlungskonto_status('71111111-1111-1111-1111-111111111111')$$, '42501', NULL, 'Status nur für Admins');
RESET ROLE;

SELECT pg_temp.als('7a000000-0000-0000-0000-000000000000');
SELECT throws_ok($$SELECT shop_storno_beginnen(gen_random_uuid(), NULL, 1, gen_random_uuid(), NULL)$$, '42501', NULL, 'Admin startet Storno nicht direkt');
SELECT throws_ok($$SELECT shop_erstattung_fertig(gen_random_uuid(), '[]')$$, '42501', NULL, 'Admin bestätigt keine Erstattung');
SELECT throws_ok($$SELECT shop_erstattung_abgelehnt(gen_random_uuid(), 0)$$, '42501', NULL, 'Ablehnung nur intern');
SELECT throws_ok($$SELECT shop_erstattung_info(gen_random_uuid())$$, '42501', NULL, 'Erstattungsangaben nur intern');
SELECT throws_ok($$SELECT shop_email_aendern(gen_random_uuid(), 'a@b.de')$$, '42501', NULL, 'E-Mail ändern nur intern');
SELECT throws_ok($$SELECT shop_nochmal('schule-a', 'a@b.de', 'x')$$, '42501', NULL, 'Nochmal schicken nur intern');
SELECT throws_ok($$INSERT INTO ticket_online_erstattungen (vorgang, bestellung_id, zahlung_id, betrag) VALUES (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 5)$$, '42501', NULL, 'Niemand legt Erstattungen direkt an');
SELECT is((SELECT count(*) FROM ticket_online_erstattungen), 0::bigint, 'Lesbar für Admins');
RESET ROLE;

-- Verkauf
SELECT pg_temp.intern();
SELECT is((SELECT jsonb_array_length(shop_info('schule-a')->'events')), 1, 'Nur freigegebene Veranstaltungen im Shop');
SELECT is((SELECT (shop_info('schule-a')->'events'->0->'lage') - 'verkauf_von'), '{"ok": true, "grund": null, "max": 4, "preis": 15.00, "knapp": 4}'::jsonb, '2 Plätze bleiben für Mitglieder');
SELECT is((SELECT shop_info('gibt-es-nicht')), NULL, 'Unbekannter Shop');
SELECT is(pg_temp.shop(1, 15, 'keine-mail'), 'angaben', 'Ungültige E-Mail');
SELECT is(pg_temp.shop(1, 15, E'a@b.de\r\nBcc: x@y.de'), 'angaben', 'Keine Kopfzeilen in der E-Mail');
SELECT is(pg_temp.shop(1, 15, 'a@b.de', ' '), 'angaben', 'Name fehlt');
SELECT is(pg_temp.shop(5, 75), 'zu_wenig_frei', 'Nicht über freie Plätze');
SELECT is(pg_temp.shop(1, 8), 'betrag', 'Gäste bekommen keinen Mitgliederpreis');
SELECT is(pg_temp.shop(2, 30), 'ok', 'Gast reserviert 2');
RESET ROLE;
SELECT pg_temp.als('7a000000-0000-0000-0000-000000000000');
SELECT is((SELECT ticket_zahlung_bestaetigen(id, 30)->>'grund' FROM ticket_bestellungen WHERE kaeufer_email = 'gast@example.test'), 'nicht_offen', 'Shop-Bestellung nicht bar kassierbar');
SELECT is((SELECT abendkasse_kassieren(id, 30)->>'grund' FROM ticket_bestellungen WHERE kaeufer_email = 'gast@example.test'), 'nicht_offen', 'Auch nicht an der Abendkasse');
SELECT is((SELECT count(*) FROM ticket_zahlungen z JOIN ticket_bestellungen b ON b.id = z.bestellung_id WHERE b.kaeufer_email = 'gast@example.test'), 0::bigint, 'Keine Barzahlung gebucht');
SELECT is((SELECT status FROM ticket_bestellungen WHERE kaeufer_email = 'gast@example.test'), 'reserviert', 'Bleibt reserviert');
SELECT is(abendkasse_reservierungen('73000000-0000-0000-0000-000000000014'), '[]'::jsonb, 'Laufender Onlinekauf steht nicht in der Kassenliste');
RESET ROLE;
SELECT pg_temp.intern();
SELECT is(pg_temp.shop(1, 15), 'ok', 'Zweiter Versuch');
SELECT is(pg_temp.shop(1, 15), 'ok', 'Dritter Versuch');
SELECT is(pg_temp.shop(1, 15), 'zu_viele', 'Höchstens drei offene Vorgänge je E-Mail');
SELECT is(pg_temp.shop(1, 15, 'neu@example.test'), 'ausverkauft', 'Shop voll, Mitgliederplätze bleiben');
RESET ROLE;
SELECT pg_temp.als('7c000000-0000-0000-0000-000000000000');
SELECT is((SELECT ticket_info('73000000-0000-0000-0000-000000000014')->>'frei'), '2', 'Mitglieder sehen ihre 2 Plätze');
RESET ROLE;

SELECT pg_temp.intern();
CREATE TEMP TABLE _sh AS SELECT b.id, b.zugang, (SELECT count(*) FROM tickets t WHERE t.bestellung_id = b.id) AS n, row_number() OVER (ORDER BY (SELECT count(*) FROM tickets t WHERE t.bestellung_id = b.id) DESC, b.id) AS nr
  FROM ticket_bestellungen b WHERE event_id = '73000000-0000-0000-0000-000000000014';
GRANT SELECT ON _sh TO authenticated;
CREATE FUNCTION pg_temp.sh(p int) RETURNS uuid LANGUAGE sql AS $$SELECT id FROM _sh WHERE nr = p$$;
CREATE FUNCTION pg_temp.bez(p int, p_cs text, p_pi text, p_betrag numeric, p_schule text DEFAULT '71111111-1111-1111-1111-111111111111', p_w text DEFAULT 'eur') RETURNS text LANGUAGE sql AS
  $$SELECT shop_bezahlt(p_schule::uuid, pg_temp.sh(p), p_cs, p_pi, p_betrag, p_w)->>'ergebnis'$$;
SELECT lives_ok($$SELECT shop_checkout_setzen(pg_temp.sh(1), 'cs_1'), shop_checkout_setzen(pg_temp.sh(2), 'cs_2'), shop_checkout_setzen(pg_temp.sh(3), 'cs_3')$$, 'Bezahlvorgänge gemerkt');
SELECT throws_ok($$SELECT shop_checkout_setzen(pg_temp.sh(1), 'cs_x')$$, 'P0001', NULL, 'Bezahlvorgang nicht austauschbar');
SELECT is(pg_temp.bez(1, 'cs_2', 'pi_1', 30), 'ungueltig', 'Fremder Bezahlvorgang');
SELECT is(pg_temp.bez(1, 'cs_1', 'pi_1', 30, '72222222-2222-2222-2222-222222222222'), 'ungueltig', 'Webhook einer anderen Schule');
SELECT is(pg_temp.bez(1, 'cs_1', 'pi_1', 30, '71111111-1111-1111-1111-111111111111', 'try'), 'ungueltig', 'Andere Währung');
SELECT is((SELECT shop_bestellung((SELECT zugang FROM _sh WHERE nr = 1))->'tickets'->0->>'code'), NULL, 'Vor Zahlung kein Code');
SELECT is(pg_temp.bez(1, 'cs_1', 'pi_1', 30), 'bezahlt', 'Zahlung verbucht');
SELECT is(pg_temp.bez(1, 'cs_1', 'pi_1', 30), 'schon_bezahlt', 'Webhook doppelt: keine zweite Zahlung');
SELECT is((SELECT count(*) FROM ticket_zahlungen WHERE externe_id = 'pi_1'), 1::bigint, 'Genau eine Zahlung');
SELECT is((SELECT count(DISTINCT code) FROM tickets WHERE bestellung_id = pg_temp.sh(1) AND status = 'gueltig'), 2::bigint, 'Beide Tickets gültig mit Code');
SELECT is((SELECT shop_mail_beanspruchen(pg_temp.sh(1))), true, 'Mail einmal beanspruchen');
SELECT is((SELECT shop_mail_beanspruchen(pg_temp.sh(1))), false, 'Kein zweites Mal');
SELECT is((SELECT shop_mail_beanspruchen(pg_temp.sh(2))), false, 'Keine Mail vor der Zahlung');
SELECT is((SELECT shop_verwerfen(pg_temp.sh(1))), false, 'Bezahltes lässt sich nicht verwerfen');
SELECT is((SELECT shop_verwerfen(pg_temp.sh(2))), true, 'Abgebrochener Vorgang gibt Plätze frei');
SELECT is((SELECT shop_lage('73000000-0000-0000-0000-000000000014')->>'frei'), '1', 'Ein Platz wieder frei');
SELECT is(pg_temp.bez(2, 'cs_2', 'pi_2', 15), 'bezahlt', 'Zahlung nach Abbruch: noch Platz, also gültig');
SELECT is(pg_temp.bez(3, 'cs_3', 'pi_3', 14), 'erstatten', 'Falscher Betrag wird erstattet');
SELECT is(pg_temp.bez(3, 'cs_3', 'pi_3', 14), 'erstatten', 'Solange nicht erstattet, bleibt es zu erstatten');
SELECT lives_ok($$SELECT shop_erstattet('pi_3', 're_3', 14), shop_erstattet('pi_3', 're_3', 14)$$, 'Erstattung doppelt gemeldet');
SELECT is((SELECT count(*) FROM ticket_erstattungen WHERE externe_id = 're_3'), 1::bigint, 'Nur einmal verbucht');
SELECT is(pg_temp.bez(3, 'cs_3', 'pi_3', 14), 'schon_erstattet', 'Danach erledigt');
SELECT throws_ok($$INSERT INTO ticket_erstattungen (zahlung_id, betrag) SELECT id, 5 FROM ticket_zahlungen WHERE externe_id = 'pi_1'$$, '23514', 'ticket_erstattung_online', 'Onlinezahlung nie bar erstatten');
-- Ausverkauft und zu spät
UPDATE ticket_einstellungen SET mitglieder_reserve = 0 WHERE event_id = '73000000-0000-0000-0000-000000000014';
SELECT is(pg_temp.shop(1, 15, 'spaet@example.test', 'Spät', 'ip2'), 'ok', 'Später Gast');
INSERT INTO _sh SELECT id, zugang, 1, 4 FROM ticket_bestellungen WHERE kaeufer_email = 'spaet@example.test';
SELECT lives_ok($$SELECT shop_checkout_setzen(pg_temp.sh(4), 'cs_4')$$, 'Bezahlvorgang 4');
UPDATE ticket_bestellungen SET frist = now() - interval '1 minute' WHERE id = pg_temp.sh(4);
SELECT is(pg_temp.shop(3, 45, 'letzte@example.test', 'Letzte', 'ip3'), 'ok', 'Restliche Plätze an andere');
SELECT is((SELECT shop_bestellung((SELECT zugang FROM _sh WHERE nr = 4))->>'status'), 'verfallen', 'Abgelaufen');
SELECT is(pg_temp.bez(4, 'cs_4', 'pi_4', 15), 'erstatten', 'Zu spät und ausverkauft: erstatten statt überbuchen');
SELECT is((SELECT count(*) <= 6 FROM tickets t JOIN ticket_bestellungen b ON b.id = t.bestellung_id WHERE t.event_id = '73000000-0000-0000-0000-000000000014' AND (t.status IN ('gueltig', 'eingeloest') OR (t.status = 'reserviert' AND b.frist > now()))), true, 'Nie überbucht');
SELECT is((SELECT shop_bestellung('kurz')), NULL, 'Falscher Zugang');
DELETE FROM shop_drossel; INSERT INTO shop_drossel (ip_hash) SELECT 'ipx' FROM generate_series(1, 15);
SELECT is(pg_temp.shop(1, 15, 'bot@example.test', 'Bot', 'ipx'), 'zu_viele', 'Drossel je IP');
RESET ROLE;
SELECT pg_temp.als('7a000000-0000-0000-0000-000000000000');
SELECT throws_ok($$SELECT tickets_stornieren(pg_temp.sh(1), (SELECT array_agg(id) FROM tickets WHERE bestellung_id = pg_temp.sh(1)), 10)$$, '23514', NULL, 'Barerstattung für Onlinekauf gesperrt');
RESET ROLE;
SELECT set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claim.role', '', true);

-- ── Vergangene Veranstaltungen löschen ──
INSERT INTO events (id, schule_id, titel, typ, beginn, oeffentlich, erstellt_von) VALUES
  ('73000000-0000-0000-0000-0000000000d1', '71111111-1111-1111-1111-111111111111', 'Alt bezahlt',   'konzert', now() - interval '8 hours', true, '7a000000-0000-0000-0000-000000000000'),
  ('73000000-0000-0000-0000-0000000000d2', '71111111-1111-1111-1111-111111111111', 'Alt kostenlos', 'konzert', now() - interval '2 days', true, '7a000000-0000-0000-0000-000000000000'),
  ('73000000-0000-0000-0000-0000000000d3', '71111111-1111-1111-1111-111111111111', 'Läuft noch',    'konzert', now() - interval '1 hour', true, '7a000000-0000-0000-0000-000000000000'),
  ('73000000-0000-0000-0000-0000000000d4', '71111111-1111-1111-1111-111111111111', 'Alt Demo',      'konzert', now() - interval '2 days', true, '7a000000-0000-0000-0000-000000000000');
INSERT INTO ticket_einstellungen (event_id, aktiv, kapazitaet, preis_normal)
SELECT ('73000000-0000-0000-0000-0000000000d' || n)::uuid, true, 5, 15 FROM generate_series(1, 4) n;
INSERT INTO ticket_bestellungen (id, schule_id, event_id, kaeufer_id, status, demo)
SELECT ('74000000-0000-0000-0000-0000000000d' || n)::uuid, '71111111-1111-1111-1111-111111111111', ('73000000-0000-0000-0000-0000000000d' || n)::uuid, '7d000000-0000-0000-0000-000000000000', 'bezahlt', n = 4 FROM generate_series(1, 4) n;
INSERT INTO tickets (bestellung_id, event_id, preis, status, code)
SELECT id, event_id, 15, 'gueltig', repeat(right(id::text, 2), 16) FROM ticket_bestellungen WHERE id::text LIKE '74%d_';
INSERT INTO ticket_zahlungen (bestellung_id, betrag) VALUES
  ('74000000-0000-0000-0000-0000000000d1', 15), ('74000000-0000-0000-0000-0000000000d2', 0), ('74000000-0000-0000-0000-0000000000d4', 15);
INSERT INTO event_teilnehmer (event_id, profil_id) VALUES ('73000000-0000-0000-0000-0000000000d1', '7d000000-0000-0000-0000-000000000000');
SELECT pg_temp.als('7e000000-0000-0000-0000-000000000000');
SELECT is(event_loeschen('73000000-0000-0000-0000-0000000000d1')->>'grund', 'kein_admin', 'Lehrkraft löscht keine Veranstaltung mit Bestellungen');
RESET ROLE;
SELECT pg_temp.als('7b000000-0000-0000-0000-000000000000');
SELECT is(event_loeschen('73000000-0000-0000-0000-0000000000d1')->>'grund', 'kein_admin', 'Admin einer anderen Schule auch nicht');
RESET ROLE;
SELECT pg_temp.als('7a000000-0000-0000-0000-000000000000');
SELECT is(event_loeschen('73000000-0000-0000-0000-0000000000d3')->>'grund', 'nicht_vorbei', 'Laufende Veranstaltung bleibt');
SELECT is(event_loeschen('73000000-0000-0000-0000-0000000000d1', true), '{"ok": true, "art": "ausblenden"}', 'Vorabprüfung: bezahlt');
SELECT is(event_loeschen('73000000-0000-0000-0000-0000000000d2', true), '{"ok": true, "art": "endgueltig"}', 'Vorabprüfung: kostenlos');
SELECT is((SELECT count(*) FROM events WHERE id::text LIKE '73%d_'), 4::bigint, 'Vorabprüfung ändert nichts');
SELECT is((SELECT count(*) FROM jsonb_array_elements(meine_scan_events()) x WHERE x->>'titel' = 'Alt bezahlt'), 1::bigint, 'Vorher noch im Einlass');
SELECT throws_ok($$UPDATE events SET geloescht_am = now() WHERE id = '73000000-0000-0000-0000-0000000000d1'$$, '42501', NULL, 'geloescht_am nicht direkt setzbar');
SELECT is(event_loeschen('73000000-0000-0000-0000-0000000000d1')->>'art', 'ausblenden', 'Bezahlt: ausgeblendet');
SELECT is(event_loeschen('73000000-0000-0000-0000-0000000000d1')->>'art', 'ausblenden', 'Wiederholung ist gefahrlos');
SELECT is(event_loeschen('73000000-0000-0000-0000-0000000000d2')->>'art', 'endgueltig', 'Kostenlos: endgültig');
SELECT is(event_loeschen('73000000-0000-0000-0000-0000000000d4')->>'art', 'endgueltig', 'Nur Demo: endgültig');
SELECT is((SELECT string_agg(titel, ',') FROM events WHERE id::text LIKE '73%d_'), 'Läuft noch', 'Gelöschte sind nicht mehr sichtbar');
SELECT is((SELECT count(*) FROM jsonb_array_elements(meine_scan_events()) x WHERE x->>'titel' = 'Alt bezahlt'), 0::bigint, 'Nicht mehr im Einlass');
RESET ROLE;
SELECT pg_temp.als('7d000000-0000-0000-0000-000000000000');
SELECT is((SELECT count(*) FROM jsonb_array_elements(meine_tickets()) x WHERE x->'event'->>'titel' LIKE 'Alt%'), 0::bigint, 'Nicht mehr bei den eigenen Tickets');
RESET ROLE;
SELECT is((SELECT count(*) FROM ticket_zahlungen WHERE bestellung_id = '74000000-0000-0000-0000-0000000000d1'), 1::bigint, 'Zahlung bleibt als Beleg');
SELECT is((SELECT count(*) FROM ticket_bestellungen WHERE id IN ('74000000-0000-0000-0000-0000000000d2', '74000000-0000-0000-0000-0000000000d4')), 0::bigint, 'Bestellungen ohne Geld sind weg');
SELECT is((SELECT count(*) FROM event_teilnehmer WHERE event_id = '73000000-0000-0000-0000-0000000000d1'), 0::bigint, 'Aus Kalender-Abos entfernt');
SELECT set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claim.role', '', true);

-- Konto gelöscht: Bestellung bleibt ohne Personenbezug
DELETE FROM profiles WHERE id = '7c000000-0000-0000-0000-000000000000';
SELECT is((SELECT kaeufer_id FROM ticket_bestellungen WHERE id = '74000000-0000-0000-0000-000000000001'), NULL, 'Kontolöschung löst Käufer, Bestellung bleibt');

-- Demo-Schule mit Bestellungen löschbar
SELECT set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claim.role', '', true);
UPDATE profiles SET rolle = 'superadmin', schule_id = '72222222-2222-2222-2222-222222222222', letzte_schule_id = '72222222-2222-2222-2222-222222222222' WHERE id = '7b000000-0000-0000-0000-000000000000';
SELECT set_config('request.jwt.claims', '{"sub":"7b000000-0000-0000-0000-000000000000","role":"authenticated"}', true), set_config('request.jwt.claim.sub', '7b000000-0000-0000-0000-000000000000', true), set_config('request.jwt.claim.role', 'authenticated', true);
SELECT lives_ok($$SELECT demo_schule_loeschen('71111111-1111-1111-1111-111111111111')$$, 'Demo-Schule mit Tickets löschbar');
SELECT is((SELECT count(*) FROM ticket_bestellungen WHERE schule_id = '71111111-1111-1111-1111-111111111111'), 0::bigint, 'Bestellungen der Schule sind weg');

SELECT * FROM finish();
ROLLBACK;
