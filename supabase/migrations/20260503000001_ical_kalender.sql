-- kalender_token: unique token per user for iCal subscription (no auth needed)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS kalender_token uuid DEFAULT gen_random_uuid();

-- ensure existing rows get a token
UPDATE public.profiles SET kalender_token = gen_random_uuid() WHERE kalender_token IS NULL;

-- index for fast token lookup in the Edge Function
CREATE UNIQUE INDEX IF NOT EXISTS profiles_kalender_token_idx ON public.profiles (kalender_token);

-- allow non-invited users to RSVP on public events
CREATE POLICY "etn: selbst eintragen oeffentlich"
  ON public.event_teilnehmer
  FOR INSERT
  WITH CHECK (
    profil_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.events
      WHERE id = event_id AND oeffentlich = true
    )
  );

-- allow users to update their own RSVP on public events (re-vote)
CREATE POLICY "etn: eigene stimme aendern oeffentlich"
  ON public.event_teilnehmer
  FOR UPDATE
  USING (
    profil_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.events
      WHERE id = event_id AND oeffentlich = true
    )
  );
