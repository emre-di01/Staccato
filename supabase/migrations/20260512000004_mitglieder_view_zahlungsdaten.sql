-- Erweitert mitglieder_mit_email um Zahlungsdaten und Erziehungsberechtigte
DROP VIEW IF EXISTS public.mitglieder_mit_email;
CREATE VIEW public.mitglieder_mit_email
WITH (security_invoker = false)
AS
SELECT
  p.id,
  p.voller_name,
  p.rolle,
  p.schule_id,
  p.sprache,
  p.telefon,
  p.adresse,
  p.geburtsdatum,
  p.aktiv,
  p.notizen,
  p.avatar_url,
  p.kann_kurse_anlegen,
  p.iban,
  p.bic,
  p.kontoinhaber,
  p.zahlungsweise,
  p.zahlungsrhythmus,
  p.mitgliedsbeitrag,
  p.erziehungsberechtigter_name,
  p.erziehungsberechtigter_telefon,
  p.erziehungsberechtigter_email,
  p.aktualisiert_am,
  p.erstellt_am,
  u.email
FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.id
WHERE p.schule_id = public.meine_schule_id();

GRANT SELECT ON public.mitglieder_mit_email TO authenticated;
