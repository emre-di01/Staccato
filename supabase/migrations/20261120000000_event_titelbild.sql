-- Titelbild (Plakat/Flyer) für Veranstaltungen
-- Pfad im Bucket event-bilder: <schule_id>/<event_id>/<zeitstempel>.jpg
-- Lesen: alle Mitglieder der aktiven Schule. Schreiben/Löschen: Admin der Schule
-- oder die Lehrkraft, die das Event angelegt hat (wie beim Bearbeiten des Events).

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS bild_pfad text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('event-bilder', 'event-bilder', false)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.darf_eventbild(p_schule text, p_event text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id::text = p_event AND e.schule_id::text = p_schule
      AND (public.ist_admin_von_schule(e.schule_id)
           OR (public.meine_rolle() = 'lehrer' AND e.schule_id = public.meine_schule_id()
               AND e.erstellt_von = auth.uid() AND e.typ <> 'vorstandssitzung')));
$function$;

DO $$ BEGIN
  CREATE POLICY "event-bilder: lesen" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'event-bilder' AND (storage.foldername(name))[1] = public.meine_schule_id()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "event-bilder: hochladen" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'event-bilder' AND public.darf_eventbild((storage.foldername(name))[1], (storage.foldername(name))[2]));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "event-bilder: loeschen" ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'event-bilder' AND public.darf_eventbild((storage.foldername(name))[1], (storage.foldername(name))[2]));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
