-- ══════════════════════════════════════════════════════════════════════
-- Fix: Schüler/Eltern sehen Daten aller Schulen nach Schulwechsel
--
-- Folgende Policies prüften Beziehungen (unterricht_schueler, eltern_schueler,
-- event_teilnehmer) ohne zu prüfen ob der Kurs/Event zur aktiven Schule gehört.
-- Fix: schule_id = meine_schule_id() per JOIN über unterricht ergänzt.
-- ══════════════════════════════════════════════════════════════════════

-- ── 1. unterricht ────────────────────────────────────────────────────
-- Schüler/Eltern sehen nur Kurse der aktiven Schule.

DROP POLICY IF EXISTS "unt: lesen" ON public.unterricht;

CREATE POLICY "unt: lesen" ON public.unterricht FOR SELECT
  USING (
    (public.meine_rolle() = ANY (ARRAY['admin'::public.user_rolle, 'superadmin'::public.user_rolle])
     AND schule_id = public.meine_schule_id())
    OR public.ist_lehrer_von_unterricht(id)
    OR (schule_id = public.meine_schule_id()
        AND EXISTS (
          SELECT 1 FROM public.unterricht_schueler
          WHERE unterricht_schueler.unterricht_id = unterricht.id
            AND unterricht_schueler.schueler_id   = auth.uid()
        ))
    OR (schule_id = public.meine_schule_id()
        AND EXISTS (
          SELECT 1 FROM public.unterricht_schueler us
          JOIN public.eltern_schueler es ON es.schueler_id = us.schueler_id
          WHERE us.unterricht_id = unterricht.id
            AND es.eltern_id     = auth.uid()
        ))
  );

-- ── 2. stunden ───────────────────────────────────────────────────────
-- Schüler/Eltern sehen nur Stunden von Kursen der aktiven Schule.
-- (Admin/Superadmin-Pfad wurde bereits in 20260510000000 gefixed.)

DROP POLICY IF EXISTS "std: lesen"        ON public.stunden;
DROP POLICY IF EXISTS "std: admin+lehrer" ON public.stunden;

CREATE POLICY "std: lesen" ON public.stunden FOR SELECT
  USING (
    (public.meine_rolle() = ANY (ARRAY['admin'::public.user_rolle, 'superadmin'::public.user_rolle])
     AND EXISTS (
       SELECT 1 FROM public.unterricht u
       WHERE u.id = stunden.unterricht_id AND u.schule_id = public.meine_schule_id()
     ))
    OR EXISTS (
      SELECT 1 FROM public.stunden_lehrer sl
      WHERE sl.stunde_id = stunden.id AND sl.lehrer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.unterricht_lehrer ul
      WHERE ul.unterricht_id = stunden.unterricht_id AND ul.lehrer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.unterricht_schueler us
      JOIN public.unterricht u ON u.id = stunden.unterricht_id
      WHERE us.unterricht_id = stunden.unterricht_id
        AND us.schueler_id   = auth.uid()
        AND u.schule_id      = public.meine_schule_id()
    )
    OR EXISTS (
      SELECT 1 FROM public.unterricht_schueler us
      JOIN public.eltern_schueler es ON es.schueler_id = us.schueler_id
      JOIN public.unterricht u ON u.id = stunden.unterricht_id
      WHERE us.unterricht_id = stunden.unterricht_id
        AND es.eltern_id     = auth.uid()
        AND u.schule_id      = public.meine_schule_id()
    )
  );

