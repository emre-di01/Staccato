-- Make VAPID-specific columns nullable (FCM entries don't need them)
ALTER TABLE push_subscriptions
  ALTER COLUMN endpoint  DROP NOT NULL,
  ALTER COLUMN p256dh    DROP NOT NULL,
  ALTER COLUMN auth_key  DROP NOT NULL;

-- Add platform + FCM token columns
ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS platform  text NOT NULL DEFAULT 'web'
    CHECK (platform IN ('web', 'android', 'ios')),
  ADD COLUMN IF NOT EXISTS fcm_token text;

-- Unique token per user per platform (native)
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_user_platform_idx
  ON push_subscriptions (user_id, platform)
  WHERE platform IN ('android', 'ios');
