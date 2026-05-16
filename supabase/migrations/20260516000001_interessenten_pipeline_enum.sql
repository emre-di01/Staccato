-- Neue Pipeline-Stufen für interessenten.status
-- Eigene Datei: PostgreSQL kann neue Enum-Werte nicht im selben
-- Transaction verwenden, in dem sie hinzugefügt wurden.

ALTER TYPE public.schueler_status ADD VALUE IF NOT EXISTS 'kontaktiert';
ALTER TYPE public.schueler_status ADD VALUE IF NOT EXISTS 'angebot';
ALTER TYPE public.schueler_status ADD VALUE IF NOT EXISTS 'verloren';
