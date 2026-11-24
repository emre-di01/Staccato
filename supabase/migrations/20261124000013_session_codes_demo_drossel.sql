-- Laufende Live-Stunden (samt Beitrittscode) waren für jeden lesbar, auch ohne Anmeldung.
-- Jetzt: Teilnehmer und Kurslehrer; Starter, Admins und Kursschüler weiter über "sess: lesen",
-- öffentliche Stunden für Gäste weiter über "sess: anon öffentlich lesen".
CREATE OR REPLACE FUNCTION public.ist_session_teilnehmer(p_session_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.session_teilnehmer WHERE session_id = p_session_id AND profil_id = auth.uid());
$$;

DROP POLICY IF EXISTS "sess: join code" ON public.unterricht_sessions;
DROP POLICY IF EXISTS "sess: teilnehmer lesen" ON public.unterricht_sessions;
CREATE POLICY "sess: teilnehmer lesen" ON public.unterricht_sessions FOR SELECT TO authenticated
  USING (public.ist_session_teilnehmer(id) OR public.ist_lehrer_von_unterricht(unterricht_id));

-- Demo-Anfragen nur noch über die Function (mit Drossel), nicht mehr direkt über die API
DROP POLICY IF EXISTS "demo_anfragen: anon insert" ON public.demo_anfragen;
ALTER TABLE public.demo_anfragen ADD COLUMN IF NOT EXISTS ip_hash text;
