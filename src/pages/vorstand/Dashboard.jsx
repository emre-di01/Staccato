import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'

function StatCard({ icon, label, wert, farbe = 'var(--primary)', onClick }) {
  return (
    <div onClick={onClick} style={{
      background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
      padding: '20px 24px', border: '1px solid var(--border)',
      boxShadow: 'var(--shadow)', cursor: onClick ? 'pointer' : 'default',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 500, marginBottom: 8 }}>{label}</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: farbe, letterSpacing: '-1px' }}>{wert ?? '–'}</div>
        </div>
        <div style={{ fontSize: 28 }}>{icon}</div>
      </div>
    </div>
  )
}

export default function VorstandDashboard() {
  const { profil, T } = useApp()
  const navigate = useNavigate()
  const [stats, setStats] = useState({ offeneAufgaben: 0, ziele: 0, protokolle: 0, naechsteSitzung: null })
  const [laden, setLaden] = useState(true)

  const jetzt = new Date()
  const stunde = jetzt.getHours()
  const gruss = stunde < 12 ? T('greeting_morning') : stunde < 17 ? T('greeting_day') : T('greeting_evening')

  useEffect(() => {
    if (!profil?.schule_id) return
    async function ladeStats() {
      const [aufgabenRes, zieleRes, protokolleRes, sitzungRes] = await Promise.all([
        supabase.from('vorstand_aufgaben')
          .select('id', { count: 'exact', head: true })
          .eq('schule_id', profil.schule_id)
          .in('status', ['offen', 'in_bearbeitung']),
        supabase.from('vorstand_ziele')
          .select('id', { count: 'exact', head: true })
          .eq('schule_id', profil.schule_id),
        supabase.from('vorstand_protokolle')
          .select('id', { count: 'exact', head: true })
          .eq('schule_id', profil.schule_id),
        supabase.from('vorstand_protokolle')
          .select('id, titel, datum, sitzungstyp')
          .eq('schule_id', profil.schule_id)
          .gte('datum', new Date().toISOString().slice(0, 10))
          .order('datum')
          .limit(1),
      ])
      setStats({
        offeneAufgaben: aufgabenRes.count ?? 0,
        ziele: zieleRes.count ?? 0,
        protokolle: protokolleRes.count ?? 0,
        naechsteSitzung: sitzungRes.data?.[0] ?? null,
      })
      setLaden(false)
    }
    ladeStats()
  }, [profil])

  const TYP_LABEL = {
    vorstandssitzung: T('vorstand_typ_vorstandssitzung'),
    mitgliederversammlung: T('vorstand_typ_mitgliederversammlung'),
    sonstiges: T('vorstand_typ_sonstiges'),
  }

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 4 }}>{gruss}</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px', margin: 0 }}>
          {profil?.voller_name}
        </h1>
        <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 6 }}>Vorstandsbereich</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
        <StatCard icon="✅" label={T('vorstand_offene_aufgaben')} wert={laden ? '…' : stats.offeneAufgaben}
          farbe="var(--accent)" onClick={() => navigate('/vorstand/ziele')} />
        <StatCard icon="🎯" label={T('vorstand_ziele')} wert={laden ? '…' : stats.ziele}
          farbe="var(--primary)" onClick={() => navigate('/vorstand/ziele')} />
        <StatCard icon="📝" label={T('vorstand_protokolle')} wert={laden ? '…' : stats.protokolle}
          farbe="#7c3aed" onClick={() => navigate('/vorstand/protokolle')} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }} className="dashboard-grid">
        {/* Schnellzugriff */}
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 14 }}>Schnellzugriff</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { icon: '🎯', label: T('vorstand_ziele'), sub: 'Ziele und Aufgaben verwalten', to: '/vorstand/ziele', farbe: 'var(--primary)' },
              { icon: '📝', label: T('vorstand_protokolle'), sub: 'Protokolle erstellen und ablegen', to: '/vorstand/protokolle', farbe: '#7c3aed' },
              { icon: '📅', label: 'Stundenplan', sub: 'Eigene Kurse und Termine', to: '/vorstand/stundenplan', farbe: 'var(--accent)' },
            ].map(item => (
              <div key={item.to} onClick={() => navigate(item.to)} style={{
                background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '14px 16px',
                border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <div style={{ fontSize: 24, width: 40, height: 40, borderRadius: 'var(--radius)', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {item.icon}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{item.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{item.sub}</div>
                </div>
                <div style={{ marginLeft: 'auto', color: 'var(--text-3)', fontSize: 18 }}>→</div>
              </div>
            ))}
          </div>
        </div>

        {/* Nächste Sitzung */}
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 14 }}>{T('vorstand_naechste_sitzung')}</h2>
          {laden ? (
            <div style={s.leer}>{T('loading')}</div>
          ) : stats.naechsteSitzung ? (
            <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '16px', border: '1px solid var(--accent)', boxShadow: 'var(--shadow)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                {TYP_LABEL[stats.naechsteSitzung.sitzungstyp]}
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{stats.naechsteSitzung.titel}</div>
              <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 6 }}>
                📅 {new Date(stats.naechsteSitzung.datum).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
          ) : (
            <div style={s.leer}>Keine geplanten Sitzungen.</div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .dashboard-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

const s = {
  leer: { padding: '24px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13, background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' },
}
