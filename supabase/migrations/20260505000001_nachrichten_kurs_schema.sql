-- Add kurs_id column to nachrichten
ALTER TABLE "public"."nachrichten"
  ADD COLUMN IF NOT EXISTS "kurs_id" uuid REFERENCES "public"."unterricht"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "nachrichten_kurs_id_idx" ON "public"."nachrichten" USING btree ("kurs_id");

-- Update read policy to include course participants
DROP POLICY IF EXISTS "nach: lesen" ON "public"."nachrichten";
CREATE POLICY "nach: lesen" ON "public"."nachrichten" FOR SELECT USING (
  ("gesendet_von" = "auth"."uid"()) OR
  ("empfaenger_id" = "auth"."uid"()) OR
  ("typ" = 'broadcast'::"public"."nachricht_typ" AND "public"."meine_schule"() = "schule_id") OR
  ("typ" = 'kurs'::"public"."nachricht_typ" AND "kurs_id" IN (
    SELECT "unterricht_id" FROM "public"."unterricht_schueler" WHERE "schueler_id" = "auth"."uid"()
    UNION
    SELECT "unterricht_id" FROM "public"."unterricht_lehrer"  WHERE "lehrer_id"   = "auth"."uid"()
  ))
);
