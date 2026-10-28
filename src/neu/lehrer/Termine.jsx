import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Music } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { useBasis, useSchulweit } from '../rolle'
import { Seite, Segment, Leer, Laden, Knopf } from '../../ui'
import EventBlatt from './EventBlatt'
import { useMeineEvents, useNeuLaden } from '../daten'
import { useLehrerStunden, istOffen } from '../lehrerDaten'
import { Karte, EventKarte } from '../karten'
import { gruppenLabel, uhrzeit, tagKey } from '../zeit'

// Termine der Lehrkraft: Stunden der eigenen Kurse (ab heute) und Veranstaltungen
export default function LehrerTermine() {
  const { profil, rolle, T, lang, zeitzone, toast } = useApp()
  const basis = useBasis()
  const schulweit = useSchulweit()
  const termine = schulweit ? '/admin/stundenplan' : '/lehrer/anwesenheit'
  const { data: stunden, isLoading: l1 } = useLehrerStunden({ zurueck: 1, tage: 60 })
  const { data: events, isLoading: l2 } = useMeineEvents()
  const neuLaden = useNeuLaden()
  const [filter, setFilter] = useState('alle')
  const [sendet, setSendet] = useState(null)
  const [eventBlatt, setEventBlatt] = useState(null)   // null | 'neu' | event

  const heute = tagKey(new Date().toISOString(), zeitzone)
  const eintraege = [
    ...(filter !== 'events' ? (stunden ?? []).filter(s => tagKey(s.beginn, zeitzone) >= heute).map(s => ({ art: 'stunde', id: s.id, beginn: s.beginn, daten: s })) : []),
    ...(filter !== 'unterricht' ? (events ?? []).map(e => ({ art: 'event', id: e.id, beginn: e.beginn, daten: e })) : []),
  ].sort((a, b) => new Date(a.beginn) - new Date(b.beginn))

  const gruppen = []
  for (const e of eintraege) {
    const label = gruppenLabel(e.beginn, zeitzone, lang, T)
    if (!gruppen.length || gruppen[gruppen.length - 1].label !== label) gruppen.push({ label, eintraege: [] })
    gruppen[gruppen.length - 1].eintraege.push(e)
  }

  async function antworten(ev, zusage) {
    setSendet(ev.id)
    const { error } = ev.eingeladen
      ? await supabase.from('event_teilnehmer').update({ zusage }).eq('event_id', ev.id).eq('profil_id', profil.id)
      : await supabase.from('event_teilnehmer').upsert({ event_id: ev.id, profil_id: profil.id, zusage })
    setSendet(null)
    if (error) { toast(error.message, 'error'); return }
    neuLaden('n-events')
  }

  function stundeStatus(s) {
    if (s.status === 'abgesagt') return [T('n_faellt_aus'), 'var(--danger)']
    if (s.status === 'stattgefunden') return [T('nl_erledigt'), 'var(--success)']
    if (istOffen(s)) return [T('nl_anwesenheit_fehlt'), 'var(--primary)']
    if (s.entschuldigt) return [T('nl_haben_abgesagt').replace('{n}', s.entschuldigt), 'var(--text-2)']
    return [null, null]
  }

  const laden = l1 || l2

  return (
    <Seite titel={T('n_tab_termine')} rechts={
      <Knopf klein variante="tint" icon={Plus} onClick={() => setEventBlatt('neu')}>{T('nl_event')}</Knopf>
    }>
      <Segment label={T('n_termine_filtern')} wert={filter} onChange={setFilter} style={{ margin: '16px 20px 0' }}
        optionen={[['alle', T('n_alle')], ['unterricht', T('n_unterricht')], ['events', T('n_veranstaltungen')]]} />
      <div style={{ margin: '8px 20px 0', textAlign: 'right' }}>
        <Link to={schulweit ? '/admin/woche' : '/lehrer/stundenplan'} style={{ display: 'inline-flex', minHeight: 44, alignItems: 'center', fontSize: 17, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>{T('nl_wochenansicht')}</Link>
      </div>

      {laden ? <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}><Laden /><Laden /></div>
        : gruppen.length === 0 ? <div style={{ marginTop: 24 }}><Leer text={T('n_keine_termine')} /></div>
        : gruppen.map(g => (
          <section key={g.label} style={{ margin: '28px 20px 0' }}>
            <h2 style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em' }}>{g.label}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {g.eintraege.map(e => {
                if (e.art === 'event') {
                  const ev = e.daten
                  const eigenes = ev.erstellt_von === profil.id || (schulweit && ['admin', 'superadmin'].includes(rolle))
                  const aktionen = (eigenes || ev.event_stuecke?.length > 0) && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {ev.event_stuecke?.length > 0 && <Link to={`${basis}/events/${ev.id}/repertoire`} style={linkKnopf}><Music aria-hidden="true" size={18} />{T('n_tab_lieder')}</Link>}
                      {eigenes && <button onClick={() => setEventBlatt(ev)} style={linkKnopf}><Pencil aria-hidden="true" size={18} />{T('edit')}</button>}
                    </div>
                  )
                  return <EventKarte key={e.id} ev={ev} onAntwort={z => antworten(ev, z)} sendet={sendet === e.id} aktionen={aktionen} />
                }
                const s = e.daten
                const [status, farbe] = stundeStatus(s)
                return (
                  <Link key={e.id} to={`${basis}/stunde/${s.id}`} state={{ zurueck: { to: termine, label: T('n_tab_termine') } }} style={{ color: 'inherit', textDecoration: 'none' }}>
                    <Karte beginn={s.beginn} titel={s.unterricht?.name}
                      unter={[`${uhrzeit(s.beginn, zeitzone, lang)} – ${uhrzeit(s.ende, zeitzone, lang)}`, s.raum].filter(Boolean).join(' · ')}
                      status={status} statusFarbe={farbe} />
                  </Link>
                )
              })}
            </div>
          </section>
        ))}

      {eventBlatt && (
        <EventBlatt ev={eventBlatt === 'neu' ? null : eventBlatt} onClose={() => setEventBlatt(null)}
          onFertig={() => { setEventBlatt(null); neuLaden('n-events') }} />
      )}
    </Seite>
  )
}

const linkKnopf = { minHeight: 44, padding: '0 14px', borderRadius: 22, border: 'none', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 16, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }
