// Beim Abmelden oder Nutzerwechsel nichts Persönliches auf dem Gerät zurücklassen
import { queryClient } from './queryClient'

export async function geraetLeeren() {
  queryClient.clear()
  try {
    sessionStorage.removeItem('staccato_schule_session')
    sessionStorage.removeItem('staccato_nach_login')
  } catch { /* gesperrt */ }
  try {
    // Zwischenspeicher früherer App-Versionen; das Programm selbst (workbox-precache) bleibt
    const namen = typeof caches === 'undefined' ? [] : await caches.keys()
    await Promise.all(namen.filter(n => !n.includes('precache')).map(n => caches.delete(n)))
  } catch { /* nicht verfügbar */ }
}

// Push dieses Browsers beenden: sonst erscheinen Nachrichten der abgemeldeten Person weiter auf dem Gerät.
// Muss vor dem Abmelden laufen (RLS) und darf es nie aufhalten.
export async function pushAbmelden(supabase, profilId) {
  if (!profilId || !('serviceWorker' in navigator) || !('PushManager' in window)) return
  const arbeit = (async () => {
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    if (!sub) return
    await supabase.from('push_subscriptions').delete().eq('user_id', profilId).eq('endpoint', sub.endpoint)
    await sub.unsubscribe()
  })()
  await Promise.race([arbeit.catch(() => {}), new Promise(r => setTimeout(r, 3000))])
}
