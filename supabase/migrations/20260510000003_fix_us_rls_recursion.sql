-- Fix: us: lesen und us: admin+lehrer hatten EXISTS (SELECT FROM unterricht),
-- während unt: lesen EXISTS (SELECT FROM unterricht_schueler) enthält.
-- Das erzeugt eine RLS-Rekursion → keine Kurse mehr sichtbar.
--
-- Lösung: unterricht_schueler-Policies lesen NICHT zurück in unterricht.
-- Der Schulfilter für Schüler/Admins greift auf der unterricht-Ebene
-- (unt: lesen, unt: admin) – das reicht für korrekte Isolation.

DROP POLICY IF EXISTS "us: lesen"        ON public.unterricht_schueler;
DROP POLICY IF EXISTS "us: admin+lehrer" ON public.unterricht_schueler;

CREATE POLICY "us: lesen" ON public.unterricht_schueler FOR SELECT
  USING (
    schueler_id = auth.uid()
    OR public.meine_rolle() = ANY (ARRAY['admin'::public.user_rolle, 'superadmin'::public.user_rolle])
    OR public.ist_lehrer_von_unterricht(unterricht_id)
    OR EXISTS (
      SELECT 1 FROM public.eltern_schueler
      WHERE eltern_schueler.eltern_id    = auth.uid()
        AND eltern_schueler.schueler_id  = unterricht_schueler.schueler_id
    )
  );

CREATE POLICY "us: admin+lehrer" ON public.unterricht_schueler
  USING (
    public.meine_rolle() = ANY (ARRAY['admin'::public.user_rolle, 'superadmin'::public.user_rolle])
    OR public.ist_lehrer_von_unterricht(unterricht_id)
  )
  WITH CHECK (
    public.meine_rolle() = ANY (ARRAY['admin'::public.user_rolle, 'superadmin'::public.user_rolle])
    OR public.ist_lehrer_von_unterricht(unterricht_id)
  );
