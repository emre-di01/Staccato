-- Invoice Capture: Beleg-/Rechnungsdatei an Ausgaben anhängen

-- 1. Spalte auf ausgaben
ALTER TABLE public.ausgaben
  ADD COLUMN IF NOT EXISTS beleg_pfad text;

-- 2. Storage-Bucket anlegen (privat)
INSERT INTO storage.buckets (id, name, public)
VALUES ('ausgaben-dateien', 'ausgaben-dateien', false)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage-Policies
DO $$ BEGIN
  CREATE POLICY "ausgaben-dateien: admin upload"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'ausgaben-dateien'
      AND public.meine_rolle() IN ('admin','superadmin')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "ausgaben-dateien: admin lesen"
    ON storage.objects FOR SELECT
    USING (
      bucket_id = 'ausgaben-dateien'
      AND public.meine_rolle() IN ('admin','superadmin')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "ausgaben-dateien: admin loeschen"
    ON storage.objects FOR DELETE
    USING (
      bucket_id = 'ausgaben-dateien'
      AND public.meine_rolle() IN ('admin','superadmin')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
