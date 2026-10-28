-- Liedvorschläge, Teil 2: Textänderungen an bestehenden Stücken vorschlagen.
-- art = 'neu'      → neues Lied fürs Repertoire (wie bisher)
-- art = 'liedtext' → überarbeiteter Liedtext für ziel_stueck_id; Lehrer übernimmt oder lehnt ab
--
-- Idempotent: IF NOT EXISTS / DROP ... IF EXISTS / CREATE OR REPLACE.

ALTER TABLE public.lied_vorschlaege
  ADD COLUMN IF NOT EXISTS art            text NOT NULL DEFAULT 'neu',
  ADD COLUMN IF NOT EXISTS ziel_stueck_id uuid REFERENCES public.stuecke(id) ON DELETE CASCADE;

ALTER TABLE public.lied_vorschlaege DROP CONSTRAINT IF EXISTS lied_vorschlaege_art_check;
ALTER TABLE public.lied_vorschlaege ADD CONSTRAINT lied_vorschlaege_art_check CHECK (
  (art = 'neu' AND ziel_stueck_id IS NULL)
  OR (art = 'liedtext' AND ziel_stueck_id IS NOT NULL AND unterricht_id IS NULL)
);

CREATE INDEX IF NOT EXISTS lied_vorschlaege_ziel_idx ON public.lied_vorschlaege(ziel_stueck_id);

-- Anlegen: Textvorschläge nur für Stücke der eigenen Schule
DROP POLICY IF EXISTS "lv: anlegen" ON public.lied_vorschlaege;
CREATE POLICY "lv: anlegen" ON public.lied_vorschlaege FOR INSERT WITH CHECK (
  public.meine_rolle() IN ('schueler', 'vorstand')
  AND vorgeschlagen_von = auth.uid()
  AND schule_id = public.meine_schule_id()
  AND status = 'offen' AND entschieden_von IS NULL AND stueck_id IS NULL
  AND (unterricht_id IS NULL OR EXISTS (
    SELECT 1 FROM public.unterricht_schueler us
    WHERE us.unterricht_id = lied_vorschlaege.unterricht_id AND us.schueler_id = auth.uid()))
  AND (ziel_stueck_id IS NULL OR EXISTS (
    SELECT 1 FROM public.stuecke st
    WHERE st.id = lied_vorschlaege.ziel_stueck_id AND st.schule_id = public.meine_schule_id()))
);

-- Bearbeiten: Art und Ziel-Stück bleiben fest (Prüfung gegen die alte Zeile per Trigger)
CREATE OR REPLACE FUNCTION public.lied_vorschlag_ziel_fest()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  IF NEW.art IS DISTINCT FROM OLD.art OR NEW.ziel_stueck_id IS DISTINCT FROM OLD.ziel_stueck_id THEN
    RAISE EXCEPTION 'Art und Ziel-Stück eines Vorschlags sind nicht änderbar';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS lied_vorschlag_ziel_fest_trigger ON public.lied_vorschlaege;
CREATE TRIGGER lied_vorschlag_ziel_fest_trigger
  BEFORE UPDATE ON public.lied_vorschlaege
  FOR EACH ROW EXECUTE FUNCTION public.lied_vorschlag_ziel_fest();

CREATE OR REPLACE FUNCTION public.lied_vorschlag_entscheiden(
  p_vorschlag_id uuid,
  p_annehmen     boolean,
  p_antwort      text DEFAULT NULL
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v   public.lied_vorschlaege%ROWTYPE;
  v_stueck_id uuid;
BEGIN
  SELECT * INTO v FROM public.lied_vorschlaege WHERE id = p_vorschlag_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vorschlag nicht gefunden';
  END IF;

  IF NOT (
    public.ist_admin_von_schule(v.schule_id)
    OR (public.meine_rolle() = 'lehrer' AND v.schule_id = public.meine_schule_id()
        AND (v.unterricht_id IS NULL OR public.ist_lehrer_von_unterricht(v.unterricht_id)))
  ) THEN
    RAISE EXCEPTION 'Keine Berechtigung';
  END IF;

  IF v.status <> 'offen' THEN
    RAISE EXCEPTION 'Vorschlag wurde bereits entschieden';
  END IF;

  IF p_annehmen AND v.art = 'liedtext' THEN
    UPDATE public.stuecke SET liedtext = NULLIF(trim(v.liedtext), '')
    WHERE id = v.ziel_stueck_id AND schule_id = v.schule_id
    RETURNING id INTO v_stueck_id;
    IF v_stueck_id IS NULL THEN
      RAISE EXCEPTION 'Stück nicht gefunden';
    END IF;

  ELSIF p_annehmen THEN
    -- Liedtext als Plain übernehmen: Schüler tippen Zeilenumbrüche, die im Markdown-Modus zusammenfallen würden
    INSERT INTO public.stuecke (schule_id, titel, komponist, youtube_url, liedtext, liedtext_md, erstellt_von)
    VALUES (v.schule_id, v.titel, NULLIF(trim(v.komponist), ''), NULLIF(trim(v.youtube_url), ''),
            NULLIF(trim(v.liedtext), ''), false, auth.uid())
    RETURNING id INTO v_stueck_id;

    IF v.unterricht_id IS NOT NULL THEN
      INSERT INTO public.unterricht_stuecke (unterricht_id, stueck_id, status)
      VALUES (v.unterricht_id, v_stueck_id, 'geplant')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  UPDATE public.lied_vorschlaege SET
    status          = CASE WHEN p_annehmen THEN 'angenommen' ELSE 'abgelehnt' END,
    antwort         = NULLIF(trim(p_antwort), ''),
    entschieden_von = auth.uid(),
    entschieden_am  = now(),
    stueck_id       = v_stueck_id
  WHERE id = p_vorschlag_id;

  RETURN v_stueck_id;
END;
$function$;
