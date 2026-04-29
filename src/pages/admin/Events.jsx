import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'

const TYP_ICON = { konzert: '🎵', vorspiel: '🎤', pruefung: '📝', veranstaltung: '🎭', vorstandssitzung: '🏛', sonstiges: '📅' }
const TYPEN = ['konzert', 'vorspiel', 'pruefung', 'veranstaltung', 'vorstandssitzung', 'sonstiges']

function formatDatum(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
}
function formatZeit(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr'
}
function toInputVal(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const leerForm = { titel: '', typ: 'veranstaltung', beginn: '', ende: '', ort: '', raum_id: '', beschreibung: '', oeffentlich: false }

export default function AdminEvents() {
  const { T } = useApp()
  const navigate = useNavigate()
  const [events,    setEvents]    = useState([])
  const [profiles,  setProfiles]  = useState([])
  const [laden,     setLaden]     = useState(true)
  const [fehler,    setFehler]    = useState(null)
  const [tab,       setTab]       = useState('kommend')
  const [suche,     setSuche]     = useState('')
  const [modal,     setModal]     = useState(null)
  const [form,      setForm]      = useState(leerForm)
  const [senden,    setSenden]    = useState(false)
  const [teilnehmer, setTeilnehmer] = useState([])
  const [tLaden,    setTLaden]    = useState(false)
  const [addProfil,  setAddProfil]  = useState('')
  const [fehlerTn,   setFehlerTn]   = useState(null)
  const [tnSuche,    setTnSuche]    = useState('')
  const [raeume,     setRaeume]     = useState([])

  useEffect(() => { ladeEvents() }, [])
  useEffect(() => {
    supabase.from('raeume').select('id, name').eq('aktiv', true).order('name')
      .then(({ data }) => setRaeume(data ?? []))
  }, [])

  async function ladeEvents() {
    setLaden(true)
    const { data, error } = await supabase
      .from('events')
      .select('*, raeume(name)')
      .order('beginn', { ascending: true })
    if (error) setFehler(error.message)
    else setEvents(data || [])
    setLaden(false)
  }

  async function ladeProfiles() {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, voller_name, rolle')
      .order('voller_name')
    if (error) setFehlerTn(error.message)
    else setProfiles(data || [])
  }

  async function ladeTeilnehmer(eventId) {
    setTLaden(true)
    const { data } = await supabase
      .from('event_teilnehmer')
      .select('profil_id, zusage, rolle, profiles(id, voller_name, rolle)')
      .eq('event_id', eventId)
    setTeilnehmer(data || [])
    setTLaden(false)
  }

  function oeffneNeu() {
    setForm(leerForm)
    setModal({ typ: 'form', event: null })
  }

  function oeffneBearbeiten(ev) {
    setForm({
      titel: ev.titel,
      typ: ev.typ,
      beginn: toInputVal(ev.beginn),
      ende: toInputVal(ev.ende),
      ort: ev.ort || '',
      raum_id: ev.raum_id || '',
      beschreibung: ev.beschreibung || '',
      oeffentlich: ev.oeffentlich || false,
    })
    setModal({ typ: 'form', event: ev })
  }

  async function oeffneTeilnehmer(ev) {
    setFehlerTn(null)
    setTnSuche('')
    await ladeProfiles()
    await ladeTeilnehmer(ev.id)
    setAddProfil('')
    setModal({ typ: 'teilnehmer', event: ev })
  }

  async function speichern() {
    if (!form.titel.trim() || !form.beginn) return
    setSenden(true)
    setFehler(null)
    const payload = {
      titel: form.titel.trim(),
      typ: form.typ,
      beginn: new Date(form.beginn).toISOString(),
      ende: form.ende ? new Date(form.ende).toISOString() : null,
      ort: form.ort.trim() || null,
      raum_id: form.raum_id || null,
      beschreibung: form.beschreibung.trim() || null,
      oeffentlich: form.oeffentlich,
    }
    let error
    if (modal.event) {
      ;({ error } = await supabase.from('events').update(payload).eq('id', modal.event.id))
    } else {
      ;({ error } = await supabase.from('events').insert(payload))
    }
    if (error) setFehler(error.message)
    else { setModal(null); await ladeEvents() }
    setSenden(false)
  }

  async function loeschen(id) {
    if (!confirm(T('confirm_delete'))) return

    // Stücke löschen die ausschließlich in dieser Veranstaltung verwendet werden
    const { data: evStuecke } = await supabase.from('event_stuecke')
      .select('stueck_id').eq('event_id', id)
    for (const { stueck_id } of (evStuecke ?? [])) {
      const [{ count: kCount }, { count: eCount }] = await Promise.all([
        supabase.from('unterricht_stuecke').select('*', { count: 'exact', head: true }).eq('stueck_id', stueck_id),
        supabase.from('event_stuecke').select('*', { count: 'exact', head: true }).eq('stueck_id', stueck_id).neq('event_id', id),
      ])
      if ((kCount ?? 0) === 0 && (eCount ?? 0) === 0) {
        const { data: sDocs } = await supabase.from('stueck_dateien').select('bucket_pfad').eq('stueck_id', stueck_id)
        if (sDocs?.length > 0) await supabase.storage.from('stueck-dateien').remove(sDocs.map(d => d.bucket_pfad))
        await supabase.from('stuecke').delete().eq('id', stueck_id)
      }
    }

    const { error } = await supabase.from('events').delete().eq('id', id)
    if (error) setFehler(error.message)
    else await ladeEvents()
  }

  async function teilnehmerHinzufuegen() {
    if (!addProfil) return
    setSenden(true)
    setFehlerTn(null)
    const { error } = await supabase
      .from('event_teilnehmer')
      .insert({ event_id: modal.event.id, profil_id: addProfil })
    if (error) setFehlerTn(error.message)
    else {
      await ladeTeilnehmer(modal.event.id)
      setAddProfil('')
      supabase.functions.invoke('send-email', {
        body: { type: 'event_invite', event_id: modal.event.id, profil_id: addProfil },
      }).catch(console.error)
    }
    setSenden(false)
  }

  async function teilnehmerEntfernen(profilId) {
    await supabase
      .from('event_teilnehmer')
      .delete()
      .eq('event_id', modal.event.id)
      .eq('profil_id', profilId)
    await ladeTeilnehmer(modal.event.id)
  }

  const jetzt = new Date()
  const gefiltert = events.filter(ev => {
    const beginn = new Date(ev.beginn)
    const tabOk = tab === 'kommend' ? beginn >= jetzt : tab === 'vergangen' ? beginn < jetzt : true
    const sucheOk = ev.titel.toLowerCase().includes(suche.toLowerCase())
    return tabOk && sucheOk
  })

  const eingeladenIds = new Set(teilnehmer.map(t => t.profil_id))
  const verfuegbar = profiles.filter(p =>
    !eingeladenIds.has(p.id) &&
    p.voller_name.toLowerCase().includes(tnSuche.toLowerCase())
  )

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.titel}>{T('events')}</h1>
          <p style={s.sub}>{events.length} {T('events').toLowerCase()}</p>
        </div>
        <button onClick={oeffneNeu} style={s.btnPrimary}>+ {T('new_event')}</button>
      </div>

      {fehler && <div style={s.fehlerBox}>{fehler}</div>}

      <input
        value={suche} onChange={e => setSuche(e.target.value)}
        placeholder={T('events_search')}
        style={{ ...s.inp, marginBottom: 12, maxWidth: 340 }}
      />

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
        <div style={s.grid}>
          {gefiltert.map(ev => (
            <div key={ev.id} style={s.card}>
              <div style={s.cardTop}>
                <div style={s.typBadge}>
                  <span style={s.typIcon}>{TYP_ICON[ev.typ]}</span>
                  <span style={s.typLabel}>{T('event_' + ev.typ)}</span>
                </div>
                {ev.oeffentlich && (
                  <span style={s.badge}>{T('event_public_badge')}</span>
                )}
              </div>
              <div style={s.cardTitel}>{ev.titel}</div>
              <div style={s.cardMeta}>
                <span>📅 {formatDatum(ev.beginn)}, {formatZeit(ev.beginn)}</span>
                {ev.ende && <span>– {formatZeit(ev.ende)}</span>}
              </div>
              {ev.raeume && <div style={s.cardMeta}>🏫 {ev.raeume.name}</div>}
              {ev.ort && <div style={s.cardMeta}>📍 {ev.ort}</div>}
              {ev.beschreibung && <div style={s.cardBeschreibung}>{ev.beschreibung}</div>}
              <div style={s.cardActions}>
                <button onClick={() => navigate(`/admin/events/${ev.id}/repertoire`)} style={s.btnSm}>🎼 {T('repertoire')}</button>
                <button onClick={() => oeffneTeilnehmer(ev)} style={s.btnSm}>👥 {T('manage_participants')}</button>
                <button onClick={() => oeffneBearbeiten(ev)} style={s.btnSm}>{T('edit')}</button>
                <button onClick={() => loeschen(ev.id)} style={{ ...s.btnSm, color: 'var(--danger)' }}>{T('delete')}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Formular-Modal */}
      {modal?.typ === 'form' && (
        <div style={s.overlay} onClick={() => setModal(null)}>
          <div style={s.modalBox} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitel}>{modal.event ? T('edit_event') : T('new_event')}</h2>
              <button onClick={() => setModal(null)} style={s.closeBtn}>✕</button>
            </div>
            <div style={s.modalBody}>
              {fehler && <div style={s.fehlerBox}>{fehler}</div>}
              <div style={s.formRow}>
                <label style={s.lbl}>{T('event_name_label')}</label>
                <input value={form.titel} onChange={e => setForm(f => ({...f, titel: e.target.value}))}
                  style={s.inp} placeholder={T('event_name_placeholder')} />
              </div>
              <div style={s.formRow}>
                <label style={s.lbl}>{T('type')}</label>
                <select value={form.typ} onChange={e => setForm(f => ({...f, typ: e.target.value}))} style={s.inp}>
                  {TYPEN.map(t => <option key={t} value={t}>{TYP_ICON[t]} {T('event_' + t)}</option>)}
                </select>
              </div>
              <div style={s.formRow}>
                <label style={s.lbl}>{T('event_start')} *</label>
                <input type="datetime-local" value={form.beginn} onChange={e => setForm(f => ({...f, beginn: e.target.value}))} style={s.inp} />
              </div>
              <div style={s.formRow}>
                <label style={s.lbl}>{T('event_end')}</label>
                <input type="datetime-local" value={form.ende} onChange={e => setForm(f => ({...f, ende: e.target.value}))} style={s.inp} />
              </div>
              <div style={s.formRow}>
                <label style={s.lbl}>{T('room')}</label>
                <select value={form.raum_id} onChange={e => setForm(f => ({...f, raum_id: e.target.value}))} style={s.inp}>
                  <option value="">{T('no_room_option')}</option>
                  {raeume.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div style={s.formRow}>
                <label style={s.lbl}>{T('event_location')}</label>
                <input value={form.ort} onChange={e => setForm(f => ({...f, ort: e.target.value}))} style={s.inp} placeholder={T('event_location_placeholder')} />
              </div>
              <div style={s.formRow}>
                <label style={s.lbl}>{T('event_description')}</label>
                <textarea value={form.beschreibung} onChange={e => setForm(f => ({...f, beschreibung: e.target.value}))}
                  style={{ ...s.inp, height: 80, resize: 'vertical' }} placeholder={T('event_description_placeholder')} />
              </div>
              <label style={s.checkRow}>
                <input type="checkbox" checked={form.oeffentlich} onChange={e => setForm(f => ({...f, oeffentlich: e.target.checked}))} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{T('event_public')}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{T('event_public_hint')}</div>
                </div>
              </label>
              <div style={s.modalFooter}>
                <button onClick={() => setModal(null)} style={s.btnSecondary}>{T('cancel')}</button>
                <button onClick={speichern} disabled={senden || !form.titel.trim() || !form.beginn} style={s.btnPrimary}>
                  {senden ? T('loading') : T('save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Teilnehmer-Modal */}
      {modal?.typ === 'teilnehmer' && (
        <div style={s.overlay} onClick={() => setModal(null)}>
          <div style={{ ...s.modalBox, maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitel}>{T('manage_participants')}</h2>
              <button onClick={() => setModal(null)} style={s.closeBtn}>✕</button>
            </div>
            <div style={s.modalBody}>
              <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 14, color: 'var(--text-2)' }}>{modal.event.titel}</div>

              {fehlerTn && <div style={s.fehlerBox}>{fehlerTn}</div>}

              {/* Hinzufügen */}
              <input
                value={tnSuche} onChange={e => { setTnSuche(e.target.value); setAddProfil('') }}
                placeholder={T('member_search')}
                style={s.inp}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <select value={addProfil} onChange={e => setAddProfil(e.target.value)} style={{ ...s.inp, flex: 1 }}>
                  <option value="">{verfuegbar.length === 0 ? T('no_available') : `${T('add_participant')}…`}</option>
                  {verfuegbar.map(p => (
                    <option key={p.id} value={p.id}>{p.voller_name} ({T(p.rolle)})</option>
                  ))}
                </select>
                <button onClick={teilnehmerHinzufuegen} disabled={!addProfil || senden} style={s.btnPrimary}>
                  +
                </button>
              </div>

              {/* Liste */}
              {tLaden ? <div style={s.leer}>{T('loading')}</div>
                : teilnehmer.length === 0 ? <div style={s.leer}>{T('no_participants')}</div>
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {teilnehmer.map(tn => (
                      <div key={tn.profil_id} style={s.teilnehmerRow}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600, fontSize: 14 }}>{tn.profiles?.voller_name}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{T(tn.profiles?.rolle)}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, color: ZUSAGE_FARBE[tn.zusage] }}>
                            {tn.zusage === 'zugesagt' ? T('rsvp_accepted') : tn.zusage === 'abgesagt' ? T('rsvp_declined') : T('rsvp_open')}
                          </span>
                          <button onClick={() => teilnehmerEntfernen(tn.profil_id)} style={{ ...s.btnSm, color: 'var(--danger)', fontSize: 12 }}>
                            {T('remove_participant')}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const ZUSAGE_FARBE = { offen: 'var(--text-3)', zugesagt: 'var(--success)', abgesagt: 'var(--danger)' }

const s = {
  page: { padding: 24, maxWidth: 900, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 16, flexWrap: 'wrap' },
  titel: { fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0 },
  sub: { fontSize: 13, color: 'var(--text-3)', margin: '4px 0 0' },
  fehlerBox: { background: 'color-mix(in srgb, var(--danger) 10%, transparent)', border: '1px solid var(--danger)', borderRadius: 8, padding: '10px 14px', color: 'var(--danger)', fontSize: 13, marginBottom: 16 },
  tabs: { display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-2)', padding: 4, borderRadius: 10, width: 'fit-content' },
  tab: { padding: '6px 16px', borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' },
  tabAktiv: { background: 'var(--surface)', color: 'var(--text)', boxShadow: 'var(--shadow)' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 },
  card: { background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: 20, display: 'flex', flexDirection: 'column', gap: 10, boxShadow: 'var(--shadow)' },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  typBadge: { display: 'flex', alignItems: 'center', gap: 6 },
  typIcon: { fontSize: 20 },
  typLabel: { fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  badge: { fontSize: 11, fontWeight: 600, background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)', borderRadius: 6, padding: '3px 8px' },
  cardTitel: { fontSize: 17, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 },
  cardMeta: { fontSize: 13, color: 'var(--text-2)', display: 'flex', gap: 6, flexWrap: 'wrap' },
  cardBeschreibung: { fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5, borderTop: '1px solid var(--border)', paddingTop: 8 },
  cardActions: { display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 4, borderTop: '1px solid var(--border)', marginTop: 4 },
  leer: { textAlign: 'center', color: 'var(--text-3)', padding: '60px 0', fontSize: 14 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalBox: { background: 'var(--surface)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 480, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border)' },
  modalTitel: { fontSize: 17, fontWeight: 700, color: 'var(--text)', margin: 0 },
  closeBtn: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text-3)', padding: 4, lineHeight: 1 },
  modalBody: { padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 8 },
  formRow: { display: 'flex', flexDirection: 'column', gap: 6 },
  lbl: { fontSize: 13, fontWeight: 600, color: 'var(--text-2)' },
  inp: { padding: '10px 12px', borderRadius: 'var(--radius)', border: '1.5px solid var(--border)', fontSize: 14, fontFamily: 'inherit', background: 'var(--bg)', color: 'var(--text)', width: '100%', boxSizing: 'border-box' },
  checkRow: { display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer', padding: '12px 0', borderTop: '1px solid var(--border)' },
  teilnehmerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--bg-2)', borderRadius: 8 },
  btnPrimary: { padding: '9px 18px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  btnSecondary: { padding: '9px 18px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  btnSm: { padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
}
