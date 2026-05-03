-- Add zeitzone column (queried by AppContext but missing from initial schema)
ALTER TABLE public.schulen
  ADD COLUMN IF NOT EXISTS zeitzone text DEFAULT 'Europe/Berlin';

-- Allow admin and superadmin to update their own school's settings.
-- The existing "schulen: sadmin" policy only covers superadmin for all operations.
-- Without this policy, the SchulEinstellungen component silently fails for admin.
CREATE POLICY "schulen: admin update"
  ON public.schulen
  FOR UPDATE
  USING (
    public.meine_rolle() = ANY (ARRAY['admin'::public.user_rolle, 'superadmin'::public.user_rolle])
    AND id = public.meine_schule_id()
  )
  WITH CHECK (
    public.meine_rolle() = ANY (ARRAY['admin'::public.user_rolle, 'superadmin'::public.user_rolle])
    AND id = public.meine_schule_id()
  );
