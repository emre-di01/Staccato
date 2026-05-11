import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { SlidingTabs, haptic, EmptyState, fireConfetti } from '../../components/SlidingTabs'

const TYP_ICON = { konzert: '🎵', vorspiel: '🎤', pruefung: '📝', veranstaltung: '🎭', vorstandssitzung: '🏛', sonstiges: '📅' }

function formatZeit(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr'
}

const ZUSAGE_LABEL = { offen: 'rsvp_open', zugesagt: 'rsvp_accepted', abgesagt: 'rsvp_declined' }
const ZUSAGE_FARBE = { offen: 'var(--text-3)', zugesagt: 'var(--success)', abgesagt: 'var(--danger)' }

export default function SchuelerEvents() {
  const { profil, rolle, T } = useApp()
  const navigate = useNavigate()
  const basePath = rolle === 'vorstand' ? '/vorstand' : '/schueler'
  const [events,  setEvents]  = useState([])
  const [laden,   setLaden]   = useState(true)
  const [fehler,  setFehler]  = useState(null)
  const [tab,     setTab]     = useState('kommend')
  const [senden,  setSenden]  = useState(null)
  const [rsvpFlash, setRsvpFlash] = useState({})
  const [mob,     setMob]     = useState(() => window.innerWidth < 600)

  useEffect(() => {
    const fn = () => setMob(window.innerWidth < 600)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])

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
    haptic()
    if (status === 'zugesagt') fireConfetti()
    const fk = eventId + status
    setRsvpFlash(f => ({ ...f, [fk]: true }))
    setTimeout(() => setRsvpFlash(f => { const n = { ...f }; delete n[fk]; return n }), 450)
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
    <div style={{ ...s.page, padding: mob ? 12 : 24 }}>
      <h1 style={s.titel}>{T('events')}</h1>

      {fehler && <div style={s.fehlerBox}>{fehler}</div>}

      <SlidingTabs
        active={tab}
        onChange={setTab}
        style={{ marginBottom: 20 }}
        tabs={['kommend','vergangen','alle'].map(t => ({ key: t, label: T('event_' + t) }))}
      />

      {laden ? (
        <EmptyState icon="⏳" message={T('loading')} />
      ) : gefiltert.length === 0 ? (
        <EmptyState icon="📭" message={T('event_no_results')} />
      ) : (
        <div style={s.liste}>
          {gefiltert.map(ev => {
            const zusage = ev.meine_zusage?.[0]?.zusage || null
            const eingeladen = ev.meine_zusage?.length > 0
            const vergangen = new Date(ev.beginn) < jetzt
            const kannRsvp = (eingeladen || ev.oeffentlich) && !vergangen
            const istSendend = senden === ev.id

            return (
              <div key={ev.id} className="stagger-item" style={s.card}>
                {/* Farbstreifen oben je nach RSVP-Status */}
                <div style={{
                  ...s.statusStreifen,
                  background: kannRsvp
                    ? (zusage === 'zugesagt' ? 'var(--success)'
                      : zusage === 'abgesagt' ? 'var(--danger)'
                      : 'var(--border)')
                    : 'var(--border)'
                }} />

                <div style={s.cardInner}>
                  {/* Datum-Block links */}
                  <div style={{ ...s.datumBlock, width: mob ? 52 : 60 }}>
                    <div style={s.datumWochentag}>
                      {new Date(ev.beginn).toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '')}
                    </div>
                    <div style={{ ...s.datumTag, fontSize: mob ? 22 : 26 }}>
                      {new Date(ev.beginn).getDate()}
                    </div>
                    <div style={s.datumMonat}>
                      {new Date(ev.beginn).toLocaleDateString('de-DE', { month: 'short' }).replace('.', '')}
                    </div>
                  </div>

                  {/* Inhalt rechts */}
                  <div style={s.cardBody}>
                    <div style={s.cardTop}>
                      <div style={s.typBadge}>
                        <span style={s.typIcon}>{TYP_ICON[ev.typ]}</span>
                        <span style={s.typLabel}>{T('event_' + ev.typ)}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                        {ev.oeffentlich && <span style={s.badgePublic}>🌐</span>}
                        {vergangen && eingeladen && zusage && zusage !== 'offen' && (
                          <span style={{ ...s.badgeZusage, color: ZUSAGE_FARBE[zusage] }}>
                            {zusage === 'zugesagt' ? '✓' : '✕'} {T(ZUSAGE_LABEL[zusage])}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={s.cardTitel}>{ev.titel}</div>

                    <div style={s.metaZeile}>
                      <span style={s.metaItem}>🕐 {formatZeit(ev.beginn)}{ev.ende && ` – ${formatZeit(ev.ende)}`}</span>
                    </div>

                    {ev.ort && (
                      <a href={`https://maps.google.com/?q=${encodeURIComponent(ev.ort)}`}
                        target="_blank" rel="noopener noreferrer"
                        style={s.ortLink}>
                        📍 {ev.ort} <span style={{ fontSize: 10, opacity: 0.6 }}>↗</span>
                      </a>
                    )}

                    {ev.beschreibung && (
                      <div style={s.cardBeschreibung}>{ev.beschreibung}</div>
                    )}

                    {/* Aktionen */}
                    <div style={s.aktionenRow}>
                      {ev.typ !== 'vorstandssitzung' && (
                        <button onClick={() => navigate(`${basePath}/events/${ev.id}/repertoire`)}
                          style={s.programmBtn}>
                          🎼 Programm
                        </button>
                      )}
                    </div>

                    {/* RSVP-Buttons (nur zukünftige Events) */}
                    {kannRsvp && (
                      <div style={s.rsvpSection}>
                        <button
                          onClick={() => zusageAendern(ev.id, 'zugesagt')}
                          disabled={istSendend}
                          style={{
                            ...s.rsvpBtn,
                            ...(zusage === 'zugesagt' ? s.rsvpJaAktiv : s.rsvpJa),
                            ...(zusage === 'abgesagt' ? { opacity: 0.45 } : {}),
                            animation: rsvpFlash[ev.id + 'zugesagt'] ? 'rsvpBounce 0.38s ease both' : 'none',
                          }}>
                          ✓ {T('rsvp_yes')}
                        </button>
                        <button
                          onClick={() => zusageAendern(ev.id, 'abgesagt')}
                          disabled={istSendend}
                          style={{
                            ...s.rsvpBtn,
                            ...(zusage === 'abgesagt' ? s.rsvpNeinAktiv : s.rsvpNein),
                            ...(zusage === 'zugesagt' ? { opacity: 0.45 } : {}),
                            animation: rsvpFlash[ev.id + 'abgesagt'] ? 'rsvpBounce 0.38s ease both' : 'none',
                          }}>
                          ✕ {T('rsvp_no')}
                        </button>
                      </div>
                    )}
                  </div>
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
  page: { maxWidth: 800, margin: '0 auto' },
  titel: { fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: '0 0 20px' },
  fehlerBox: { background: 'color-mix(in srgb, var(--danger) 10%, transparent)', border: '1px solid var(--danger)', borderRadius: 8, padding: '10px 14px', color: 'var(--danger)', fontSize: 13, marginBottom: 16 },
  tabs: { display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-2)', padding: 4, borderRadius: 10, width: 'fit-content' },
  tab: { padding: '6px 16px', borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' },
  tabAktiv: { background: 'var(--surface)', color: 'var(--text)', boxShadow: 'var(--shadow)' },
  leer: { color: 'var(--text-3)', fontSize: 14, padding: '40px 0', textAlign: 'center' },
  liste: { display: 'flex', flexDirection: 'column', gap: 12 },

  card: { background: 'var(--surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow)', border: '1px solid var(--border)', overflow: 'hidden' },
  statusStreifen: { height: 3, flexShrink: 0, transition: 'background 0.2s' },
  cardInner: { display: 'flex', alignItems: 'stretch' },

  datumBlock: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '14px 0', flexShrink: 0, borderRight: '1px solid var(--border)', background: 'var(--bg-2)' },
  datumWochentag: { fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 2 },
  datumTag: { fontWeight: 800, lineHeight: 1, color: 'var(--text)' },
  datumMonat: { fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-3)', textTransform: 'uppercase', marginTop: 2 },

  cardBody: { flex: 1, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
  typBadge: { display: 'flex', alignItems: 'center', gap: 5 },
  typIcon: { fontSize: 14 },
  typLabel: { fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  badgePublic: { fontSize: 13 },
  badgeZusage: { fontSize: 11, fontWeight: 700, borderRadius: 6, padding: '2px 7px', background: 'var(--bg-2)' },

  cardTitel: { fontSize: 15, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 },
  metaZeile: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  metaItem: { fontSize: 12, color: 'var(--text-2)' },
  ortLink: { fontSize: 12, color: 'var(--text-2)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 },
  cardBeschreibung: { fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5, borderTop: '1px solid var(--border)', paddingTop: 6, marginTop: 2 },

  aktionenRow: { display: 'flex', gap: 6 },
  programmBtn: { padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },

  rsvpSection: { display: 'flex', gap: 8, paddingTop: 10, borderTop: '1px solid var(--border)', marginTop: 2 },
  rsvpBtn: { flex: 1, padding: '9px 10px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', textAlign: 'center', border: '2px solid transparent' },
  rsvpJa: { background: 'color-mix(in srgb, var(--success) 10%, transparent)', border: '2px solid color-mix(in srgb, var(--success) 35%, transparent)', color: 'var(--success)' },
  rsvpJaAktiv: { background: 'var(--success)', border: '2px solid var(--success)', color: '#fff' },
  rsvpNein: { background: 'var(--bg-2)', border: '2px solid var(--border)', color: 'var(--text-3)' },
  rsvpNeinAktiv: { background: 'var(--danger)', border: '2px solid var(--danger)', color: '#fff' },
}
