-- Fix: "stk: anon öffentlich lesen" used EXISTS on unterricht_stuecke, which has no anon
-- SELECT policy. The EXISTS always returned false → anon saw no pieces.
-- New policy checks unterricht_sessions.aktuelles_stueck directly (anon policy exists there).
-- Guests can only see the piece the teacher is currently presenting.

DROP POLICY IF EXISTS "stk: anon öffentlich lesen" ON stuecke;

CREATE POLICY "stk: anon öffentlich lesen"
  ON stuecke FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM unterricht_sessions
      WHERE aktuelles_stueck = stuecke.id
        AND oeffentlich = true
        AND status = 'aktiv'
    )
  );
