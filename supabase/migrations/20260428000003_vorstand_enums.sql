-- Enum-Erweiterungen müssen in einer eigenen Transaktion committed werden,
-- bevor sie in derselben Session verwendet werden können (PostgreSQL-Beschränkung).
ALTER TYPE public.user_rolle ADD VALUE IF NOT EXISTS 'vorstand';
ALTER TYPE public.event_typ  ADD VALUE IF NOT EXISTS 'vorstandssitzung';
