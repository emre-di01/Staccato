import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'

const TYP_ICON = { konzert: '🎵', vorspiel: '🎤', pruefung: '📝', veranstaltung: '🎭', vorstandssitzung: '🏛', sonstiges: '📅' }

function formatDatum(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
}
function formatZeit(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr'
}

const ZUSAGE_LABEL = { offen: 'rsvp_open', zugesagt: 'rsvp_accepted', abgesagt: 'rsvp_declined' }
const ZUSAGE_FARBE = { offen: 'var(--text-3)', zugesagt: 'var(--success)', abgesagt: 'var(--danger)' }

export default function SchuelerEvents() {
  const { profil, T } = useApp()
  const navigate = useNavigate()
  const [events,  setEvents]  = useState([])
  const [laden,   setLaden]   = useState(true)
  const [fehler,  setFehler]  = useState(null)
  const [tab,     setTab]     = useState('kommend')
  const [senden,  setSenden]  = useState(null) // event_id being updated

  useEffect(() => { if (profil) ladeEvents() }, [profil])

  async function ladeEvents() {
    setLaden(true)
    const { data, error } = await supabase
      .from('events')
      .select(`*, meine_zusage:event_teilnehmer(zusage)`)
      .eq('schule_id', profil.schule_id)
      .order('beginn', { ascending: true })
    if (error) setFehler(error.message)
    else setEvents(data || [])
    setLaden(false)
  }

  async function zusageAendern(eventId, status) {
    setSenden(eventId)
    const existing = events.find(e => e.id === eventId)?.meine_zusage?.[0]
    if (existing) {
      await supabase.from('event_teilnehmer')
        .update({ zusage: status })
        .eq('event_id', eventId)
        .eq('profil_id', profil.id)
    } else {
      await supabase.from('event_teilnehmer')
        .upsert({ event_id: eventId, profil_id: profil.id, zusage: status })
    }
    await ladeEvents()
    setSenden(null)
  }

  const jetzt = new Date()
  const gefiltert = events.filter(ev => {
    const beginn = new Date(ev.beginn)
    if (tab === 'kommend') return beginn >= jetzt
    if (tab === 'vergangen') return beginn < jetzt
    return true
  })

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.titel}>{T('events')}</h1>
      </div>

      {fehler && <div style={s.fehlerBox}>{fehler}</div>}

      <div style={s.tabs}>
        {['kommend','vergangen','alle'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ ...s.tab, ...(tab===t ? s.tabAktiv : {}) }}>
            {T('event_' + t)}
          </button>
        ))}
      </div>

      {laden ? (
        <div style={s.leer}>{T('loading')}</div>
      ) : gefiltert.length === 0 ? (
        <div style={s.leer}>{T('event_no_results')}</div>
      ) : (
        <div style={s.liste}>
          {gefiltert.map(ev => {
            const zusage = ev.meine_zusage?.[0]?.zusage || null
            const eingeladen = ev.meine_zusage?.length > 0
            const vergangen = new Date(ev.beginn) < jetzt

            return (
              <div key={ev.id} style={s.card}>
                <div style={s.cardLeft}>
                  <div style={s.datumBlock}>
                    <div style={s.monat}>
                      {new Date(ev.beginn).toLocaleDateString('de-DE', { month: 'short' }).toUpperCase()}
                    </div>
                    <div style={s.tag}>
                      {new Date(ev.beginn).getDate()}
                    </div>
                  </div>
                </div>
                <div style={s.cardBody}>
                  <div style={s.cardTop}>
                    <div style={s.typBadge}>
                      <span>{TYP_ICON[ev.typ]}</span>
                      <span style={s.typLabel}>{T('event_' + ev.typ)}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {ev.oeffentlich && <span style={s.badgePublic}>🌐 Öffentlich</span>}
                      {eingeladen && zusage && (
                        <span style={{ ...s.badgeZusage, color: ZUSAGE_FARBE[zusage] }}>
                          {T(ZUSAGE_LABEL[zusage])}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={s.cardTitel}>{ev.titel}</div>
                  <div style={s.cardMeta}>
                    📅 {formatDatum(ev.beginn)}, {formatZeit(ev.beginn)}
                    {ev.ende && ` – ${formatZeit(ev.ende)}`}
                  </div>
                  {ev.ort && <div style={s.cardMeta}>📍 {ev.ort}</div>}
                  {ev.beschreibung && <div style={s.cardBeschreibung}>{ev.beschreibung}</div>}

                  <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)', marginTop: 4 }}>
                    <button onClick={() => navigate(`/schueler/events/${ev.id}/repertoire`)}
                      style={s.rsvpBtn}>
                      🎼 Programm ansehen
                    </button>
                  </div>

                  {(eingeladen || ev.oeffentlich) && !vergangen && (
                    <div style={s.rsvpRow}>
                      <span style={s.rsvpLabel}>{T('my_rsvp')}:</span>
                      <button
                        onClick={() => zusageAendern(ev.id, 'zugesagt')}
                        disabled={senden === ev.id}
                        style={{ ...s.rsvpBtn, ...(zusage === 'zugesagt' ? s.rsvpAktiv : {}) }}>
                        ✓ {T('rsvp_yes')}
                      </button>
                      <button
                        onClick={() => zusageAendern(ev.id, 'abgesagt')}
                        disabled={senden === ev.id}
                        style={{ ...s.rsvpBtn, ...(zusage === 'abgesagt' ? s.rsvpAktivNein : {}) }}>
                        ✕ {T('rsvp_no')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const s = {
  page: { padding: 24, maxWidth: 800, margin: '0 auto' },
  header: { marginBottom: 24 },
  titel: { fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0 },
  fehlerBox: { background: 'color-mix(in srgb, var(--danger) 10%, transparent)', border: '1px solid var(--danger)', borderRadius: 8, padding: '10px 14px', color: 'var(--danger)', fontSize: 13, marginBottom: 16 },
  tabs: { display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-2)', padding: 4, borderRadius: 10, width: 'fit-content' },
  tab: { padding: '6px 16px', borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' },
  tabAktiv: { background: 'var(--surface)', color: 'var(--text)', boxShadow: 'var(--shadow)' },
  liste: { display: 'flex', flexDirection: 'column', gap: 12 },
  card: { background: 'var(--surface)', borderRadius: 'var(--radius-lg)', display: 'flex', overflow: 'hidden', boxShadow: 'var(--shadow)' },
  cardLeft: { background: 'var(--primary)', color: 'var(--primary-fg)', width: 72, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  datumBlock: { textAlign: 'center' },
  monat: { fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', opacity: 0.8 },
  tag: { fontSize: 28, fontWeight: 800, lineHeight: 1 },
  cardBody: { flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  typBadge: { display: 'flex', alignItems: 'center', gap: 6 },
  typLabel: { fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  badgePublic: { fontSize: 11, fontWeight: 600, background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)', borderRadius: 6, padding: '3px 8px' },
  badgeZusage: { fontSize: 11, fontWeight: 700, borderRadius: 6, padding: '3px 8px', background: 'var(--bg-2)' },
  cardTitel: { fontSize: 16, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 },
  cardMeta: { fontSize: 13, color: 'var(--text-2)' },
  cardBeschreibung: { fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5, borderTop: '1px solid var(--border)', paddingTop: 8 },
  rsvpRow: { display: 'flex', alignItems: 'center', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border)', flexWrap: 'wrap' },
  rsvpLabel: { fontSize: 13, fontWeight: 600, color: 'var(--text-2)' },
  rsvpBtn: { padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' },
  rsvpAktiv: { background: 'color-mix(in srgb, var(--success) 15%, transparent)', borderColor: 'var(--success)', color: 'var(--success)' },
  rsvpAktivNein: { background: 'color-mix(in srgb, var(--danger) 15%, transparent)', borderColor: 'var(--danger)', color: 'var(--danger)' },
}
