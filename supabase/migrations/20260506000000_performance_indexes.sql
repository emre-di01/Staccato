-- Performance indexes for frequently-queried columns not covered by existing indexes

-- Nachrichten: sorted by gesendet_am on every page load
CREATE INDEX IF NOT EXISTS nachrichten_gesendet_am_idx
  ON public.nachrichten (gesendet_am DESC);

-- Nachrichten: FK join on gesendet_von in the SELECT
CREATE INDEX IF NOT EXISTS nachrichten_gesendet_von_idx
  ON public.nachrichten (gesendet_von);

-- nachricht_gelesen: PK is (nachricht_id, user_id), but user_id alone has no index
-- needed when checking all messages a user has read
CREATE INDEX IF NOT EXISTS nachricht_gelesen_user_id_idx
  ON public.nachricht_gelesen (user_id);

-- stueck_dateien: queried by stueck_id on every StueckDetail load
CREATE INDEX IF NOT EXISTS stueck_dateien_stueck_id_idx
  ON public.stueck_dateien (stueck_id);

-- unterricht_stuecke: PK prefix covers unterricht_id lookups, but stueck_id reverse-lookups have no index
CREATE INDEX IF NOT EXISTS unterricht_stuecke_stueck_id_idx
  ON public.unterricht_stuecke (stueck_id);

-- stunden: composite covers the common KursDetail pattern eq(unterricht_id) + order(beginn) in one scan
-- more efficient than using the two separate existing indexes
CREATE INDEX IF NOT EXISTS stunden_unterricht_id_beginn_idx
  ON public.stunden (unterricht_id, beginn DESC);

-- mitglied_dateien: queried and filtered by profil_id in Mitgliederverwaltung
CREATE INDEX IF NOT EXISTS mitglied_dateien_profil_id_idx
  ON public.mitglied_dateien (profil_id);

-- instrumente: filtered by schule_id + aktiv on every Kursverwaltung / KursDetail load
CREATE INDEX IF NOT EXISTS instrumente_schule_id_aktiv_idx
  ON public.instrumente (schule_id, aktiv);
