-- Fix: Co-Lehrer können Stunden ihres Kurses nicht sehen/bearbeiten,
-- wenn sie dem Kurs NACH der Stunden-Generierung hinzugefügt wurden.
-- Beide Policies prüfen jetzt auch unterricht_lehrer (Kurs-Ebene),
-- nicht nur stunden_lehrer (Stunden-Ebene).

DROP POLICY IF EXISTS "std: lesen"        ON public.stunden;
DROP POLICY IF EXISTS "std: admin+lehrer" ON public.stunden;

-- READ: admin/superadmin, alle Kurs-Lehrer (inkl. Co-Lehrer), Schüler des Kurses, Eltern
CREATE POLICY "std: lesen" ON public.stunden
  FOR SELECT USING (
    public.meine_rolle() = ANY (ARRAY['admin'::public.user_rolle, 'superadmin'::public.user_rolle])
    OR EXISTS (
      SELECT 1 FROM public.stunden_lehrer sl
      WHERE sl.stunde_id = stunden.id AND sl.lehrer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.unterricht_lehrer ul
      WHERE ul.unterricht_id = stunden.unterricht_id AND ul.lehrer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.unterricht_schueler us
      WHERE us.unterricht_id = stunden.unterricht_id AND us.schueler_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.unterricht_schueler us
      JOIN public.eltern_schueler es ON es.schueler_id = us.schueler_id
      WHERE us.unterricht_id = stunden.unterricht_id AND es.eltern_id = auth.uid()
    )
  );

-- WRITE (INSERT/UPDATE/DELETE): admin/superadmin oder Kurs-Lehrer (inkl. Co-Lehrer)
CREATE POLICY "std: admin+lehrer" ON public.stunden
  USING (
    public.meine_rolle() = ANY (ARRAY['admin'::public.user_rolle, 'superadmin'::public.user_rolle])
    OR EXISTS (
      SELECT 1 FROM public.stunden_lehrer sl
      WHERE sl.stunde_id = stunden.id AND sl.lehrer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.unterricht_lehrer ul
      WHERE ul.unterricht_id = stunden.unterricht_id AND ul.lehrer_id = auth.uid()
    )
  )
  WITH CHECK (
    public.meine_rolle() = ANY (ARRAY['admin'::public.user_rolle, 'superadmin'::public.user_rolle])
    OR EXISTS (
      SELECT 1 FROM public.stunden_lehrer sl
      WHERE sl.stunde_id = stunden.id AND sl.lehrer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.unterricht_lehrer ul
      WHERE ul.unterricht_id = stunden.unterricht_id AND ul.lehrer_id = auth.uid()
    )
  );
