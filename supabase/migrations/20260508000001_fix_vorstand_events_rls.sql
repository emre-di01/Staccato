-- Fix: Vorstand kann Events der eigenen Schule sehen + RSVP geben

-- Events lesen: vorstand sieht alle Events der eigenen Schule
DROP POLICY IF EXISTS "evt: lesen" ON public.events;
CREATE POLICY "evt: lesen" ON public.events FOR SELECT USING (
  oeffentlich = true
  OR meine_rolle() = ANY (ARRAY['admin'::public.user_rolle, 'superadmin'::public.user_rolle, 'lehrer'::public.user_rolle])
  OR (meine_rolle() = 'vorstand'::public.user_rolle AND meine_schule_id() = schule_id)
  OR EXISTS (
    SELECT 1 FROM public.event_teilnehmer
    WHERE event_teilnehmer.event_id = events.id
      AND event_teilnehmer.profil_id = auth.uid()
  )
);

-- event_teilnehmer lesen: vorstand kann seine eigene Einladungs-/RSVP-Zeile lesen
DROP POLICY IF EXISTS "etn: lesen" ON public.event_teilnehmer;
CREATE POLICY "etn: lesen" ON public.event_teilnehmer FOR SELECT USING (
  profil_id = auth.uid()
  OR meine_rolle() = ANY (ARRAY['admin'::public.user_rolle, 'superadmin'::public.user_rolle, 'lehrer'::public.user_rolle])
);

-- RSVP für vorstand: eintragen + ändern (auch bei nicht-öffentlichen Events, wenn eingeladen)
DROP POLICY IF EXISTS "etn: vorstand rsvp" ON public.event_teilnehmer;
CREATE POLICY "etn: vorstand rsvp" ON public.event_teilnehmer
  FOR ALL
  USING (profil_id = auth.uid() AND meine_rolle() = 'vorstand'::public.user_rolle)
  WITH CHECK (profil_id = auth.uid() AND meine_rolle() = 'vorstand'::public.user_rolle);
