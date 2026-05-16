-- DSGVO Art. 17 Abs. 3 lit. b + §257 HGB:
-- Rechnungen dürfen bei Kontolöschung nicht physisch gelöscht werden.
-- FK schueler_id von ON DELETE CASCADE → ON DELETE SET NULL ändern.
-- Rechnungen bleiben erhalten (empfaenger_snapshot enthält alle Pflichtangaben).

DO $$
DECLARE v_con text;
BEGIN
  SELECT tc.constraint_name INTO v_con
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema    = kcu.table_schema
  WHERE tc.table_schema   = 'public'
    AND tc.table_name     = 'rechnungen'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name   = 'schueler_id'
  LIMIT 1;

  IF v_con IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.rechnungen DROP CONSTRAINT ' || quote_ident(v_con);
  END IF;
END $$;

ALTER TABLE public.rechnungen
  ADD CONSTRAINT rechnungen_schueler_id_fkey
    FOREIGN KEY (schueler_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
