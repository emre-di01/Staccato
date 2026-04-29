-- ─── Vorstandsmodul Migration ────────────────────────────────
-- Ausführen im Supabase SQL Editor oder via Supabase CLI

-- Tabelle: Ziele des Vorstands
CREATE TABLE IF NOT EXISTS vorstand_ziele (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  schule_id           uuid REFERENCES schulen(id) ON DELETE CASCADE NOT NULL,
  titel               text NOT NULL,
  beschreibung        text,
  zeitraum_typ        text CHECK (zeitraum_typ IN ('jahr', 'quartal')) DEFAULT 'jahr',
  zeitraum_wert       text,  -- z.B. "2026" oder "2026-Q1"
  verantwortlicher_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status              text CHECK (status IN ('offen', 'in_bearbeitung', 'erledigt')) DEFAULT 'offen',
  erstellt_von        uuid REFERENCES profiles(id) ON DELETE SET NULL,
  erstellt_am         timestamptz DEFAULT now()
);

-- Tabelle: Aufgaben (je Ziel zugeordnet oder frei)
CREATE TABLE IF NOT EXISTS vorstand_aufgaben (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  schule_id           uuid REFERENCES schulen(id) ON DELETE CASCADE NOT NULL,
  ziel_id             uuid REFERENCES vorstand_ziele(id) ON DELETE SET NULL,
  titel               text NOT NULL,
  beschreibung        text,
  verantwortlicher_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  faellig_am          date,
  status              text CHECK (status IN ('offen', 'in_bearbeitung', 'erledigt')) DEFAULT 'offen',
  erstellt_von        uuid REFERENCES profiles(id) ON DELETE SET NULL,
  erstellt_am         timestamptz DEFAULT now()
);

-- Tabelle: Protokolle / Sitzungsberichte
CREATE TABLE IF NOT EXISTS vorstand_protokolle (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  schule_id           uuid REFERENCES schulen(id) ON DELETE CASCADE NOT NULL,
  titel               text NOT NULL,
  sitzungstyp         text CHECK (sitzungstyp IN ('vorstandssitzung', 'mitgliederversammlung', 'sonstiges')) DEFAULT 'vorstandssitzung',
  datum               date NOT NULL,
  teilnehmer_ids      uuid[] DEFAULT '{}',
  beschluesse         text,
  inhalt              text,
  erstellt_von        uuid REFERENCES profiles(id) ON DELETE SET NULL,
  erstellt_am         timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS vorstand_ziele_schule_idx     ON vorstand_ziele(schule_id);
CREATE INDEX IF NOT EXISTS vorstand_aufgaben_schule_idx  ON vorstand_aufgaben(schule_id);
CREATE INDEX IF NOT EXISTS vorstand_aufgaben_ziel_idx    ON vorstand_aufgaben(ziel_id);
CREATE INDEX IF NOT EXISTS vorstand_protokolle_schule_idx ON vorstand_protokolle(schule_id);
CREATE INDEX IF NOT EXISTS vorstand_protokolle_datum_idx  ON vorstand_protokolle(datum DESC);

-- Row Level Security aktivieren
ALTER TABLE vorstand_ziele     ENABLE ROW LEVEL SECURITY;
ALTER TABLE vorstand_aufgaben  ENABLE ROW LEVEL SECURITY;
ALTER TABLE vorstand_protokolle ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Zugriff für vorstand, admin, superadmin der gleichen Schule
CREATE POLICY "vorstand_ziele_zugriff" ON vorstand_ziele
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND rolle IN ('vorstand', 'admin', 'superadmin')
        AND schule_id = vorstand_ziele.schule_id
    )
  );

CREATE POLICY "vorstand_aufgaben_zugriff" ON vorstand_aufgaben
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND rolle IN ('vorstand', 'admin', 'superadmin')
        AND schule_id = vorstand_aufgaben.schule_id
    )
  );

CREATE POLICY "vorstand_protokolle_zugriff" ON vorstand_protokolle
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND rolle IN ('vorstand', 'admin', 'superadmin')
        AND schule_id = vorstand_protokolle.schule_id
    )
  );
