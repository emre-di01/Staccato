-- Add demo fields to schulen
ALTER TABLE schulen
  ADD COLUMN IF NOT EXISTS ist_demo        boolean     DEFAULT false,
  ADD COLUMN IF NOT EXISTS demo_expires_at timestamptz;

-- demo_anfragen table
CREATE TABLE IF NOT EXISTS demo_anfragen (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  email        text NOT NULL,
  schul_name   text NOT NULL,
  beschreibung text,
  status       text NOT NULL DEFAULT 'ausstehend'
               CHECK (status IN ('ausstehend', 'genehmigt', 'abgelehnt')),
  erstellt_am  timestamptz DEFAULT now(),
  genehmigt_am timestamptz,
  schule_id    uuid REFERENCES schulen(id) ON DELETE SET NULL
);

ALTER TABLE demo_anfragen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demo_anfragen: anon insert"
  ON demo_anfragen FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "demo_anfragen: superadmin all"
  ON demo_anfragen FOR ALL TO authenticated
  USING (meine_rolle() = 'superadmin')
  WITH CHECK (meine_rolle() = 'superadmin');

-- demo_schule_loeschen: deletes auth users then the school
CREATE OR REPLACE FUNCTION demo_schule_loeschen(p_schule_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  FOR v_user_id IN
    SELECT user_id FROM schul_mitgliedschaften WHERE schule_id = p_schule_id
  LOOP
    PERFORM delete_auth_user(v_user_id);
  END LOOP;
  DELETE FROM schulen WHERE id = p_schule_id;
END;
$$;

-- demo_bereinigen: cleans up expired demo schools
CREATE OR REPLACE FUNCTION demo_bereinigen()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_schule_id uuid;
  v_count     integer := 0;
BEGIN
  FOR v_schule_id IN
    SELECT id FROM schulen
    WHERE ist_demo = true AND demo_expires_at < now()
  LOOP
    PERFORM demo_schule_loeschen(v_schule_id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

SELECT cron.schedule(
  'demo-bereinigen',
  '0 4 * * *',
  $$SELECT demo_bereinigen()$$
);
