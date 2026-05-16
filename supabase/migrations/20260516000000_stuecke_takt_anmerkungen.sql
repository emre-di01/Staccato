-- Taktart (time signature) and Anmerkungen (internal notes) on pieces
ALTER TABLE stuecke
  ADD COLUMN IF NOT EXISTS takt        text,
  ADD COLUMN IF NOT EXISTS anmerkungen text;
