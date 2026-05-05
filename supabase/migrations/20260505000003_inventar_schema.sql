-- ── Enums ─────────────────────────────────────────────────────────────────
CREATE TYPE inventar_zustand AS ENUM ('neu', 'gut', 'gebraucht', 'defekt');

-- ── Kategorien (benutzerdefiniert pro Schule) ─────────────────────────────
CREATE TABLE inventar_kategorien (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schule_id   uuid NOT NULL REFERENCES schulen(id) ON DELETE CASCADE,
  name        text NOT NULL,
  icon        text NOT NULL DEFAULT '📦',
  erstellt_am timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX inventar_kategorien_schule_idx ON inventar_kategorien(schule_id);

ALTER TABLE inventar_kategorien ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventar_kategorien: admin vorstand all" ON inventar_kategorien
  FOR ALL
  USING  (schule_id = meine_schule_id() AND meine_rolle() IN ('admin', 'superadmin', 'vorstand'))
  WITH CHECK (schule_id = meine_schule_id() AND meine_rolle() IN ('admin', 'superadmin', 'vorstand'));

-- ── Inventar-Tabelle ──────────────────────────────────────────────────────
CREATE TABLE inventar (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  schule_id        uuid        NOT NULL REFERENCES schulen(id) ON DELETE CASCADE,
  kategorie_id     uuid        REFERENCES inventar_kategorien(id) ON DELETE SET NULL,
  laufnummer       integer     NOT NULL,
  inventarnummer   text        NOT NULL,
  name             text        NOT NULL,
  hersteller       text,
  seriennummer     text,
  barcode          text,
  kaufdatum        date,
  anschaffungswert numeric(10,2),
  zustand          inventar_zustand NOT NULL DEFAULT 'gut',
  notizen          text,
  erstellt_am      timestamptz NOT NULL DEFAULT now(),
  aktualisiert_am  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX inventar_schule_idx   ON inventar(schule_id);
CREATE INDEX inventar_barcode_idx  ON inventar(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX inventar_kategorie_idx ON inventar(kategorie_id);

-- ── Auto-Inventarnummer ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION inventar_nummer_vergeben()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_prefix     text;
  v_laufnummer integer;
BEGIN
  SELECT COALESCE(NULLIF(TRIM(inventar_prefix), ''), 'INV')
  INTO v_prefix
  FROM schulen WHERE id = NEW.schule_id;

  SELECT COALESCE(MAX(laufnummer), 0) + 1
  INTO v_laufnummer
  FROM inventar WHERE schule_id = NEW.schule_id;

  NEW.laufnummer     := v_laufnummer;
  NEW.inventarnummer := v_prefix || LPAD(v_laufnummer::text, 3, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER inventar_nummer_trigger
  BEFORE INSERT ON inventar
  FOR EACH ROW EXECUTE FUNCTION inventar_nummer_vergeben();

-- ── RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE inventar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventar: all roles" ON inventar
  FOR ALL
  USING  (schule_id = meine_schule_id() AND meine_rolle() IN ('admin', 'superadmin', 'vorstand'))
  WITH CHECK (schule_id = meine_schule_id() AND meine_rolle() IN ('admin', 'superadmin', 'vorstand'));
