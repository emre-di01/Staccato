import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'

export const isNative = Capacitor.isNativePlatform()
export const platform = Capacitor.getPlatform() // 'android' | 'ios' | 'web'

export async function checkNativePushPermission() {
  if (!isNative) return 'web'
  const status = await PushNotifications.checkPermissions()
  return status.receive // 'granted' | 'denied' | 'prompt'
}

export async function registerNativePush(userId, supabase) {
  if (!isNative) return false

  const perm = await PushNotifications.requestPermissions()
  if (perm.receive !== 'granted') return false

  await PushNotifications.register()

  return new Promise((resolve) => {
    const regListener = PushNotifications.addListener('registration', async ({ value: token }) => {
      regListener.then(h => h.remove())
      await supabase.from('push_subscriptions').upsert(
        { user_id: userId, platform: platform, fcm_token: token },
        { onConflict: 'user_id,platform' }
      )
      resolve(true)
    })

    PushNotifications.addListener('registrationError', () => {
      resolve(false)
    })
  })
}

export async function unregisterNativePush(userId, supabase) {
  if (!isNative) return
  await PushNotifications.unregister()
  await supabase.from('push_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('platform', platform)
}

export async function isNativePushRegistered(userId, supabase) {
  if (!isNative) return false
  const { data } = await supabase
    .from('push_subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('platform', platform)
    .maybeSingle()
  return !!data
}

export function setupNativePushListeners(navigate) {
  if (!isNative) return () => {}

  const handlers = []

  PushNotifications.addListener('pushNotificationReceived', notification => {
    console.log('Push received (foreground):', notification)
  }).then(h => handlers.push(h))

  PushNotifications.addListener('pushNotificationActionPerformed', action => {
    const url = action.notification.data?.url
    if (url) {
      const path = url.replace(window.location.origin, '')
      navigate(path)
    }
  }).then(h => handlers.push(h))

  return () => handlers.forEach(h => h.remove())
}
