import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MessageCircle, FolderOpen, Music, FileText, Radio, CircleHelp, Settings, School, LogOut } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { Seite, Abschnitt, Gruppe, Trenner, Zeile, Segment, Schalter } from '../../ui'
import JoinSessionModal from '../../components/layout/JoinSessionModal'
import { useUngelesen } from '../daten'

export default function NeuIch() {
  const { profil, schule, schulenListe, T, farbmodus, setFarbmodus, schriftStufe, setSchriftStufe, setNeuesDesign, abmelden } = useApp()
  const navigate = useNavigate()
  const { data: ungelesen = [] } = useUngelesen()
  const [joinOffen, setJoinOffen] = useState(false)

  const name = profil?.voller_name ?? ''
  const initial = (name[0] ?? '?').toUpperCase()

  function zurAltenAnsicht() {
    setNeuesDesign(false)
    navigate('/schueler')
  }

  const eintraege = [
    <Zeile key="nachrichten" icon={MessageCircle} titel={T('messages')} wert={ungelesen.length ? T('n_x_neu').replace('{n}', ungelesen.length) : null} wertFarbe="var(--primary)" to="/schueler/nachrichten" />,
    <Zeile key="dateien" icon={FolderOpen} titel={T('eigene_meine')} to="/meine-dateien" />,
    <Zeile key="kurse" icon={Music} titel={T('my_classes')} untertitel={T('n_kurse_untertitel')} to="/schueler/kurse" />,
    <Zeile key="dokumente" icon={FileText} titel={T('n_dokumente')} untertitel={T('n_dokumente_untertitel')} to="/schueler/dateien" />,
    <Zeile key="live" icon={Radio} titel={T('n_live_beitreten')} untertitel={T('n_live_untertitel')} onClick={() => setJoinOffen(true)} />,
  ]
  const weitere = [
    ...(schulenListe?.length > 1 ? [<Zeile key="schule" icon={School} titel={T('n_schule_wechseln')} untertitel={schule?.name} to="/schulen" />] : []),
    <Zeile key="einstellungen" icon={Settings} titel={T('n_weitere_einstellungen')} untertitel={T('n_einstellungen_untertitel')} to="/einstellungen" />,
    <Zeile key="faq" icon={CircleHelp} titel={T('n_hilfe')} to="/schueler/faq" />,
  ]

  return (
    <Seite titel={T('n_tab_ich')}>
      <div style={{ margin: '18px 20px 0', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div aria-hidden="true" style={{ width: 64, height: 64, flexShrink: 0, borderRadius: 32, background: 'var(--n-tint)', color: 'var(--n-tint-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 700, overflow: 'hidden' }}>
          {profil?.avatar_url ? <img src={profil.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initial}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 700, overflowWrap: 'anywhere' }}>{name}</div>
          {schule?.name && <div style={{ fontSize: 16, color: 'var(--text-2)' }}>{schule.name}</div>}
        </div>
        <Link to="/schueler/profil" style={{ minHeight: 44, padding: '0 16px', borderRadius: 22, background: 'var(--n-fill)', color: 'var(--text)', display: 'flex', alignItems: 'center', fontSize: 16, fontWeight: 600, textDecoration: 'none', flexShrink: 0 }}>{T('edit')}</Link>
      </div>

      <Gruppe style={{ marginTop: 24 }}>
        {eintraege.map((z, i) => <div key={z.key}>{i > 0 && <Trenner />}{z}</div>)}
      </Gruppe>

      <Abschnitt titel={T('n_darstellung')}>
        <Gruppe style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>{T('n_hell_oder_dunkel')}</div>
            <Segment label={T('n_hell_oder_dunkel')} wert={farbmodus} onChange={setFarbmodus} style={{ background: 'var(--n-fill-2)' }}
              optionen={[['hell', T('n_hell')], ['dunkel', T('n_dunkel')], ['auto', T('n_automatisch')]]} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>{T('n_schriftgroesse')}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => setSchriftStufe(schriftStufe - 1)} disabled={schriftStufe === 0} aria-label={T('n_schrift_kleiner')} style={schriftKnopf(16, schriftStufe === 0)}>A−</button>
              <div aria-live="polite" style={{ flex: 1, textAlign: 'center', fontSize: [17, 20, 23][schriftStufe], fontWeight: 600 }}>{[T('n_normal'), T('n_gross'), T('n_sehr_gross')][schriftStufe]}</div>
              <button onClick={() => setSchriftStufe(schriftStufe + 1)} disabled={schriftStufe === 2} aria-label={T('n_schrift_groesser')} style={schriftKnopf(22, schriftStufe === 2)}>A+</button>
            </div>
          </div>
        </Gruppe>
      </Abschnitt>

      <Gruppe style={{ marginTop: 24, padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 600 }}>{T('n_neues_design')}</div>
          <div style={{ fontSize: 15, color: 'var(--text-2)', marginTop: 2 }}>{T('n_neues_design_aus_hinweis')}</div>
        </div>
        <Schalter an label={T('n_neues_design')} onChange={zurAltenAnsicht} />
      </Gruppe>

      <Gruppe style={{ marginTop: 24 }}>
        {weitere.map((z, i) => <div key={z.key}>{i > 0 && <Trenner />}{z}</div>)}
      </Gruppe>

      <div style={{ margin: '24px 20px 0' }}>
        <button onClick={abmelden} style={{ width: '100%', height: 52, borderRadius: 14, border: 'none', background: 'var(--n-fill)', color: 'var(--danger)', fontFamily: 'inherit', fontSize: 17, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <LogOut aria-hidden="true" size={20} />{T('n_abmelden')}
        </button>
      </div>

      {joinOffen && <JoinSessionModal onClose={() => setJoinOffen(false)} />}
    </Seite>
  )
}

const schriftKnopf = (gr, aus) => ({ width: 56, height: 48, borderRadius: 12, border: 'none', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit', fontSize: gr, fontWeight: 700, cursor: aus ? 'default' : 'pointer', opacity: aus ? 0.4 : 1 })
