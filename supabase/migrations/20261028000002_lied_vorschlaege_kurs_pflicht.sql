-- Liedvorschläge (art = 'neu') müssen an einen Kurs gebunden sein.
-- Textänderungen (art = 'liedtext') bleiben am Stück, ohne Kurs.
--
-- NOT VALID: ältere Test-Vorschläge ohne Kurs (nur dev) bleiben bestehen, alle neuen
-- und geänderten Zeilen werden geprüft.

ALTER TABLE public.lied_vorschlaege DROP CONSTRAINT IF EXISTS lied_vorschlaege_art_check;
ALTER TABLE public.lied_vorschlaege ADD CONSTRAINT lied_vorschlaege_art_check CHECK (
  (art = 'neu' AND ziel_stueck_id IS NULL AND unterricht_id IS NOT NULL)
  OR (art = 'liedtext' AND ziel_stueck_id IS NOT NULL AND unterricht_id IS NULL)
) NOT VALID;