CREATE POLICY "std: admin+lehrer" ON public.stunden
  USING (
    (public.meine_rolle() = ANY (ARRAY['admin'::public.user_rolle, 'superadmin'::public.user_rolle])
     AND EXISTS (
       SELECT 1 FROM public.unterricht u
       WHERE u.id = stunden.unterricht_id AND u.schule_id = public.meine_schule_id()
     ))
    OR EXISTS (
      SELECT 1 FROM public.stunden_lehrer sl
      WHERE sl.stunde_id = stunden.id AND sl.lehrer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.unterricht_lehrer ul
      WHERE ul.unterricht_id = stunden.unterricht_id AND ul.lehrer_id = auth.uid()
    )
  )
  WITH CHECK (
    (public.meine_rolle() = ANY (ARRAY['admin'::public.user_rolle, 'superadmin'::public.user_rolle])
     AND EXISTS (
       SELECT 1 FROM public.unterricht u
       WHERE u.id = stunden.unterricht_id AND u.schule_id = public.meine_schule_id()
     ))
    OR EXISTS (
      SELECT 1 FROM public.stunden_lehrer sl
      WHERE sl.stunde_id = stunden.id AND sl.lehrer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.unterricht_lehrer ul
      WHERE ul.unterricht_id = stunden.unterricht_id AND ul.lehrer_id = auth.uid()
    )
  );

-- ── 3. unterricht_schueler ───────────────────────────────────────────
-- Schüler sehen nur eigene Einschreibungen der aktiven Schule.

DROP POLICY IF EXISTS "us: lesen"        ON public.unterricht_schueler;
DROP POLICY IF EXISTS "us: admin+lehrer" ON public.unterricht_schueler;

CREATE POLICY "us: lesen" ON public.unterricht_schueler FOR SELECT
  USING (
    (public.meine_rolle() = ANY (ARRAY['admin'::public.user_rolle, 'superadmin'::public.user_rolle])
     AND EXISTS (
       SELECT 1 FROM public.unterricht u
       WHERE u.id = unterricht_schueler.unterricht_id AND u.schule_id = public.meine_schule_id()
     ))
    OR (public.ist_lehrer_von_unterricht(unterricht_id)
        AND EXISTS (
          SELECT 1 FROM public.unterricht u
          WHERE u.id = unterricht_schueler.unterricht_id AND u.schule_id = public.meine_schule_id()
        ))
    OR (schueler_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.unterricht u
          WHERE u.id = unterricht_schueler.unterricht_id AND u.schule_id = public.meine_schule_id()
        ))
    OR (EXISTS (
          SELECT 1 FROM public.eltern_schueler
          WHERE eltern_schueler.eltern_id    = auth.uid()
            AND eltern_schueler.schueler_id  = unterricht_schueler.schueler_id
        )
        AND EXISTS (
          SELECT 1 FROM public.unterricht u
          WHERE u.id = unterricht_schueler.unterricht_id AND u.schule_id = public.meine_schule_id()
        ))
  );

CREATE POLICY "us: admin+lehrer" ON public.unterricht_schueler
  USING (
    (public.meine_rolle() = ANY (ARRAY['admin'::public.user_rolle, 'superadmin'::public.user_rolle])
     OR public.ist_lehrer_von_unterricht(unterricht_id))
    AND EXISTS (
      SELECT 1 FROM public.unterricht u
      WHERE u.id = unterricht_schueler.unterricht_id AND u.schule_id = public.meine_schule_id()
    )
  )
  WITH CHECK (
    (public.meine_rolle() = ANY (ARRAY['admin'::public.user_rolle, 'superadmin'::public.user_rolle])
     OR public.ist_lehrer_von_unterricht(unterricht_id))
    AND EXISTS (
      SELECT 1 FROM public.unterricht u
      WHERE u.id = unterricht_schueler.unterricht_id AND u.schule_id = public.meine_schule_id()
    )
  );

-- ── 4. events ────────────────────────────────────────────────────────
-- event_teilnehmer-Pfad auf aktive Schule beschränken.

DROP POLICY IF EXISTS "evt: lesen" ON public.events;

CREATE POLICY "evt: lesen" ON public.events FOR SELECT
  USING (
    (oeffentlich = true AND schule_id = public.meine_schule_id())
    OR (public.meine_rolle() = ANY (ARRAY['admin'::public.user_rolle, 'superadmin'::public.user_rolle, 'lehrer'::public.user_rolle])
        AND schule_id = public.meine_schule_id())
    OR (schule_id = public.meine_schule_id()
        AND EXISTS (
          SELECT 1 FROM public.event_teilnehmer
          WHERE event_teilnehmer.event_id   = events.id
            AND event_teilnehmer.profil_id  = auth.uid()
        ))
  );

