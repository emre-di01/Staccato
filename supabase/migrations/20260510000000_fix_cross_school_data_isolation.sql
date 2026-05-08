-- ══════════════════════════════════════════════════════════════════════
-- Fix: Cross-School Data Leakage
--
-- Three tables/views returned data from ALL schools:
-- 1. stunden     — admin/superadmin saw lessons from every school
-- 2. stuecke     — every authenticated user saw pieces from every school
-- 3. mitglieder_mit_email view — security_invoker=false bypassed RLS
-- ══════════════════════════════════════════════════════════════════════

-- ── 1. stunden ───────────────────────────────────────────────────────
-- admin/superadmin now only see lessons whose course (unterricht) belongs
-- to the currently active school.

DROP POLICY IF EXISTS "std: lesen"        ON public.stunden;
DROP POLICY IF EXISTS "std: admin+lehrer" ON public.stunden;

CREATE POLICY "std: lesen" ON public.stunden FOR SELECT
  USING (
    (
      public.meine_rolle() = ANY (ARRAY['admin'::public.user_rolle, 'superadmin'::public.user_rolle])
      AND EXISTS (
        SELECT 1 FROM public.unterricht u
        WHERE u.id = stunden.unterricht_id AND u.schule_id = public.meine_schule_id()
      )
    )
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

CREATE POLICY "std: admin+lehrer" ON public.stunden
  USING (
    (
      public.meine_rolle() = ANY (ARRAY['admin'::public.user_rolle, 'superadmin'::public.user_rolle])
      AND EXISTS (
        SELECT 1 FROM public.unterricht u
        WHERE u.id = stunden.unterricht_id AND u.schule_id = public.meine_schule_id()
      )
    )
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
    (
      public.meine_rolle() = ANY (ARRAY['admin'::public.user_rolle, 'superadmin'::public.user_rolle])
      AND EXISTS (
        SELECT 1 FROM public.unterricht u
        WHERE u.id = stunden.unterricht_id AND u.schule_id = public.meine_schule_id()
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.stunden_lehrer sl
      WHERE sl.stunde_id = stunden.id AND sl.lehrer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.unterricht_lehrer ul
      WHERE ul.unterricht_id = stunden.unterricht_id AND ul.lehrer_id = auth.uid()
    )
  );

-- ── 2. stuecke ───────────────────────────────────────────────────────
-- Read: only own school; pieces without schule_id remain visible for
-- backwards compatibility until a backfill is done.
-- Write: schule_id must be set and match active school (enforced by WITH CHECK).

DROP POLICY IF EXISTS "stk: lesen"        ON public.stuecke;
DROP POLICY IF EXISTS "stk: admin+lehrer" ON public.stuecke;

CREATE POLICY "stk: lesen" ON public.stuecke FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (schule_id = public.meine_schule_id() OR schule_id IS NULL)
  );

CREATE POLICY "stk: admin+lehrer" ON public.stuecke
  USING (
    public.meine_rolle() = ANY (ARRAY['admin'::public.user_rolle, 'superadmin'::public.user_rolle, 'lehrer'::public.user_rolle])
    AND (schule_id = public.meine_schule_id() OR schule_id IS NULL)
  )
  WITH CHECK (
    public.meine_rolle() = ANY (ARRAY['admin'::public.user_rolle, 'superadmin'::public.user_rolle, 'lehrer'::public.user_rolle])
    AND schule_id = public.meine_schule_id()
  );

-- ── 3. mitglieder_mit_email ──────────────────────────────────────────
-- View runs as postgres (security_invoker=false) to access auth.users.
-- meine_schule_id() uses auth.uid() from the JWT, which is always the
-- calling user even inside a security-definer context.

CREATE OR REPLACE VIEW public.mitglieder_mit_email
WITH (security_invoker = false)
AS
SELECT
  p.id,
  p.voller_name,
  p.rolle,
  p.schule_id,
  p.sprache,
  p.telefon,
  p.adresse,
  p.geburtsdatum,
  p.aktiv,
  p.notizen,
  p.avatar_url,
  p.aktualisiert_am,
  p.erstellt_am,
  u.email
FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.id
WHERE p.schule_id = public.meine_schule_id();

GRANT SELECT ON public.mitglieder_mit_email TO authenticated;
