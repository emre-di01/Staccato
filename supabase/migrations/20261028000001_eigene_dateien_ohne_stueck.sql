-- Eigene Dateien auch ohne Stück: zentrale Seite „Meine Dateien“ erlaubt Hochladen ohne Zuordnung.
-- Idempotent: DROP NOT NULL ist wiederholbar, Policy wird neu angelegt.

ALTER TABLE public.stueck_eigene_dateien ALTER COLUMN stueck_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS stueck_eigene_dateien_schule_idx ON public.stueck_eigene_dateien(schule_id, hochgeladen_am DESC);

DROP POLICY IF EXISTS "sed: anlegen" ON public.stueck_eigene_dateien;
CREATE POLICY "sed: anlegen" ON public.stueck_eigene_dateien FOR INSERT WITH CHECK (
  besitzer_id = auth.uid()
  AND schule_id = public.meine_schule_id()
  AND split_part(bucket_pfad, '/', 1) = auth.uid()::text
  AND (stueck_id IS NULL OR EXISTS (
    SELECT 1 FROM public.stuecke st
    WHERE st.id = stueck_eigene_dateien.stueck_id AND st.schule_id = public.meine_schule_id()))
);

-- Nachträglich einem Stück zuordnen: nur Stücke der eigenen Schule
DROP POLICY IF EXISTS "sed: eigene aendern" ON public.stueck_eigene_dateien;
CREATE POLICY "sed: eigene aendern" ON public.stueck_eigene_dateien FOR UPDATE
  USING (besitzer_id = auth.uid())
  WITH CHECK (
    besitzer_id = auth.uid()
    AND split_part(bucket_pfad, '/', 1) = auth.uid()::text
    AND (stueck_id IS NULL OR EXISTS (
      SELECT 1 FROM public.stuecke st
      WHERE st.id = stueck_eigene_dateien.stueck_id AND st.schule_id = stueck_eigene_dateien.schule_id))
  );
