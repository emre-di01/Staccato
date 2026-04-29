import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'

const TYP_CONFIG = {
  vorstandssitzung:     { label: 'Vorstandssitzung',     farbe: '#7c3aed', fg: '#fff' },
  mitgliederversammlung:{ label: 'Mitgliederversammlung', farbe: 'var(--accent)', fg: 'var(--accent-fg)' },
  sonstiges:            { label: 'Sonstiges',             farbe: 'var(--bg-3)', fg: 'var(--text-2)' },
}

function TypBadge({ typ }) {
  const c = TYP_CONFIG[typ] ?? TYP_CONFIG.sonstiges
  return (
    <span style={{ background: c.farbe, color: c.fg, padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>
      {c.label}
    </span>
  )
}

function Modal({ titel, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '28px 32px', width: '100%', maxWidth: 600, boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{titel}</h3>
          <button onClick={onClose} style={s.iconBtn}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ProtokolModal({ protokoll, vorstandMitglieder, schuleId, profilId, onClose, onGespeichert, T }) {
  const [form, setForm] = useState({
    titel: protokoll?.titel ?? '',
    sitzungstyp: protokoll?.sitzungstyp ?? 'vorstandssitzung',
    datum: protokoll?.datum ?? new Date().toISOString().slice(0, 10),
    teilnehmer_ids: protokoll?.teilnehmer_ids ?? [],
    beschluesse: protokoll?.beschluesse ?? '',
    inhalt: protokoll?.inhalt ?? '',
    event_id: protokoll?.event_id ?? '',
  })
  const [vorstandsEvents, setVorstandsEvents] = useState([])
  const [laden, setLaden] = useState(false)
  const [fehler, setFehler] = useState('')

  useEffect(() => {
    supabase.from('events')
      .select('id, titel, beginn')
      .eq('schule_id', schuleId)
      .eq('typ', 'vorstandssitzung')
      .order('beginn', { ascending: false })
      .then(({ data }) => setVorstandsEvents(data ?? []))
  }, [schuleId])

  function toggleTeilnehmer(id) {
    setForm(f => ({
      ...f,
      teilnehmer_ids: f.teilnehmer_ids.includes(id)
        ? f.teilnehmer_ids.filter(t => t !== id)
        : [...f.teilnehmer_ids, id],
    }))
  }

  async function speichern() {
    if (!form.titel.trim()) { setFehler(T('title_required')); return }
    if (!form.datum) { setFehler(T('all_fields_required')); return }
    setLaden(true)
    const payload = { ...form, schule_id: schuleId, erstellt_von: profilId, event_id: form.event_id || null }
    const { error } = protokoll
      ? await supabase.from('vorstand_protokolle').update(payload).eq('id', protokoll.id)
      : await supabase.from('vorstand_protokolle').insert(payload)
    if (error) { setFehler(error.message); setLaden(false); return }
    onGespeichert()
  }

  return (
    <Modal titel={protokoll ? T('vorstand_edit_protokoll') : T('vorstand_new_protokoll')} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={s.label}>{T('name')} *</label>
          <input value={form.titel} onChange={e => setForm(f => ({ ...f, titel: e.target.value }))}
            placeholder={T('vorstand_titel_protokoll_placeholder')}
            style={s.input} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={s.label}>{T('vorstand_sitzungstyp')}</label>
            <select value={form.sitzungstyp} onChange={e => setForm(f => ({ ...f, sitzungstyp: e.target.value }))} style={s.input}>
              <option value="vorstandssitzung">{T('vorstand_typ_vorstandssitzung')}</option>
              <option value="mitgliederversammlung">{T('vorstand_typ_mitgliederversammlung')}</option>
              <option value="sonstiges">{T('vorstand_typ_sonstiges')}</option>
            </select>
          </div>
          <div>
            <label style={s.label}>{T('date')} *</label>
            <input type="date" value={form.datum} onChange={e => setForm(f => ({ ...f, datum: e.target.value }))} style={s.input} />
          </div>
        </div>

        {/* Teilnehmer */}
        {vorstandMitglieder.length > 0 && (
          <div>
            <label style={s.label}>{T('vorstand_teilnehmer')}</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
              {vorstandMitglieder.map(m => {
                const aktiv = form.teilnehmer_ids.includes(m.id)
                return (
                  <button key={m.id} onClick={() => toggleTeilnehmer(m.id)} style={{
                    padding: '6px 12px', borderRadius: 99, border: '1.5px solid var(--border)',
                    background: aktiv ? 'var(--primary)' : 'var(--bg-2)',
                    color: aktiv ? 'var(--primary-fg)' : 'var(--text-2)',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    {m.voller_name}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {vorstandsEvents.length > 0 && (
          <div>
            <label style={s.label}>🏛 Verknüpfte Vorstandssitzung</label>
            <select value={form.event_id} onChange={e => setForm(f => ({ ...f, event_id: e.target.value }))} style={s.input}>
              <option value="">– Keine –</option>
              {vorstandsEvents.map(ev => (
                <option key={ev.id} value={ev.id}>
                  {new Date(ev.beginn).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })} · {ev.titel}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label style={s.label}>{T('vorstand_beschluesse')}</label>
          <textarea value={form.beschluesse} onChange={e => setForm(f => ({ ...f, beschluesse: e.target.value }))}
            placeholder={T('vorstand_beschluesse_placeholder')}
            rows={3} style={{ ...s.input, resize: 'vertical' }} />
        </div>
        <div>
          <label style={s.label}>{T('vorstand_inhalt')}</label>
          <textarea value={form.inhalt} onChange={e => setForm(f => ({ ...f, inhalt: e.target.value }))}
            placeholder={T('vorstand_inhalt_placeholder')}
            rows={6} style={{ ...s.input, resize: 'vertical' }} />
        </div>

        {fehler && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{fehler}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={onClose} style={s.btnSekundaer}>{T('cancel')}</button>
          <button onClick={speichern} disabled={laden} style={s.btnPrimaer}>{laden ? T('saving') : T('save')}</button>
        </div>
      </div>
    </Modal>
  )
}

function ProtokollDetail({ protokoll, vorstandMitglieder, profilId, schuleId, onClose, T }) {
  const profileNamen = Object.fromEntries(vorstandMitglieder.map(m => [m.id, m.voller_name]))
  const [linkedEvent, setLinkedEvent] = useState(null)
  const [dateien, setDateien] = useState([])
  const [datei, setDatei] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadFehler, setUploadFehler] = useState('')

  useEffect(() => {
    ladeDateien()
    if (protokoll.event_id) {
      supabase.from('events').select('id, titel, beginn').eq('id', protokoll.event_id).single()
        .then(({ data }) => setLinkedEvent(data ?? null))
    }
  }, [protokoll.id])

  async function ladeDateien() {
    const { data } = await supabase
      .from('vorstand_protokoll_dateien')
      .select('*')
      .eq('protokoll_id', protokoll.id)
      .order('erstellt_am', { ascending: false })
    setDateien(data ?? [])
  }

  async function hochladen() {
    if (!datei) return
    setUploading(true); setUploadFehler('')
    const sauber = datei.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const pfad = `${schuleId}/${protokoll.id}/${Date.now()}_${sauber}`
    const { error: sErr } = await supabase.storage.from('vorstand-dateien').upload(pfad, datei)
    if (sErr) { setUploadFehler(sErr.message); setUploading(false); return }
    await supabase.from('vorstand_protokoll_dateien').insert({
      protokoll_id: protokoll.id, schule_id: schuleId,
      name: datei.name, bucket_pfad: pfad, erstellt_von: profilId,
    })
    setDatei(null)
    await ladeDateien()
    setUploading(false)
  }

  async function oeffnen(d) {
    const { data } = await supabase.storage.from('vorstand-dateien').createSignedUrl(d.bucket_pfad, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function loeschen(d) {
    if (!confirm(`„${d.name}" wirklich löschen?`)) return
    await supabase.storage.from('vorstand-dateien').remove([d.bucket_pfad])
    await supabase.from('vorstand_protokoll_dateien').delete().eq('id', d.id)
    setDateien(prev => prev.filter(x => x.id !== d.id))
  }

  return (
    <Modal titel={protokoll.titel} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <TypBadge typ={protokoll.sitzungstyp} />
          <span style={{ fontSize: 13, color: 'var(--text-3)' }}>
            📅 {new Date(protokoll.datum).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>

        {linkedEvent && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 'var(--radius)', background: '#7c3aed18', border: '1px solid #7c3aed44' }}>
            <span style={{ fontSize: 18 }}>🏛</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Vorstandssitzung</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{linkedEvent.titel}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                {new Date(linkedEvent.beginn).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
          </div>
        )}

        {protokoll.teilnehmer_ids?.length > 0 && (
          <div>
            <div style={s.sectionLabel}>{T('vorstand_teilnehmer')}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {protokoll.teilnehmer_ids.map(id => (
                <span key={id} style={{ background: 'var(--bg-2)', padding: '4px 10px', borderRadius: 99, fontSize: 12, color: 'var(--text-2)' }}>
                  👤 {profileNamen[id] ?? id}
                </span>
              ))}
            </div>
          </div>
        )}

        {protokoll.beschluesse && (
          <div>
            <div style={s.sectionLabel}>{T('vorstand_beschluesse')}</div>
            <div style={{ background: 'var(--bg-2)', borderRadius: 'var(--radius)', padding: '12px 16px', fontSize: 14, color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginTop: 6, borderLeft: '3px solid #7c3aed' }}>
              {protokoll.beschluesse}
            </div>
          </div>
        )}

        {protokoll.inhalt && (
          <div>
            <div style={s.sectionLabel}>{T('vorstand_inhalt')}</div>
            <div style={{ background: 'var(--bg-2)', borderRadius: 'var(--radius)', padding: '12px 16px', fontSize: 14, color: 'var(--text)', lineHeight: 1.7, whiteSpace: 'pre-wrap', marginTop: 6 }}>
              {protokoll.inhalt}
            </div>
          </div>
        )}

        {/* Dateien */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <div style={{ ...s.sectionLabel, marginBottom: 10 }}>📎 Anhänge</div>

          {dateien.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {dateien.map(d => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 'var(--radius)', background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 18 }}>📄</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
                      {new Date(d.erstellt_am).toLocaleDateString('de-DE')}
                    </div>
                  </div>
                  <button onClick={() => oeffnen(d)} style={{ ...s.btnSekundaer, fontSize: 12, padding: '6px 10px' }}>↗ Öffnen</button>
                  <button onClick={() => loeschen(d)} style={s.iconBtn}>🗑</button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ flex: 1, padding: '9px 14px', borderRadius: 'var(--radius)', border: '1.5px dashed var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 13, color: datei ? 'var(--text)' : 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {datei ? datei.name : '📎 Datei auswählen …'}
              <input type="file" style={{ display: 'none' }} onChange={e => { setDatei(e.target.files[0] ?? null); setUploadFehler('') }} />
            </label>
            <button onClick={hochladen} disabled={!datei || uploading} style={{ ...s.btnPrimaer, opacity: (!datei || uploading) ? 0.5 : 1, whiteSpace: 'nowrap' }}>
              {uploading ? 'Lädt …' : '⬆ Hochladen'}
            </button>
          </div>
          {uploadFehler && <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 6 }}>{uploadFehler}</div>}
        </div>
      </div>
    </Modal>
  )
}

export default function VorstandProtokolle() {
  const { profil, T } = useApp()
  const [protokolle, setProtokolle] = useState([])
  const [vorstandMitglieder, setVorstandMitglieder] = useState([])
  const [laden, setLaden] = useState(true)
  const [editModal, setEditModal] = useState(null)
  const [detailModal, setDetailModal] = useState(null)
  const [suchtext, setSuchtext] = useState('')
  const [typFilter, setTypFilter] = useState('alle')

  async function ladeDaten() {
    if (!profil?.schule_id) return
    const [protokolleRes, mitgliederRes] = await Promise.all([
      supabase.from('vorstand_protokolle').select('*').eq('schule_id', profil.schule_id).order('datum', { ascending: false }),
      supabase.from('profiles').select('id, voller_name').eq('schule_id', profil.schule_id).in('rolle', ['vorstand', 'admin', 'superadmin']),
    ])
    setProtokolle(protokolleRes.data ?? [])
    setVorstandMitglieder(mitgliederRes.data ?? [])
    setLaden(false)
  }

  useEffect(() => { ladeDaten() }, [profil])

  async function loeschen(id) {
    if (!window.confirm(T('confirm_delete'))) return
    await supabase.from('vorstand_protokolle').delete().eq('id', id)
    setProtokolle(prev => prev.filter(p => p.id !== id))
  }

  const gefilterteProtokolle = protokolle
    .filter(p => typFilter === 'alle' || p.sitzungstyp === typFilter)
    .filter(p => !suchtext || p.titel.toLowerCase().includes(suchtext.toLowerCase()))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', margin: 0 }}>📝 {T('vorstand_protokolle')}</h1>
        <button onClick={() => setEditModal({ neu: true })} style={s.btnPrimaer}>{T('vorstand_new_protokoll')}</button>
      </div>

      {/* Filter + Suche */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={suchtext}
          onChange={e => setSuchtext(e.target.value)}
          placeholder="🔍 Protokoll suchen …"
          style={{ ...s.input, maxWidth: 280 }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          {['alle', 'vorstandssitzung', 'mitgliederversammlung', 'sonstiges'].map(typ => (
            <button key={typ} onClick={() => setTypFilter(typ)} style={{ ...s.filterBtn, ...(typFilter === typ ? s.filterBtnAktiv : {}) }}>
              {typ === 'alle' ? 'Alle' : TYP_CONFIG[typ]?.label ?? typ}
            </button>
          ))}
        </div>
      </div>

      {laden ? (
        <div style={s.leer}>{T('loading')}</div>
      ) : gefilterteProtokolle.length === 0 ? (
        <div style={s.leer}>{T('vorstand_no_protokolle')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {gefilterteProtokolle.map(p => {
            const profileNamen = Object.fromEntries(vorstandMitglieder.map(m => [m.id, m.voller_name]))
            return (
              <div key={p.id} style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)', padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setDetailModal(p)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>{p.titel}</span>
                    <TypBadge typ={p.sitzungstyp} />
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-3)' }}>
                    <span>📅 {new Date(p.datum).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    {p.teilnehmer_ids?.length > 0 && (
                      <span>👥 {p.teilnehmer_ids.map(id => profileNamen[id] ?? '?').join(', ')}</span>
                    )}
                  </div>
                  {p.beschluesse && (
                    <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-2)', borderLeft: '2px solid #7c3aed', paddingLeft: 10 }}>
                      {p.beschluesse.length > 120 ? p.beschluesse.slice(0, 120) + '…' : p.beschluesse}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button onClick={() => setEditModal({ protokoll: p })} style={s.iconBtn}>✏️</button>
                  <button onClick={() => loeschen(p.id)} style={s.iconBtn}>🗑</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {editModal && (
        <ProtokolModal
          protokoll={editModal.protokoll ?? null}
          vorstandMitglieder={vorstandMitglieder}
          schuleId={profil.schule_id}
          profilId={profil.id}
          T={T}
          onClose={() => setEditModal(null)}
          onGespeichert={() => { setEditModal(null); ladeDaten() }}
        />
      )}

      {detailModal && (
        <ProtokollDetail
          protokoll={detailModal}
          vorstandMitglieder={vorstandMitglieder}
          profilId={profil.id}
          schuleId={profil.schule_id}
          T={T}
          onClose={() => setDetailModal(null)}
        />
      )}
    </div>
  )
}

const s = {
  label: { fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, display: 'block' },
  sectionLabel: { fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' },
  input: { width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 'var(--radius)', border: '1.5px solid var(--border)', fontSize: 14, background: 'var(--bg)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit' },
  iconBtn: { background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: 'var(--text-3)', padding: '4px 6px', borderRadius: 'var(--radius)' },
  btnPrimaer: { padding: '10px 18px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  btnSekundaer: { padding: '10px 18px', borderRadius: 'var(--radius)', border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  filterBtn: { padding: '7px 14px', borderRadius: 'var(--radius)', border: '1.5px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  filterBtnAktiv: { background: 'var(--primary)', color: 'var(--primary-fg)', borderColor: 'var(--primary)' },
  leer: { padding: '32px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13, background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' },
}
