-- Self-service account deletion: user deletes their own auth account + all data
CREATE OR REPLACE FUNCTION mein_konto_loeschen()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Nicht authentifiziert';
  END IF;
  DELETE FROM auth.users WHERE id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION mein_konto_loeschen() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mein_konto_loeschen() TO authenticated;
