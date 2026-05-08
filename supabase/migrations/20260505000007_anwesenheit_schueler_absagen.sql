-- Schüler dürfen eigene Entschuldigungen eintragen und wieder löschen.
-- Nur status = 'entschuldigt' erlaubt — kein anwesend/abwesend selbst setzen.

CREATE POLICY "anw: schueler entschuldigen"
  ON public.anwesenheit
  FOR INSERT
  WITH CHECK (
    schueler_id = auth.uid()
    AND status = 'entschuldigt'
  );

CREATE POLICY "anw: schueler entschuldigung rueckgaengig"
  ON public.anwesenheit
  FOR DELETE
  USING (
    schueler_id = auth.uid()
    AND status = 'entschuldigt'
  );
