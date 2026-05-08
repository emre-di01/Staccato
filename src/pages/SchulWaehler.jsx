import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { startseiteNach } from '../components/ProtectedRoute'
import { useState } from 'react'

const ROLLEN_FARBE = {
  admin:      '#6366f1',
  superadmin: '#ef4444',
  lehrer:     '#3b82f6',
  schueler:   '#10b981',
  eltern:     '#f59e0b',
  vorstand:   '#7c3aed',
}

export default function SchulWaehler() {
  const { schulenListe, schuleWechseln, schule, rolle, T } = useApp()
  const navigate = useNavigate()
  const [wechseln, setWechseln] = useState(null)

  async function handleWahl(schule_id) {
    if (wechseln) return
    setWechseln(schule_id)
    try {
      await schuleWechseln(schule_id)
      sessionStorage.setItem('staccato_schule_session', '1')
      // rolle ist nach schuleWechseln aktualisiert
      // Warte kurz damit AppContext die neue Rolle hat
      navigate('/', { replace: true })
    } catch (e) {
      console.error(e)
    } finally {
      setWechseln(null)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: 24, fontFamily: "'Outfit','DM Sans',sans-serif",
    }}>
      <div style={{ width: '100%', maxWidth: 520 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎵</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.5px' }}>
            {T('choose_school')}
          </h1>
          <p style={{ color: 'var(--text-3)', fontSize: 14, marginTop: 8, margin: '8px 0 0' }}>
            {T('choose_school_sub')}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {schulenListe.map(s => {
            const isAktiv = schule?.id === s.schule_id || schule?.name === s.name
            const isLoading = wechseln === s.schule_id
            return (
              <button
                key={s.schule_id}
                onClick={() => handleWahl(s.schule_id)}
                disabled={!!wechseln}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: '20px 24px',
                  background: isAktiv ? 'color-mix(in srgb, var(--primary) 8%, var(--surface))' : 'var(--surface)',
                  border: `2px solid ${isAktiv ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-lg)',
                  cursor: wechseln ? 'default' : 'pointer',
                  textAlign: 'left', width: '100%',
                  opacity: wechseln && !isLoading ? 0.5 : 1,
                  transition: 'all 0.15s',
                }}
              >
                {s.logo_url ? (
                  <img src={s.logo_url} alt="" style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{
                    width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                    background: s.farbe ?? 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22, color: '#fff', fontWeight: 700,
                  }}>
                    {s.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', marginBottom: 4 }}>{s.name}</div>
                  <span style={{
                    display: 'inline-block',
                    background: ROLLEN_FARBE[s.rolle] ?? 'var(--bg-3)',
                    color: '#fff', padding: '2px 10px', borderRadius: 99,
                    fontSize: 11, fontWeight: 700, textTransform: 'capitalize',
                  }}>{s.rolle}</span>
                </div>
                <div style={{ fontSize: 20, color: isAktiv ? 'var(--primary)' : 'var(--text-3)', flexShrink: 0 }}>
                  {isLoading ? '⏳' : isAktiv ? '✓' : '→'}
                </div>
              </button>
            )
          })}
        </div>

        {schule && (
          <button
            onClick={() => { sessionStorage.setItem('staccato_schule_session', '1'); navigate(startseiteNach(rolle), { replace: true }) }}
            style={{
              display: 'block', width: '100%', marginTop: 20,
              padding: '12px', borderRadius: 'var(--radius)',
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--text-3)', fontSize: 14, cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {T('continue_with_current')} ({schule.name})
          </button>
        )}
      </div>
    </div>
  )
}
