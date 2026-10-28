import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Play, MessageCircle, Settings2, ListMusic } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { Seite, Abschnitt, Gruppe, Trenner, Zeile, Segment, LiedCover, Leer, Laden } from '../../ui'
import { Karte } from '../karten'
import { useLehrerKurs, useLehrerStunden, istOffen } from '../lehrerDaten'
import { uhrzeit, tagLabel } from '../zeit'
import { kursZeit } from './kursZeit'

const knopf = { flex: '1 1 140px', height: 50, borderRadius: 14, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none' }

export default function LehrerKurs() {
  const { id } = useParams()
  const { T, lang, zeitzone } = useApp()
  const { data, isLoading } = useLehrerKurs(id)
  const { data: stunden = [], isLoading: stundenLaden } = useLehrerStunden({ kursId: id, zurueck: 90, tage: 60 })
  const [reiter, setReiter] = useState('stunden')
  const zurueck = { to: '/lehrer/kurse', label: T('nl_tab_kurse') }

  if (isLoading) return <Seite zurueck={zurueck}><div style={{ marginTop: 24 }}><Laden hoehe={300} /></div></Seite>
  if (!data) return <Seite zurueck={zurueck}><div style={{ marginTop: 24 }}><Leer text={T('nl_kurs_nicht_gefunden')} /></div></Seite>

  const { kurs, teilnehmer, lieder } = data
  const hierher = { zurueck: { to: `/lehrer/kurse/${id}`, label: kurs.name } }
  const jetzt = Date.now()
  const kommend = stunden.filter(s => new Date(s.ende) > jetzt).slice(0, 4)
  const vergangen = stunden.filter(s => new Date(s.ende) <= jetzt).reverse().slice(0, 10)

  function info(s) {
    if (s.status === 'abgesagt') return [T('n_faellt_aus'), 'var(--danger)']
    if (s.status === 'stattgefunden') return [T('nl_x_von_y_da').replace('{x}', s.da).replace('{y}', s.teilnehmer), 'var(--success)']
    if (istOffen(s)) return [T('nl_anwesenheit_fehlt'), 'var(--primary)']
    return [s.entschuldigt ? T('nl_haben_abgesagt').replace('{n}', s.entschuldigt) : T('nl_geplant'), 'var(--text-2)']
  }

  function stundenListe(titel, liste) {
    if (!liste.length) return null
    return (
      <Abschnitt titel={titel} style={{ marginTop: 24 }}>
        <div style={{ margin: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {liste.map(s => {
            const [text, farbe] = info(s)
            return (
              <Link key={s.id} to={`/lehrer/stunde/${s.id}`} state={hierher} style={{ color: 'inherit', textDecoration: 'none' }}>
                <Karte beginn={s.beginn} titel={`${tagLabel(s.beginn, zeitzone, lang, T)} · ${uhrzeit(s.beginn, zeitzone, lang)}`}
                  unter={s.raum} status={text} statusFarbe={farbe} />
              </Link>
            )
          })}
        </div>
      </Abschnitt>
    )
  }

  return (
    <Seite zurueck={zurueck}>
      <header style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', gap: 16 }}>
        <LiedCover id={kurs.id} groesse={76} radius={18} />
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.1, fontWeight: 800, letterSpacing: '-0.02em', overflowWrap: 'anywhere' }}>{kurs.name}</h1>
          <div style={{ marginTop: 4, fontSize: 15, color: 'var(--text-2)' }}>
            {[kursZeit(kurs, lang), kurs.raeume?.name].filter(Boolean).join(' · ')}
            {kurs.typ !== 'einzel' && <div>{T('nl_teilnehmer_n').replace('{n}', teilnehmer.length)}</div>}
          </div>
        </div>
      </header>

      <div style={{ margin: '18px 20px 0', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Link to={`/lehrer/kurse/${id}/unterrichtsmodus`} style={{ ...knopf, background: 'var(--primary)', color: 'var(--primary-fg)', fontWeight: 700 }}>
          <Play aria-hidden="true" size={16} fill="currentColor" />{T('nl_unterricht_starten')}
        </Link>
        <Link to="/lehrer/nachrichten" style={{ ...knopf, background: 'var(--n-fill)', color: 'var(--text)', fontWeight: 600 }}>
          <MessageCircle aria-hidden="true" size={18} />{T('n_nachricht')}
        </Link>
      </div>

      <Segment label={T('nl_kursbereiche')} wert={reiter} onChange={setReiter} style={{ margin: '20px 20px 0' }}
        optionen={[['stunden', T('nl_stunden')], ['leute', T('nl_teilnehmer')], ['lieder', T('n_tab_lieder')]]} />

      {reiter === 'stunden' && (
        stundenLaden ? <div style={{ marginTop: 22 }}><Laden hoehe={200} /></div>
          : !kommend.length && !vergangen.length ? <div style={{ marginTop: 22 }}><Leer text={T('nl_keine_stunden_kurs')} /></div>
          : <>{stundenListe(T('nl_als_naechstes'), kommend)}{stundenListe(T('nl_vergangen'), vergangen)}</>
      )}

      {reiter === 'leute' && (
        <div style={{ marginTop: 22 }}>
          {teilnehmer.length === 0 ? <Leer text={T('nl_keine_teilnehmer')} /> : (
            <Gruppe>
              {teilnehmer.map((p, i) => (
                <div key={p.id}>
                  {i > 0 && <Trenner />}
                  <Zeile titel={p.name}
                    bild={<span aria-hidden="true" style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 20, background: 'var(--bg)', color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, overflow: 'hidden' }}>
                      {p.avatar ? <img src={p.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : p.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                    </span>}
                    untertitel={p.quote == null ? T('nl_noch_keine_anwesenheit') : T('nl_anwesenheit_quote')}
                    wert={p.quote == null ? null : `${p.quote} %`} wertFarbe={p.quote < 75 ? 'var(--primary)' : 'var(--success)'} />
                </div>
              ))}
            </Gruppe>
          )}
        </div>
      )}

      {reiter === 'lieder' && (
        <div style={{ marginTop: 22 }}>
          <Gruppe>
            {lieder.map(l => (
              <div key={l.stuecke.id}>
                <Zeile bild={<LiedCover id={l.stuecke.id} groesse={44} radius={10} />} titel={l.stuecke.titel} untertitel={l.stuecke.komponist}
                  wert={l.status === 'aktuell' ? T('nl_aktuell') : l.status === 'geplant' ? T('nl_geplant') : null}
                  wertFarbe={l.status === 'aktuell' ? 'var(--primary)' : 'var(--text-2)'}
                  to={`/lehrer/kurse/${id}/repertoire/${l.stuecke.id}`} />
                <Trenner />
              </div>
            ))}
            <Zeile icon={ListMusic} titel={lieder.length ? T('nl_lieder_verwalten') : T('nl_lied_hinzufuegen')} to={`/lehrer/kurse/${id}/repertoire`} />
          </Gruppe>
        </div>
      )}

      <Gruppe style={{ marginTop: 32 }}>
        <Zeile icon={Settings2} iconFarbe="var(--text-2)" titel={T('nl_kurs_verwalten')} untertitel={T('nl_kurs_verwalten_hinweis')} to={`/lehrer/kurse/${id}/verwalten`} />
      </Gruppe>
    </Seite>
  )
}
