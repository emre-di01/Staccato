import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { isNative, registerNativePush, unregisterNativePush, isNativePushRegistered } from '../lib/nativePush'
import { aboAnlegen, pushErneuern } from '../lib/pushErneuern'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? ''
const DEFAULT_PUSH_PREFS = { new_message: true, event_invite: true, broadcast: true, kurs: true }

// Push-Abo dieses Geräts (Web Push oder nativ) und die Push-Einstellungen im Profil
export function usePushAbo(profil) {
  const [pushPrefs,   setPushPrefs]   = useState({ ...DEFAULT_PUSH_PREFS, ...(profil?.email_benachrichtigungen?.push ?? {}) })
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushLaden,   setPushLaden]   = useState(true)
  const unterstuetzt = isNative || (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && typeof window !== 'undefined' && 'PushManager' in window)

  useEffect(() => {
    if (!profil?.id) return
    async function checkPush() {
      try {
        if (isNative) {
          setPushEnabled(await isNativePushRegistered(profil.id, supabase))
          return
        }
        if (!unterstuetzt) { setPushEnabled(false); return }
        await pushErneuern(supabase, profil.id, VAPID_PUBLIC_KEY)
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          const { data } = await supabase.from('push_subscriptions').select('id').eq('user_id', profil.id).eq('endpoint', sub.endpoint).maybeSingle()
          setPushEnabled(!!data)
        } else {
          setPushEnabled(false)
        }
      } catch { setPushEnabled(false) }
      finally  { setPushLaden(false) }
    }
    checkPush()
  }, [profil?.id])

  async function pushToggle() {
    if (pushLaden) return
    setPushLaden(true)
    try {
      if (isNative) {
        if (pushEnabled) {
          await unregisterNativePush(profil.id, supabase)
          setPushEnabled(false)
        } else {
          setPushEnabled(await registerNativePush(profil.id, supabase))
        }
        return
      }
      const reg = await navigator.serviceWorker.ready
      if (pushEnabled) {
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          await sub.unsubscribe()
          await supabase.from('push_subscriptions').delete().eq('user_id', profil.id).eq('endpoint', sub.endpoint)
        }
        setPushEnabled(false)
      } else {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') return
        await aboAnlegen(reg, supabase, profil.id, VAPID_PUBLIC_KEY)
        setPushEnabled(true)
      }
    } catch (e) { console.error('Push toggle error:', e) }
    finally { setPushLaden(false) }
  }

  async function pushPrefToggle(key) {
    const newPrefs = { ...pushPrefs, [key]: !pushPrefs[key] }
    setPushPrefs(newPrefs)
    const prefs = profil?.email_benachrichtigungen ?? {}
    await supabase.from('profiles').update({ email_benachrichtigungen: { ...prefs, push: newPrefs } }).eq('id', profil.id)
  }

  return { pushEnabled, pushLaden, pushPrefs, pushToggle, pushPrefToggle, unterstuetzt }
}
