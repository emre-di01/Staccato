-- Prod-Drift beheben (gefunden beim Schema-Vergleich prod ↔ dev am 2026-10-27)
--
-- Auf prod waren einige ältere Migrationen als angewendet verbucht, aber nicht (vollständig) gelaufen,
-- weil deploy.sh Fehler ignorierte. Diese Migration stellt den Stand her, den dev bereits hat:
--
-- 1. escalate_priv(): vom Angreifer angelegte Event-Trigger-Funktion (nie an einen Event-Trigger
--    gebunden, also nie aktiv). Siehe docs/security-incident-2026-10-27.md
-- 2. stunden-Policies mit Schulfilter für admin/superadmin bzw. schueler/eltern
--    (eigentlich aus 20260510000000_fix_cross_school_data_isolation.sql)
--
-- Auf dev ein No-op: identische Definitionen werden neu angelegt.
-- Die Policy "rech: admin" (rechnungen) wird bewusst NICHT angefasst (Rechnungen derzeit ungenutzt).

DROP FUNCTION IF EXISTS public.escalate_priv();

DROP POLICY IF EXISTS "std: admin+lehrer" ON public.stunden;
CREATE POLICY "std: admin+lehrer" ON "public"."stunden" USING (((("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"])) AND (EXISTS ( SELECT 1
   FROM "public"."unterricht" "u"
  WHERE (("u"."id" = "stunden"."unterricht_id") AND ("u"."schule_id" = "public"."meine_schule_id"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."stunden_lehrer" "sl"
  WHERE (("sl"."stunde_id" = "stunden"."id") AND ("sl"."lehrer_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."unterricht_lehrer" "ul"
  WHERE (("ul"."unterricht_id" = "stunden"."unterricht_id") AND ("ul"."lehrer_id" = "auth"."uid"())))))) WITH CHECK (((("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"])) AND (EXISTS ( SELECT 1
   FROM "public"."unterricht" "u"
  WHERE (("u"."id" = "stunden"."unterricht_id") AND ("u"."schule_id" = "public"."meine_schule_id"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."stunden_lehrer" "sl"
  WHERE (("sl"."stunde_id" = "stunden"."id") AND ("sl"."lehrer_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."unterricht_lehrer" "ul"
  WHERE (("ul"."unterricht_id" = "stunden"."unterricht_id") AND ("ul"."lehrer_id" = "auth"."uid"()))))));

DROP POLICY IF EXISTS "std: lesen" ON public.stunden;
CREATE POLICY "std: lesen" ON "public"."stunden" FOR SELECT USING (((("public"."meine_rolle"() = ANY (ARRAY['admin'::"public"."user_rolle", 'superadmin'::"public"."user_rolle"])) AND (EXISTS ( SELECT 1
   FROM "public"."unterricht" "u"
  WHERE (("u"."id" = "stunden"."unterricht_id") AND ("u"."schule_id" = "public"."meine_schule_id"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."stunden_lehrer" "sl"
  WHERE (("sl"."stunde_id" = "stunden"."id") AND ("sl"."lehrer_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."unterricht_lehrer" "ul"
  WHERE (("ul"."unterricht_id" = "stunden"."unterricht_id") AND ("ul"."lehrer_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM ("public"."unterricht_schueler" "us"
     JOIN "public"."unterricht" "u" ON (("u"."id" = "stunden"."unterricht_id")))
  WHERE (("us"."unterricht_id" = "stunden"."unterricht_id") AND ("us"."schueler_id" = "auth"."uid"()) AND ("u"."schule_id" = "public"."meine_schule_id"())))) OR (EXISTS ( SELECT 1
   FROM (("public"."unterricht_schueler" "us"
     JOIN "public"."eltern_schueler" "es" ON (("es"."schueler_id" = "us"."schueler_id")))
     JOIN "public"."unterricht" "u" ON (("u"."id" = "stunden"."unterricht_id")))
  WHERE (("us"."unterricht_id" = "stunden"."unterricht_id") AND ("es"."eltern_id" = "auth"."uid"()) AND ("u"."schule_id" = "public"."meine_schule_id"()))))));
