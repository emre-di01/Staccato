import { createClient } from '@supabase/supabase-js'
import { processLock } from '@supabase/auth-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) throw new Error('Supabase-Credentials fehlen. .env.example → .env kopieren und ausfüllen.')

// Use processLock instead of the default navigatorLock (Web Locks API).
// navigatorLock times out after 5s and uses { steal: true } as recovery, which
// causes "lock was released because another request stole it" errors on startup —
// the stolen lock's session refresh fails, Supabase clears the session from
// localStorage, and the user is redirected to login.
// processLock is a simple in-process queue with no stealing behavior.
export const supabase = createClient(url, key, {
  auth: { lock: processLock },
})
