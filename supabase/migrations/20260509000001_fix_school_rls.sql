-- Fix RLS: admin/superadmin sehen nur Daten der aktiven Schule
-- meine_schule_id() liest letzte_schule_id, ist also nach schuleWechseln() korrekt

-- ── profiles ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "profiles: admin" ON public.profiles;
CREATE POLICY "profiles: admin" ON public.profiles
  USING  (public.meine_rolle() IN ('admin','superadmin') AND schule_id = public.meine_schule_id())
  WITH CHECK (public.meine_rolle() IN ('admin','superadmin') AND schule_id = public.meine_schule_id());

DROP POLICY IF EXISTS "profiles: lesen" ON public.profiles;
CREATE POLICY "profiles: lesen" ON public.profiles FOR SELECT
  USING (
    id = auth.uid()
    OR (public.meine_rolle() IN ('admin','superadmin') AND schule_id = public.meine_schule_id())
    OR public.ist_lehrer_von_schueler(id)
    OR public.ist_elternteil_von(id)
  );

-- ── unterricht ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "unt: admin" ON public.unterricht;
CREATE POLICY "unt: admin" ON public.unterricht
  USING  (public.meine_rolle() IN ('admin','superadmin') AND schule_id = public.meine_schule_id())
  WITH CHECK (public.meine_rolle() IN ('admin','superadmin') AND schule_id = public.meine_schule_id());

DROP POLICY IF EXISTS "unt: lesen" ON public.unterricht;
CREATE POLICY "unt: lesen" ON public.unterricht FOR SELECT
  USING (
    (public.meine_rolle() IN ('admin','superadmin') AND schule_id = public.meine_schule_id())
    OR public.ist_lehrer_von_unterricht(id)
    OR EXISTS (
      SELECT 1 FROM public.unterricht_schueler
      WHERE unterricht_id = unterricht.id AND schueler_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.unterricht_schueler us
      JOIN public.eltern_schueler es ON es.schueler_id = us.schueler_id
      WHERE us.unterricht_id = unterricht.id AND es.eltern_id = auth.uid()
    )
  );
