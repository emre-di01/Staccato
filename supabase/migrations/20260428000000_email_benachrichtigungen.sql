ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_benachrichtigungen jsonb
    NOT NULL DEFAULT '{"event_invite": true, "new_piece": true}'::jsonb;
