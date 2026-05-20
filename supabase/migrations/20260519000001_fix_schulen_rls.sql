-- Schulen-Policy auf authentifizierte User einschränken.
-- Vorher: USING (true) ohne TO-Klausel → anon konnte alle Spalten lesen
-- (inkl. anthropic_api_key, steuernummer, ustid).
-- Beamer (/beamer) liest keine schulen-Daten → kein Anon-Zugriff nötig.
DROP POLICY IF EXISTS "schulen: lesen" ON public.schulen;

CREATE POLICY "schulen: lesen"
  ON public.schulen
  FOR SELECT
  TO authenticated
  USING (true);
