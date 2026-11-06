-- Kurslehrer dürfen Anwesenheit lesen, auch ohne stunden_lehrer-Eintrag.
-- stunden und anwesenheit_erfassen() erlauben Kurslehrern schon den Zugriff, die Lese-Policy aber nicht:
-- für vergangene Stunden nach einem Lehrerwechsel kam die Anwesenheit leer zurück, das Formular zeigte
-- alle als „da“ und Speichern überschrieb die echten Werte.

DROP POLICY IF EXISTS "anw: lesen" ON public.anwesenheit;

CREATE POLICY "anw: lesen" ON public.anwesenheit FOR SELECT
  USING (
    (public.meine_rolle() = ANY (ARRAY['admin'::public.user_rolle, 'superadmin'::public.user_rolle])
     AND EXISTS (
       SELECT 1 FROM public.stunden st
       JOIN public.unterricht u ON u.id = st.unterricht_id
       WHERE st.id = anwesenheit.stunde_id AND u.schule_id = public.meine_schule_id()
     ))
    OR EXISTS (
      SELECT 1 FROM public.stunden_lehrer
      WHERE stunden_lehrer.stunde_id  = anwesenheit.stunde_id
        AND stunden_lehrer.lehrer_id  = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.stunden st
      JOIN public.unterricht_lehrer ul ON ul.unterricht_id = st.unterricht_id
      WHERE st.id = anwesenheit.stunde_id AND ul.lehrer_id = auth.uid()
    )
    OR (schueler_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.stunden st
          JOIN public.unterricht u ON u.id = st.unterricht_id
          WHERE st.id = anwesenheit.stunde_id AND u.schule_id = public.meine_schule_id()
        ))
    OR public.ist_elternteil_von(schueler_id)
  );
