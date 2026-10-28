import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { House, MessageCircle, CircleUser, ChevronDown } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { adminBereiche, SUPERADMIN_EINTRAEGE } from './navigation'

const aktivBei = (to, pfad) => pfad === to || pfad.startsWith(to + '/')

function Eintrag({ to, icon: Icon, label, badge, gross, auch = [] }) {
  const { T } = useApp()
  const { pathname } = useLocation()
  const aktiv = to === '/admin' ? pathname === to : [to, ...auch].some(p => aktivBei(p, pathname))
  return (
    <Link to={to} aria-current={aktiv ? 'page' : undefined} style={{
      display: 'flex', alignItems: 'center', gap: 14, minHeight: gross ? 48 : 44, padding: '0 14px', borderRadius: gross ? 14 : 12, textDecoration: 'none',
      fontSize: 17, fontWeight: aktiv ? 700 : 500, color: aktiv ? 'var(--primary)' : 'var(--text)', background: aktiv ? 'var(--n-tint)' : 'transparent',
    }}>
      {Icon && <Icon aria-hidden="true" size={22} strokeWidth={aktiv ? 2.1 : 1.8} />}
      <span style={{ flex: 1 }}>{T(label)}</span>
      {badge > 0 && <span aria-label={`${badge} ${T('n_ungelesen')}`} style={{ minWidth: 24, height: 24, padding: '0 7px', boxSizing: 'border-box', borderRadius: 12, background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{badge}</span>}
    </Link>
  )
}

function Gruppe({ titel, eintraege }) {
  const { T } = useApp()
  if (!eintraege.length) return null
  return (
    <>
      <div style={{ margin: '18px 14px 6px', fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-2)' }}>{T(titel)}</div>
      {eintraege.map(e => <Eintrag key={e.to} to={e.to} label={e.label} auch={e.auch} />)}
    </>
  )
}

// Schulwechsel: Superadmin und Admins mehrerer Schulen
function SchulWechsel() {
  const { T, schule, schulenListe, schuleWechseln, rolle, toast } = useApp()
  const navigate = useNavigate()
  const [offen, setOffen] = useState(false)
  const liste = schulenListe ?? []
  const wechselbar = liste.length > 1
  if (!wechselbar && rolle !== 'superadmin') {
    return <div style={{ padding: '0 14px 18px', fontSize: 15, color: 'var(--text-2)' }}>{schule?.name}</div>
  }

  async function waehlen(id) {
    setOffen(false)
    if (id === schule?.id) return
    try { await schuleWechseln(id); navigate('/admin') } catch (e) { toast(e.message, 'error') }
  }

  return (
    <div style={{ padding: '0 2px 14px' }}>
      <button onClick={() => wechselbar ? setOffen(o => !o) : navigate('/superadmin')} aria-expanded={wechselbar ? offen : undefined}
        aria-label={`${T('na_aktive_schule')}: ${schule?.name ?? ''}`}
        style={{ width: '100%', minHeight: 52, padding: '8px 14px', borderRadius: 14, border: '1.5px solid var(--n-fill-2)', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>{T('na_aktive_schule')}</span>
          <span style={{ display: 'block', fontSize: 16, fontWeight: 700, overflowWrap: 'anywhere' }}>{schule?.name}</span>
        </span>
        <ChevronDown aria-hidden="true" size={18} color="var(--text-2)" />
      </button>
      {offen && (
        <div style={{ marginTop: 6, borderRadius: 14, border: '1px solid var(--n-sep)', background: 'var(--bg)', overflow: 'hidden' }}>
          {liste.map((s, i) => (
            <button key={s.schule_id} onClick={() => waehlen(s.schule_id)}
              style={{ width: '100%', minHeight: 44, padding: '8px 14px', border: 'none', borderTop: i ? '1px solid var(--n-sep)' : 'none', background: s.schule_id === schule?.id ? 'var(--n-tint)' : 'transparent', color: 'var(--text)', fontFamily: 'inherit', fontSize: 16, textAlign: 'left', cursor: 'pointer' }}>
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AdminSeitenleiste({ ungelesen }) {
  const { rolle, abo } = useApp()
  const b = adminBereiche(abo)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', padding: '24px 12px', boxSizing: 'border-box' }}>
      <div style={{ padding: '4px 14px 14px', fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>Staccato</div>
      {rolle === 'superadmin' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 16 }}>
          {SUPERADMIN_EINTRAEGE.map(e => <Eintrag key={e.to} {...e} gross />)}
        </div>
      )}
      <SchulWechsel />
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Eintrag to="/admin" icon={House} label="n_tab_start" gross />
        <Gruppe titel="na_tab_unterricht" eintraege={b.unterricht} />
        <Gruppe titel="na_tab_mitglieder" eintraege={b.mitglieder} />
        <Gruppe titel="na_tab_verwaltung" eintraege={b.verwaltung} />
        <Gruppe titel="na_vorstand" eintraege={b.vorstand} />
      </nav>
      <div style={{ flex: 1, minHeight: 24 }} />
      <Eintrag to="/admin/nachrichten" icon={MessageCircle} label="messages" badge={ungelesen} gross />
      <Eintrag to="/admin/ich" icon={CircleUser} label="n_tab_ich" gross />
    </div>
  )
}
