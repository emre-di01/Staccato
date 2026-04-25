import { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase'

function StatCard({ icon, label, value, color = 'var(--primary)', sub }) {
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
      padding: '20px 24px', border: '1px solid var(--border)',
      boxShadow: 'var(--shadow)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 500, marginBottom: 8 }}>{label}</div>
          <div style={{ fontSize: 32, fontWeight: 800, color, letterSpacing: '-1px' }}>{value ?? '–'}</div>
          {sub && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>{sub}</div>}
        </div>
        <div style={{ fontSize: 28 }}>{icon}</div>
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const { profil, T } = useApp()
  const [stats, setStats] = useState(null)
  const [laden, setLaden] = useState(true)

  useEffect(() => {
    async function ladeStats() {
      const { data } = await supabase.rpc('dashboard_stats')
      setStats(data)
      setLaden(false)
    }
    ladeStats()
  }, [])

  const jetzt = new Date()
  const stunde = jetzt.getHours()
  const gruss = stunde < 12 ? '☀️ Guten Morgen' : stunde < 17 ? '👋 Guten Tag' : '🌙 Guten Abend'

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 4 }}>{gruss}</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px', margin: 0 }}>
          {profil?.voller_name}
        </h1>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        <StatCard icon="🎓" label={T('students_total')}  value={laden ? '…' : stats?.schueler_gesamt}   color="var(--accent)" />
        <StatCard icon="👨‍🏫" label={T('teachers_total')} value={laden ? '…' : stats?.lehrer_gesamt}    color="var(--primary)" />
        <StatCard icon="🎵" label={T('classes_active')}  value={laden ? '…' : stats?.unterricht_aktiv}  color="var(--success)" />
        <StatCard icon="📅" label={T('lessons_today')}   value={laden ? '…' : stats?.stunden_heute}     color="var(--warning)" />
        <StatCard icon="📊" label={T('attendance_rate')} value={laden ? '…' : stats?.anwesenheit_quote ? `${stats.anwesenheit_quote}%` : '–'} color="var(--accent)" />
        <StatCard icon="💰" label={T('revenue_month')}   value={laden ? '…' : stats?.einnahmen_monat ? `€${stats.einnahmen_monat}` : '€0'} color="var(--success)" />
        <StatCard icon="📋" label={T('prospects_open')}  value={laden ? '…' : stats?.interessenten}     color="var(--primary)" />
        <StatCard icon="📅" label={T('lessons_week')}    value={laden ? '…' : stats?.stunden_woche}     color="var(--text-2)" />
      </div>

      {/* Upcoming Events */}
      {stats?.naechste_events?.length > 0 && (
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>
            {T('upcoming_events')}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {stats.naechste_events.map(ev => (
              <div key={ev.id} style={{
                background: 'var(--surface)', borderRadius: 'var(--radius)',
                padding: '14px 18px', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <div style={{ fontSize: 20 }}>
                  {ev.typ === 'konzert' ? '🎭' : ev.typ === 'vorspiel' ? '🎼' : ev.typ === 'pruefung' ? '📝' : '📅'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{ev.titel}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                    {new Date(ev.beginn).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: 'var(--bg-2)', color: 'var(--text-3)', textTransform: 'capitalize' }}>
                  {T(`event_${ev.typ}`)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