-- ── 5. anwesenheit ───────────────────────────────────────────────────
-- Admin und Schüler sehen nur Anwesenheiten von Kursen der aktiven Schule.

DROP POLICY IF EXISTS "anw: lesen"        ON public.anwesenheit;
DROP POLICY IF EXISTS "anw: admin+lehrer" ON public.anwesenheit;

CREATE POLICY "anw: lesen" ON public.anwesenheit FOR SELECT
  USING (
    (public.meine_rolle() = ANY (ARRAY['admin'::public.user_rolle, 'superadmin'::public.user_rolle])
     AND EXISTS (
       SELECT 1 FROM public.stunden st
       JOIN public.unterricht u ON u.id = st.unterricht_id
       WHERE st.id = anwesenheit.stunde_id AND u.schule_id = public.meine_schule_id()
     ))
    OR EXISTS (
      SELECT 1 FROM public.stunden_lehrer
      WHERE stunden_lehrer.stunde_id  = anwesenheit.stunde_id
        AND stunden_lehrer.lehrer_id  = auth.uid()
    )
    OR (schueler_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.stunden st
          JOIN public.unterricht u ON u.id = st.unterricht_id
          WHERE st.id = anwesenheit.stunde_id AND u.schule_id = public.meine_schule_id()
        ))
    OR public.ist_elternteil_von(schueler_id)
  );

CREATE POLICY "anw: admin+lehrer" ON public.anwesenheit
  USING (
    (public.meine_rolle() = ANY (ARRAY['admin'::public.user_rolle, 'superadmin'::public.user_rolle])
     AND EXISTS (
       SELECT 1 FROM public.stunden st
       JOIN public.unterricht u ON u.id = st.unterricht_id
       WHERE st.id = anwesenheit.stunde_id AND u.schule_id = public.meine_schule_id()
     ))
    OR EXISTS (
      SELECT 1 FROM public.stunden_lehrer
      WHERE stunden_lehrer.stunde_id = anwesenheit.stunde_id
        AND stunden_lehrer.lehrer_id = auth.uid()
    )
  )
  WITH CHECK (
    (public.meine_rolle() = ANY (ARRAY['admin'::public.user_rolle, 'superadmin'::public.user_rolle])
     AND EXISTS (
       SELECT 1 FROM public.stunden st
       JOIN public.unterricht u ON u.id = st.unterricht_id
       WHERE st.id = anwesenheit.stunde_id AND u.schule_id = public.meine_schule_id()
     ))
    OR EXISTS (
      SELECT 1 FROM public.stunden_lehrer
      WHERE stunden_lehrer.stunde_id = anwesenheit.stunde_id
        AND stunden_lehrer.lehrer_id = auth.uid()
    )
  );

-- ── 6. nachrichten ───────────────────────────────────────────────────
-- Kurs-Nachrichten nur für Kurse der aktiven Schule anzeigen.

DROP POLICY IF EXISTS "nach: lesen" ON public.nachrichten;

CREATE POLICY "nach: lesen" ON public.nachrichten FOR SELECT
  USING (
    gesendet_von = auth.uid()
    OR empfaenger_id = auth.uid()
    OR (typ = 'broadcast'::public.nachricht_typ AND schule_id = public.meine_schule())
    OR (typ = 'kurs'::public.nachricht_typ AND kurs_id IN (
      SELECT us.unterricht_id
      FROM public.unterricht_schueler us
      JOIN public.unterricht u ON u.id = us.unterricht_id
      WHERE us.schueler_id = auth.uid() AND u.schule_id = public.meine_schule_id()
      UNION
      SELECT ul.unterricht_id
      FROM public.unterricht_lehrer ul
      JOIN public.unterricht u ON u.id = ul.unterricht_id
      WHERE ul.lehrer_id = auth.uid() AND u.schule_id = public.meine_schule_id()
    ))
  );
