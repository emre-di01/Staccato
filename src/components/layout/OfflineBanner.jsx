import { useState, useEffect } from 'react'

export default function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine)
  useEffect(() => {
    const on  = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online',  on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  if (!offline) return null
  return (
    <div style={{ background: '#92400e', color: '#fef3c7', fontSize: 13, fontWeight: 600, textAlign: 'center', padding: '8px 16px', flexShrink: 0 }}>
      📵 Offline – Inhalte werden aus dem Cache geladen
    </div>
  )
}
