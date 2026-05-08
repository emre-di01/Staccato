CREATE TABLE IF NOT EXISTS nachricht_geloescht (
  nachricht_id uuid REFERENCES nachrichten(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES profiles(id)    ON DELETE CASCADE,
  geloescht_am timestamptz DEFAULT now(),
  PRIMARY KEY (nachricht_id, user_id)
);

ALTER TABLE nachricht_geloescht ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Eigene Loeschmarkierungen" ON nachricht_geloescht
  FOR ALL USING (user_id = auth.uid());
