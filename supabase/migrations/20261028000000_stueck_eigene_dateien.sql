-- Eigene Dateien an Stücken: jeder Nutzer kann bei einem Stück eigene Dateien ablegen
-- (Aufnahmen, markierte Noten, Notizen …) und pro Datei die Sichtbarkeit wählen:
--   privat → nur der Besitzer
--   lehrer → Besitzer + Lehrer/Admins der Schule
--   alle   → alle Mitglieder der Schule (Lehrer/Admins dürfen zur Moderation löschen)
--
-- Eigener privater Bucket, weil die Policies von 'stueck-dateien' allen Authentifizierten Zugriff geben.
-- Pfad-Konvention: {besitzer_id}/{stueck_id}/{zufall}-{dateiname}
--
-- Idempotent: IF NOT EXISTS / ON CONFLICT / DROP POLICY IF EXISTS.

CREATE TABLE IF NOT EXISTS public.stueck_eigene_dateien (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  stueck_id      uuid        NOT NULL REFERENCES public.stuecke(id) ON DELETE CASCADE,
  schule_id      uuid        NOT NULL DEFAULT public.meine_schule_id() REFERENCES public.schulen(id) ON DELETE CASCADE,
  besitzer_id    uuid        NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  name           text        NOT NULL,
  bucket_pfad    text        NOT NULL UNIQUE,
  mime_typ       text,
  groesse        bigint,
  sichtbarkeit   text        NOT NULL DEFAULT 'privat' CHECK (sichtbarkeit IN ('privat', 'lehrer', 'alle')),
  notiz          text,
  hochgeladen_am timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stueck_eigene_dateien_stueck_idx   ON public.stueck_eigene_dateien(stueck_id);
CREATE INDEX IF NOT EXISTS stueck_eigene_dateien_besitzer_idx ON public.stueck_eigene_dateien(besitzer_id);

ALTER TABLE public.stueck_eigene_dateien ENABLE ROW LEVEL SECURITY;

-- Hilfsfunktion: darf der Aufrufer eine geteilte Datei der Schule sehen?
CREATE OR REPLACE FUNCTION public.ist_lehrkraft_von_schule(p_schule_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public
AS $function$
  SELECT public.ist_admin_von_schule(p_schule_id)
      OR (public.meine_rolle() = 'lehrer' AND p_schule_id = public.meine_schule_id());
$function$;

DROP POLICY IF EXISTS "sed: lesen" ON public.stueck_eigene_dateien;
CREATE POLICY "sed: lesen" ON public.stueck_eigene_dateien FOR SELECT USING (
  besitzer_id = auth.uid()
  OR (sichtbarkeit = 'alle'   AND schule_id = public.meine_schule_id())
  OR (sichtbarkeit IN ('lehrer', 'alle') AND public.ist_lehrkraft_von_schule(schule_id))
);

DROP POLICY IF EXISTS "sed: anlegen" ON public.stueck_eigene_dateien;
CREATE POLICY "sed: anlegen" ON public.stueck_eigene_dateien FOR INSERT WITH CHECK (
  besitzer_id = auth.uid()
  AND schule_id = public.meine_schule_id()
  AND split_part(bucket_pfad, '/', 1) = auth.uid()::text
  AND EXISTS (SELECT 1 FROM public.stuecke st WHERE st.id = stueck_eigene_dateien.stueck_id AND st.schule_id = public.meine_schule_id())
);

DROP POLICY IF EXISTS "sed: eigene aendern" ON public.stueck_eigene_dateien;
CREATE POLICY "sed: eigene aendern" ON public.stueck_eigene_dateien FOR UPDATE
  USING (besitzer_id = auth.uid())
  WITH CHECK (besitzer_id = auth.uid() AND split_part(bucket_pfad, '/', 1) = auth.uid()::text);

DROP POLICY IF EXISTS "sed: loeschen" ON public.stueck_eigene_dateien;
CREATE POLICY "sed: loeschen" ON public.stueck_eigene_dateien FOR DELETE USING (
  besitzer_id = auth.uid()
  OR (sichtbarkeit = 'alle' AND public.ist_lehrkraft_von_schule(schule_id))
);

-- ── Storage ───────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('eigene-dateien', 'eigene-dateien', false, 52428800)   -- 50 MB pro Datei
ON CONFLICT (id) DO NOTHING;

-- Hochladen nur in den eigenen Ordner
DROP POLICY IF EXISTS "eigene-dateien: hochladen" ON storage.objects;
CREATE POLICY "eigene-dateien: hochladen" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'eigene-dateien' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Lesen: eigener Ordner oder die Metadaten-Zeile ist für den Aufrufer sichtbar (RLS der Tabelle greift)
DROP POLICY IF EXISTS "eigene-dateien: lesen" ON storage.objects;
CREATE POLICY "eigene-dateien: lesen" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'eigene-dateien' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (SELECT 1 FROM public.stueck_eigene_dateien d WHERE d.bucket_pfad = storage.objects.name)
  ));

-- Löschen: eigener Ordner oder Moderation geteilter Dateien (Tabellen-RLS für DELETE gilt hier nicht,
-- daher Bedingung explizit)
DROP POLICY IF EXISTS "eigene-dateien: loeschen" ON storage.objects;
CREATE POLICY "eigene-dateien: loeschen" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'eigene-dateien' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (SELECT 1 FROM public.stueck_eigene_dateien d
               WHERE d.bucket_pfad = storage.objects.name
                 AND d.sichtbarkeit = 'alle' AND public.ist_lehrkraft_von_schule(d.schule_id))
  ));
