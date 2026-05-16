-- Abo-Pläne: neue Spalten auf schulen
-- Bestehende Schulen bekommen plan='pro' mit NULL-Limits (= unbegrenzt) damit nichts bricht.

ALTER TABLE schulen
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'pro',
  ADD COLUMN IF NOT EXISTS max_lehrer int DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS max_schueler int DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS max_storage_mb int DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS hat_vorstand bool NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS hat_inventar bool NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS abo_status text NOT NULL DEFAULT 'aktiv',
  ADD COLUMN IF NOT EXISTS abo_bis date DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS verein_verifiziert bool NOT NULL DEFAULT false;

ALTER TABLE schulen
  ADD CONSTRAINT schulen_plan_check
    CHECK (plan IN ('solo', 'starter', 'verein', 'pro', 'enterprise')),
  ADD CONSTRAINT schulen_abo_status_check
    CHECK (abo_status IN ('aktiv', 'gesperrt', 'trial'));
