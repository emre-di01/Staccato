-- Datenschutz-Fix: mitglieder_mit_email läuft mit Owner-Rechten (security_invoker=false)
-- und filterte nur nach Schule. Dadurch konnte JEDER angemeldete Nutzer der Schule
-- (auch Schüler) per API IBAN, BIC, E-Mail, Geburtsdatum, Adresse, Notizen und
-- Erziehungsberechtigten-Daten aller Mitglieder lesen.
-- Jetzt gleicher Zugriff wie die RLS-Policy "profiles: lesen":
-- eigene Zeile, Admin/Superadmin der Schule, Lehrer der eigenen Schüler.
-- Achtung: Definition in seed.sql synchron halten.
CREATE OR REPLACE VIEW public.mitglieder_mit_email
WITH (security_invoker = false)
AS
SELECT
  p.id, p.voller_name, p.rolle, p.schule_id, p.sprache, p.telefon, p.adresse,
  p.geburtsdatum, p.aktiv, p.notizen, p.avatar_url, p.kann_kurse_anlegen,
  p.iban, p.bic, p.kontoinhaber, p.zahlungsweise, p.zahlungsrhythmus, p.mitgliedsbeitrag,
  p.erziehungsberechtigter_name, p.erziehungsberechtigter_telefon, p.erziehungsberechtigter_email,
  p.aktualisiert_am, p.erstellt_am,
  u.email
FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.id
WHERE p.schule_id = public.meine_schule_id()
  AND (
    p.id = auth.uid()
    OR public.meine_rolle() IN ('admin', 'superadmin')
    OR public.ist_lehrer_von_schueler(p.id)
  );
