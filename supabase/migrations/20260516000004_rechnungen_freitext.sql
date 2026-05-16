-- Freitext-Rechnungen mit Positionen (Beschreibung × Menge × Einzelpreis)

ALTER TABLE public.rechnungen
  ADD COLUMN IF NOT EXISTS typ        text  NOT NULL DEFAULT 'mitgliedsbeitrag'
    CHECK (typ IN ('mitgliedsbeitrag', 'freitext')),
  ADD COLUMN IF NOT EXISTS positionen jsonb;
