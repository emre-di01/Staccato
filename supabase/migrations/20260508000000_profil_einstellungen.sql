-- Benutzereinstellungen (Theme, Dark Mode) im Profil speichern
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS thema     text    DEFAULT 'klassik',
  ADD COLUMN IF NOT EXISTS dark_mode boolean DEFAULT false;
