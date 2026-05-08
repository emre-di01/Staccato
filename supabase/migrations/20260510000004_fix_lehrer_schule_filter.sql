-- Fix: unt: lesen – Lehrer-Pfad hatte keinen Schulfilter.
-- Ein Nutzer, der in Schule A Lehrer und in Schule B Schüler ist,
-- sah nach Schulwechsel zu B noch die Kurse aus A.

DROP POLICY IF EXISTS "unt: lesen" ON public.unterricht;

CREATE POLICY "unt: lesen" ON public.unterricht FOR SELECT
  USING (
    (public.meine_rolle() = ANY (ARRAY['admin'::public.user_rolle, 'superadmin'::public.user_rolle])
     AND schule_id = public.meine_schule_id())
    OR (public.ist_lehrer_von_unterricht(id)
        AND schule_id = public.meine_schule_id())
    OR (schule_id = public.meine_schule_id()
        AND EXISTS (
          SELECT 1 FROM public.unterricht_schueler
          WHERE unterricht_schueler.unterricht_id = unterricht.id
            AND unterricht_schueler.schueler_id   = auth.uid()
        ))
    OR (schule_id = public.meine_schule_id()
        AND EXISTS (
          SELECT 1 FROM public.unterricht_schueler us
          JOIN public.eltern_schueler es ON es.schueler_id = us.schueler_id
          WHERE us.unterricht_id = unterricht.id
            AND es.eltern_id     = auth.uid()
        ))
  );
