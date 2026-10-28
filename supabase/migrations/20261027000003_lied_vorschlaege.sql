-- Liedvorschläge: Schüler/Vorstand schlagen Lieder vor (optional mit Liedtext),
-- Lehrer/Admin entscheiden, ob das Lied ins Repertoire aufgenommen wird.
--
-- Idempotent: IF NOT EXISTS / DROP POLICY IF EXISTS / CREATE OR REPLACE.

CREATE TABLE IF NOT EXISTS public.lied_vorschlaege (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  schule_id         uuid        NOT NULL DEFAULT public.meine_schule_id() REFERENCES public.schulen(id) ON DELETE CASCADE,
  vorgeschlagen_von uuid        DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
  unterricht_id     uuid        REFERENCES public.unterricht(id) ON DELETE CASCADE,
  titel             text        NOT NULL CHECK (length(trim(titel)) > 0),
  komponist         text,
  youtube_url       text,
  liedtext          text,
  kommentar         text,
  status            text        NOT NULL DEFAULT 'offen' CHECK (status IN ('offen', 'angenommen', 'abgelehnt')),
  antwort           text,
  entschieden_von   uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  entschieden_am    timestamptz,
  stueck_id         uuid        REFERENCES public.stuecke(id) ON DELETE SET NULL,
  erstellt_am       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lied_vorschlaege_schule_status_idx ON public.lied_vorschlaege(schule_id, status);
CREATE INDEX IF NOT EXISTS lied_vorschlaege_von_idx           ON public.lied_vorschlaege(vorgeschlagen_von);
CREATE INDEX IF NOT EXISTS lied_vorschlaege_unterricht_idx    ON public.lied_vorschlaege(unterricht_id);

ALTER TABLE public.lied_vorschlaege ENABLE ROW LEVEL SECURITY;

-- Lesen: eigene Vorschläge; Admin der Schule; Lehrer der Schule (Kurs-Vorschläge nur für eigene Kurse)
DROP POLICY IF EXISTS "lv: lesen" ON public.lied_vorschlaege;
CREATE POLICY "lv: lesen" ON public.lied_vorschlaege FOR SELECT USING (
  vorgeschlagen_von = auth.uid()
  OR public.ist_admin_von_schule(schule_id)
  OR (public.meine_rolle() = 'lehrer' AND schule_id = public.meine_schule_id()
      AND (unterricht_id IS NULL OR public.ist_lehrer_von_unterricht(unterricht_id)))
);

-- Anlegen: Schüler/Vorstand für die aktive Schule, Kurs nur wenn selbst eingeschrieben
DROP POLICY IF EXISTS "lv: anlegen" ON public.lied_vorschlaege;
CREATE POLICY "lv: anlegen" ON public.lied_vorschlaege FOR INSERT WITH CHECK (
  public.meine_rolle() IN ('schueler', 'vorstand')
  AND vorgeschlagen_von = auth.uid()
  AND schule_id = public.meine_schule_id()
  AND status = 'offen' AND entschieden_von IS NULL AND stueck_id IS NULL
  AND (unterricht_id IS NULL OR EXISTS (
    SELECT 1 FROM public.unterricht_schueler us
    WHERE us.unterricht_id = lied_vorschlaege.unterricht_id AND us.schueler_id = auth.uid()))
);

-- Bearbeiten (z. B. Liedtext ergänzen) und Zurückziehen: nur eigene, solange offen
DROP POLICY IF EXISTS "lv: eigene bearbeiten" ON public.lied_vorschlaege;
CREATE POLICY "lv: eigene bearbeiten" ON public.lied_vorschlaege FOR UPDATE
  USING (vorgeschlagen_von = auth.uid() AND status = 'offen')
  WITH CHECK (vorgeschlagen_von = auth.uid() AND status = 'offen'
              AND entschieden_von IS NULL AND stueck_id IS NULL
              AND schule_id = public.meine_schule_id());

DROP POLICY IF EXISTS "lv: eigene loeschen" ON public.lied_vorschlaege;
CREATE POLICY "lv: eigene loeschen" ON public.lied_vorschlaege FOR DELETE
  USING (vorgeschlagen_von = auth.uid() AND status = 'offen');

-- Entscheiden läuft ausschließlich über lied_vorschlag_entscheiden() (SECURITY DEFINER),
-- damit Annahme + Stück-Anlage + Kurs-Verknüpfung atomar passieren.
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

  IF p_annehmen THEN
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
