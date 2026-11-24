// Web-Push-Abo dieses Browsers auf den aktuellen VAPID-Schlüssel umstellen.
// Nach einem Schlüsselwechsel werden alte Abos vom Push-Dienst abgelehnt.
export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)))

// Ohne Angabe des Browsers gilt das Abo als aktuell
export function aboAktuell(sub, vapidKey) {
  const alt = sub?.options?.applicationServerKey
  if (!alt || !vapidKey) return true
  const a = new Uint8Array(alt), n = urlBase64ToUint8Array(vapidKey)
  return a.length === n.length && a.every((x, i) => x === n[i])
}

export async function aboAnlegen(reg, supabase, profilId, vapidKey) {
  const rest = await reg.pushManager.getSubscription()
  if (rest && !aboAktuell(rest, vapidKey)) await rest.unsubscribe()
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) })
  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: profilId, endpoint: sub.endpoint, p256dh: b64(sub.getKey('p256dh')), auth_key: b64(sub.getKey('auth')), platform: 'web',
  }, { onConflict: 'endpoint' })
  if (error) throw new Error(error.message)
  return sub
}

// Nur erneuern, wenn dieser Nutzer Push auf diesem Gerät eingeschaltet hatte und es noch erlaubt ist
export async function pushErneuern(supabase, profilId, vapidKey) {
  try {
    if (!vapidKey || !('serviceWorker' in navigator) || !('PushManager' in window) || Notification.permission !== 'granted') return false
    const reg = await navigator.serviceWorker.ready
    const alt = await reg.pushManager.getSubscription()
    if (!alt || aboAktuell(alt, vapidKey)) return false
    const { data } = await supabase.from('push_subscriptions').select('id').eq('user_id', profilId).eq('endpoint', alt.endpoint).maybeSingle()
    if (!data) return false
    const alterEndpoint = alt.endpoint
    await aboAnlegen(reg, supabase, profilId, vapidKey)
    await supabase.from('push_subscriptions').delete().eq('user_id', profilId).eq('endpoint', alterEndpoint)
    return true
  } catch (e) { console.warn('Push-Erneuerung:', e?.message); return false }
}
