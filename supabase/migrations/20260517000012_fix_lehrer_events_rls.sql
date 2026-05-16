-- Fix: Lehrer sehen nur öffentliche Events, eigene Events oder Events wo sie Teilnehmer sind

-- evt: admin+lehrer → nur noch admin/superadmin (Lehrer hat eigene Policy)
DROP POLICY IF EXISTS "evt: admin+lehrer" ON public.events;
CREATE POLICY "evt: admin+lehrer" ON public.events
  USING  (public.meine_rolle() IN ('admin','superadmin') AND schule_id = public.meine_schule_id())
  WITH CHECK (public.meine_rolle() IN ('admin','superadmin') AND schule_id = public.meine_schule_id());

-- evt: lehrer write → darf Events anlegen/bearbeiten/löschen die er selbst erstellt hat
DROP POLICY IF EXISTS "evt: lehrer" ON public.events;
CREATE POLICY "evt: lehrer" ON public.events
  USING  (
    public.meine_rolle() = 'lehrer'
    AND schule_id = public.meine_schule_id()
    AND typ != 'vorstandssitzung'
    AND erstellt_von = auth.uid()
  )
  WITH CHECK (
    public.meine_rolle() = 'lehrer'
    AND schule_id = public.meine_schule_id()
    AND typ != 'vorstandssitzung'
  );

-- evt: lesen → lehrer/schueler/eltern nur öffentliche oder eigene oder als Teilnehmer eingeladene Events
DROP POLICY IF EXISTS "evt: lesen" ON public.events;
CREATE POLICY "evt: lesen" ON public.events FOR SELECT USING (
  -- admin/superadmin sehen alles der eigenen Schule
  (public.meine_rolle() IN ('admin','superadmin') AND schule_id = public.meine_schule_id())
  -- vorstand sieht alle Events der eigenen Schule
  OR (public.meine_rolle() = 'vorstand' AND schule_id = public.meine_schule_id())
  -- öffentliche Events der eigenen Schule (nie vorstandssitzung)
  OR (oeffentlich = true AND schule_id = public.meine_schule_id() AND typ != 'vorstandssitzung')
  -- eigene erstellte Events (lehrer)
  OR (public.meine_rolle() = 'lehrer' AND erstellt_von = auth.uid() AND schule_id = public.meine_schule_id())
  -- als Teilnehmer eingeladen
  OR EXISTS (
    SELECT 1 FROM public.event_teilnehmer
    WHERE event_id = events.id AND profil_id = auth.uid()
  )
);
