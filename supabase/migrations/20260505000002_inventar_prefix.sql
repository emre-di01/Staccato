-- Inventar-Präfix pro Schule (z.B. "TMD" → TMD001, TMD002, ...)
ALTER TABLE schulen ADD COLUMN IF NOT EXISTS inventar_prefix text DEFAULT 'INV';
