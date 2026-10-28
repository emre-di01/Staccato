import { Link } from 'react-router-dom'
import { Clock, MessageCircle, CalendarDays, BookOpen } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { Seite, Abschnitt, Gruppe, Trenner, Zeile, Leer, Laden } from '../../ui'
import { useMeineEvents, useUngelesen } from '../daten'
import { useKinder, useKinderStunden, vorname } from './daten'
import { uhrzeit, tagLabel, datumLang, stundeDerSchule } from '../zeit'

// Startseite für Eltern: je Kind der nächste Termin und die letzte Hausaufgabe, darunter Neuigkeiten
export default function ElternStart() {
  const { profil, T, lang, zeitzone } = useApp()
  const { data: kinder = [], isLoading } = useKinder()
  const { data: stunden = [] } = useKinderStunden(30, { zurueck: 21 })
  const { data: events = [] } = useMeineEvents()
  const { data: ungelesen = [] } = useUngelesen()

  const jetzt = Date.now()
  const h = stundeDerSchule(zeitzone)
  const gruss = h < 11 ? T('n_gruss_morgen') : h < 17 ? T('n_gruss_tag') : T('n_gruss_abend')
  const meinName = vorname(profil?.voller_name)

  const neuigkeiten = [
    ...ungelesen.slice(0, 3).map(n => (
      <Zeile key={'n' + n.id} icon={MessageCircle} titel={n.betreff || T('n_nachricht')} untertitel={`${n.sender?.voller_name ?? ''} · ${tagLabel(n.gesendet_am, zeitzone, lang, T)}`} punkt to={`/eltern/nachrichten?id=${n.id}`} />
    )),
    ...events.filter(e => e.eingeladen && e.zusage === 'offen').slice(0, 2).map(e => (
      <Zeile key={'e' + e.id} icon={CalendarDays} iconFarbe="#2563EB" titel={e.titel} untertitel={`${tagLabel(e.beginn, zeitzone, lang, T)} · ${T('n_bitte_zusagen')}`} to="/eltern/stundenplan" />
    )),
  ]

  return (
    <Seite
      ueber={datumLang(zeitzone, lang)}
      titel={meinName ? `${gruss}, ${meinName}` : gruss}
      rechts={
        <Link to="/eltern/nachrichten" aria-label={`${T('messages')}${ungelesen.length ? `, ${ungelesen.length} ${T('n_ungelesen')}` : ''}`} style={{ position: 'relative', width: 44, height: 44, borderRadius: 22, background: 'var(--n-fill)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <MessageCircle aria-hidden="true" size={22} />
          {ungelesen.length > 0 && <span aria-hidden="true" style={{ position: 'absolute', top: -2, right: -2, minWidth: 20, height: 20, padding: '0 6px', borderRadius: 10, background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{ungelesen.length > 9 ? '9+' : ungelesen.length}</span>}
        </Link>
      }
    >
      {isLoading ? <div style={{ marginTop: 24 }}><Laden hoehe={160} /></div>
        : kinder.length === 0 ? <div style={{ marginTop: 24 }}><Leer text={T('ne_keine_kinder')} /></div>
        : kinder.map((k, ki) => {
          const eigene = stunden.filter(s => s.kinder.some(x => x.id === k.id))
          const naechste = eigene.find(s => new Date(s.ende) > jetzt && s.status !== 'abgesagt')
          const meinStatus = naechste?.kinder.find(x => x.id === k.id)?.status
          const hausaufgabe = [...eigene].reverse().find(s => new Date(s.beginn) <= jetzt && s.hausaufgaben)
          return (
            <Abschnitt key={k.id} titel={vorname(k.voller_name)} style={ki === 0 ? { marginTop: 24 } : undefined}>
              <Gruppe>
                {naechste ? (
                  <Zeile icon={Clock} titel={naechste.unterricht?.name}
                    untertitel={[`${tagLabel(naechste.beginn, zeitzone, lang, T)} · ${uhrzeit(naechste.beginn, zeitzone, lang)}`, naechste.raum].filter(Boolean).join(' · ')}
                    wert={meinStatus === 'entschuldigt' ? T('ne_entschuldigt') : null} to={`/eltern/kinder/${k.id}`} />
                ) : (
                  <Zeile icon={Clock} iconFarbe="var(--text-3)" titel={T('n_keine_termine')} to={`/eltern/kinder/${k.id}`} />
                )}
                {hausaufgabe && <>
                  <Trenner />
                  <Zeile icon={BookOpen} iconFarbe="var(--success)" titel={`${T('n_hausaufgabe')} · ${hausaufgabe.unterricht?.name ?? ''}`} untertitel={hausaufgabe.hausaufgaben} />
                </>}
              </Gruppe>
            </Abschnitt>
          )
        })}

      <Abschnitt titel={T('n_neuigkeiten')}>
        {neuigkeiten.length === 0 ? <Leer text={T('n_keine_neuigkeiten')} /> : (
          <Gruppe>
            {neuigkeiten.map((z, i) => <div key={z.key}>{i > 0 && <Trenner />}{z}</div>)}
          </Gruppe>
        )}
      </Abschnitt>
    </Seite>
  )
}
