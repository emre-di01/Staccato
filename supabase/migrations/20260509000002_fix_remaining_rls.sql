-- Fix RLS: raeume, instrumente, interessenten, events auf Schulgrenze einschränken

-- ── raeume ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "raeume: admin" ON public.raeume;
CREATE POLICY "raeume: admin" ON public.raeume
  USING  (public.meine_rolle() IN ('admin','superadmin') AND schule_id = public.meine_schule_id())
  WITH CHECK (public.meine_rolle() IN ('admin','superadmin') AND schule_id = public.meine_schule_id());

DROP POLICY IF EXISTS "raeume: lesen" ON public.raeume;
CREATE POLICY "raeume: lesen" ON public.raeume FOR SELECT
  USING (auth.uid() IS NOT NULL AND schule_id = public.meine_schule_id());

-- ── instrumente ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "instr: admin" ON public.instrumente;
CREATE POLICY "instr: admin" ON public.instrumente
  USING  (public.meine_rolle() IN ('admin','superadmin') AND schule_id = public.meine_schule_id())
  WITH CHECK (public.meine_rolle() IN ('admin','superadmin') AND schule_id = public.meine_schule_id());

DROP POLICY IF EXISTS "instr: lesen" ON public.instrumente;
CREATE POLICY "instr: lesen" ON public.instrumente FOR SELECT
  USING (auth.uid() IS NOT NULL AND schule_id = public.meine_schule_id());

-- ── interessenten ────────────────────────────────────────────────
DROP POLICY IF EXISTS "int: admin+lehrer" ON public.interessenten;
CREATE POLICY "int: admin+lehrer" ON public.interessenten
  USING  (public.meine_rolle() IN ('admin','superadmin','lehrer') AND schule_id = public.meine_schule_id())
  WITH CHECK (public.meine_rolle() IN ('admin','superadmin','lehrer') AND schule_id = public.meine_schule_id());

-- ── events ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "evt: admin+lehrer" ON public.events;
CREATE POLICY "evt: admin+lehrer" ON public.events
  USING  (public.meine_rolle() IN ('admin','superadmin','lehrer') AND schule_id = public.meine_schule_id())
  WITH CHECK (public.meine_rolle() IN ('admin','superadmin','lehrer') AND schule_id = public.meine_schule_id());

DROP POLICY IF EXISTS "evt: lesen" ON public.events;
CREATE POLICY "evt: lesen" ON public.events FOR SELECT
  USING (
    (oeffentlich = true AND schule_id = public.meine_schule_id())
    OR (public.meine_rolle() IN ('admin','superadmin','lehrer') AND schule_id = public.meine_schule_id())
    OR EXISTS (
      SELECT 1 FROM public.event_teilnehmer
      WHERE event_id = events.id AND profil_id = auth.uid()
    )
  );
