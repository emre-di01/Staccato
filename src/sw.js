import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'

self.skipWaiting()
clientsClaim()
// Nur das Programm selbst wird zwischengespeichert. Antworten der API und Dateien nie: Der Zwischenspeicher
// kennt keine Nutzer, auf gemeinsam genutzten Geräten wären sie für die nächste Person sichtbar.
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Reste früherer Versionen entfernen
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all(['supabase-data', 'supabase-storage'].map(n => caches.delete(n))))
})

self.addEventListener('push', event => {
  if (!event.data) return
  let data = {}
  try { data = event.data.json() } catch { return }
  const title = data.title || 'Staccato'
  const body  = data.body  || ''
  const url   = data.url   || '/'
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:  '/icon-192.png',
      badge: '/icon-192.png',
      data:  { url },
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const match = list.find(c => c.url.startsWith(self.location.origin))
      if (match) return match.focus()
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
