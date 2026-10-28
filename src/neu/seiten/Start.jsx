import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, MapPin, MessageCircle, Check, X, CalendarDays, BookOpen, Radio } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { Seite, Abschnitt, Gruppe, Trenner, Zeile, LiedKachel, Regal, Leer, Laden, TextLink } from '../../ui'
import JoinSessionModal from '../../components/layout/JoinSessionModal'
import { useMeineStunden, useMeineEvents, useMeineLieder, useUngelesen, useMeineVorschlaege, useLetzteHausaufgabe, useAbsage } from '../daten'
import { uhrzeit, tagLabel, datumLang, stundeDerSchule } from '../zeit'

const VIERZEHN_TAGE = 14 * 24 * 60 * 60 * 1000

export default function NeuStart() {
  const { profil, T, lang, zeitzone } = useApp()
  const { data: stunden, isLoading } = useMeineStunden(30)
  const { data: events = [] } = useMeineEvents()
  const { data: lieder = [] } = useMeineLieder()
  const { data: ungelesen = [] } = useUngelesen()
  const { data: vorschlaege = [] } = useMeineVorschlaege()
  const { data: hausaufgabe } = useLetzteHausaufgabe()
  const absage = useAbsage()
  const [joinOffen, setJoinOffen] = useState(false)

  const jetzt = Date.now()
  const naechste = (stunden ?? []).find(s => new Date(s.ende) > jetzt && s.status !== 'abgesagt')
  const laeuft = naechste && new Date(naechste.beginn) <= jetzt
  const entschuldigt = naechste?.meine?.status === 'entschuldigt'
  const sendet = !!naechste && absage.sendet === naechste.id

  // Lieder der nächsten Probe: „aktuell“ im Kurs der nächsten Stunde, sonst alle aktuellen
  const aktuelle = lieder.filter(l => l.kurse.some(k => k.status === 'aktuell'))
  const fuerProbe = naechste ? aktuelle.filter(l => l.kurse.some(k => k.id === naechste.unterricht_id)) : []
  const regal = (fuerProbe.length ? fuerProbe : aktuelle).slice(0, 10)
  const regalState = { liste: regal.map(l => ({ id: l.stueck.id, titel: l.stueck.titel })) }

  const h = stundeDerSchule(zeitzone)
  const gruss = h < 11 ? T('n_gruss_morgen') : h < 17 ? T('n_gruss_tag') : T('n_gruss_abend')
  const vorname = (profil?.voller_name ?? '').split(' ')[0]

  // Neuigkeiten: ungelesene Nachrichten, entschiedene Vorschläge, offene Einladungen, Hausaufgabe
  const neuigkeiten = []
  ungelesen.slice(0, 3).forEach(n => neuigkeiten.push(
    <Zeile key={'n' + n.id} icon={MessageCircle} titel={n.betreff || T('n_nachricht')} untertitel={`${n.sender?.voller_name ?? ''} · ${tagLabel(n.gesendet_am, zeitzone, lang, T)}`} punkt to={`/schueler/nachrichten?id=${n.id}`} />,
  ))
  vorschlaege.filter(v => v.status !== 'offen' && v.entschieden_am && jetzt - new Date(v.entschieden_am) < VIERZEHN_TAGE).slice(0, 2).forEach(v => {
    const ok = v.status === 'angenommen'
    neuigkeiten.push(
      <Zeile key={'v' + v.id} icon={ok ? Check : X} iconFarbe={ok ? 'var(--success)' : 'var(--text-2)'}
        titel={T(ok ? (v.art === 'liedtext' ? 'n_text_uebernommen' : 'n_vorschlag_angenommen') : 'n_vorschlag_abgelehnt').replace('{titel}', v.titel)}
        untertitel={v.antwort || T('n_dein_vorschlag')}
        to={ok && v.stueck_id ? `/schueler/repertoire/${v.stueck_id}` : '/schueler/repertoire?ansicht=vorschlaege'} />,
    )
  })
  events.filter(e => e.eingeladen && e.zusage === 'offen').slice(0, 2).forEach(e => neuigkeiten.push(
    <Zeile key={'e' + e.id} icon={CalendarDays} iconFarbe="#2563EB" titel={e.titel} untertitel={`${tagLabel(e.beginn, zeitzone, lang, T)} · ${T('n_bitte_zusagen')}`} to="/schueler/stundenplan" />,
  ))
  if (hausaufgabe?.hausaufgaben) neuigkeiten.push(
    <Zeile key="hausaufgabe" icon={BookOpen} iconFarbe="var(--success)" titel={`${T('n_hausaufgabe')} · ${hausaufgabe.unterricht?.name ?? ''}`} untertitel={hausaufgabe.hausaufgaben} />,
  )

  return (
    <Seite
      ueber={datumLang(zeitzone, lang)}
      titel={vorname ? `${gruss}, ${vorname}` : gruss}
      rechts={<>
        <Link to="/schueler/nachrichten" aria-label={`${T('messages')}${ungelesen.length ? `, ${ungelesen.length} ${T('n_ungelesen')}` : ''}`} style={{ position: 'relative', width: 44, height: 44, borderRadius: 22, background: 'var(--n-fill)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <MessageCircle aria-hidden="true" size={22} />
          {ungelesen.length > 0 && <span aria-hidden="true" style={{ position: 'absolute', top: -2, right: -2, minWidth: 20, height: 20, padding: '0 6px', borderRadius: 10, background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{ungelesen.length > 9 ? '9+' : ungelesen.length}</span>}
        </Link>
        <Link to="/schueler/ich" aria-label={T('n_tab_ich')} style={{ width: 44, height: 44, borderRadius: 22, background: 'var(--n-tint)', color: 'var(--n-tint-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, textDecoration: 'none', overflow: 'hidden' }}>
          {profil?.avatar_url ? <img src={profil.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (vorname[0] ?? '?').toUpperCase()}
        </Link>
      </>}
    >
      {/* Nächster Termin */}
      <div style={{ marginTop: 16 }}>
        {isLoading ? <Laden hoehe={220} /> : naechste ? (
          <section aria-label={T('n_naechster_termin')} style={{ margin: '0 20px', padding: 22, borderRadius: 24, background: 'var(--n-hero)', color: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--n-hero-sub)' }}>{laeuft ? T('n_laeuft_gerade') : T('n_naechster_termin')}</div>
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1.15 }}>{naechste.unterricht?.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 17 }}>
              <Clock aria-hidden="true" size={20} />
              {tagLabel(naechste.beginn, zeitzone, lang, T)} · {uhrzeit(naechste.beginn, zeitzone, lang)} – {uhrzeit(naechste.ende, zeitzone, lang)}
            </div>
            {naechste.raum && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 17 }}>
                <MapPin aria-hidden="true" size={20} />{naechste.raum}
              </div>
            )}
            {laeuft && (
              <button onClick={() => setJoinOffen(true)} style={{ marginTop: 8, height: 52, borderRadius: 14, border: 'none', background: '#FFFFFF', color: 'var(--n-hero-btn-fg)', fontFamily: 'inherit', fontSize: 17, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Radio aria-hidden="true" size={20} />{T('n_live_beitreten')}
              </button>
            )}
            {!laeuft && !entschuldigt && (
              <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                {regal.length > 0 && (
                  <Link to={`/schueler/repertoire/${regal[0].stueck.id}`} state={regalState} style={{ flex: '1 1 140px', height: 52, borderRadius: 14, background: '#FFFFFF', color: 'var(--n-hero-btn-fg)', fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>{T('n_lieder_oeffnen')}</Link>
                )}
                <button onClick={() => absage.umschalten(naechste)} disabled={sendet} style={{ flex: '1 1 140px', height: 52, borderRadius: 14, border: 'none', background: 'var(--n-hero-2)', color: '#FFFFFF', fontFamily: 'inherit', fontSize: 17, fontWeight: 600, cursor: 'pointer' }}>{T('n_ich_kann_nicht')}</button>
              </div>
            )}
            {!laeuft && entschuldigt && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 8, padding: '4px 4px 4px 16px', minHeight: 52, borderRadius: 14, background: 'var(--n-hero-2)' }}>
                <span style={{ fontSize: 17, fontWeight: 600 }}>{T('n_du_bist_entschuldigt')}</span>
                <button onClick={() => absage.umschalten(naechste)} disabled={sendet} style={{ height: 44, padding: '0 14px', borderRadius: 10, border: 'none', background: '#FFFFFF', color: 'var(--n-hero-btn-fg)', fontFamily: 'inherit', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>{T('n_rueckgaengig')}</button>
              </div>
            )}
          </section>
        ) : (
          <Leer text={T('n_keine_termine')} />
        )}
      </div>

      {regal.length > 0 && (
        <Abschnitt titel={fuerProbe.length ? T('n_lieder_fuer_probe') : T('n_aktuelle_lieder')} aktion={<TextLink to="/schueler/repertoire">{T('n_alle')}</TextLink>}>
          <Regal>
            {regal.map(l => <LiedKachel key={l.stueck.id} stueck={l.stueck} to={`/schueler/repertoire/${l.stueck.id}`} state={regalState} />)}
          </Regal>
        </Abschnitt>
      )}

      <Abschnitt titel={T('n_neuigkeiten')}>
        {neuigkeiten.length === 0 ? <Leer text={T('n_keine_neuigkeiten')} /> : (
          <Gruppe>
            {neuigkeiten.map((z, i) => <div key={z.key}>{i > 0 && <Trenner />}{z}</div>)}
          </Gruppe>
        )}
      </Abschnitt>

      {joinOffen && <JoinSessionModal onClose={() => setJoinOffen(false)} />}
    </Seite>
  )
}
