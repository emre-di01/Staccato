import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'

const STATUS_CONFIG = {
  offen:          { label: 'Offen',          farbe: 'var(--warning)',  fg: '#fff' },
  in_bearbeitung: { label: 'In Bearbeitung', farbe: 'var(--accent)',   fg: 'var(--accent-fg)' },
  erledigt:       { label: 'Erledigt',       farbe: 'var(--success)',  fg: '#fff' },
}

function StatusBadge({ status }) {
  const c = STATUS_CONFIG[status] ?? STATUS_CONFIG.offen
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
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '28px 32px', width: '100%', maxWidth: 520, boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{titel}</h3>
          <button onClick={onClose} style={s.iconBtn}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ZielModal({ ziel, vorstandMitglieder, schuleId, profilId, onClose, onGespeichert, T }) {
  const [form, setForm] = useState({
    titel: ziel?.titel ?? '',
    beschreibung: ziel?.beschreibung ?? '',
    zeitraum_typ: ziel?.zeitraum_typ ?? 'jahr',
    zeitraum_wert: ziel?.zeitraum_wert ?? String(new Date().getFullYear()),
    verantwortlicher_id: ziel?.verantwortlicher_id ?? '',
    status: ziel?.status ?? 'offen',
  })
  const [laden, setLaden] = useState(false)
  const [fehler, setFehler] = useState('')

  const jahresOptionen = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() + i - 1))
  const quartalOptionen = jahresOptionen.flatMap(j => ['Q1','Q2','Q3','Q4'].map(q => `${j}-${q}`))

  async function speichern() {
    if (!form.titel.trim()) { setFehler(T('title_required')); return }
    setLaden(true)
    const payload = { ...form, schule_id: schuleId, erstellt_von: profilId, verantwortlicher_id: form.verantwortlicher_id || null }
    const { error } = ziel
      ? await supabase.from('vorstand_ziele').update(payload).eq('id', ziel.id)
      : await supabase.from('vorstand_ziele').insert(payload)
    if (error) { setFehler(error.message); setLaden(false); return }
    onGespeichert()
  }

  return (
    <Modal titel={ziel ? T('vorstand_edit_ziel') : T('vorstand_new_ziel')} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={s.label}>{T('name')} *</label>
          <input value={form.titel} onChange={e => setForm(f => ({ ...f, titel: e.target.value }))}
            placeholder={T('vorstand_titel_ziel_placeholder')}
            style={s.input} />
        </div>
        <div>
          <label style={s.label}>Beschreibung</label>
          <textarea value={form.beschreibung} onChange={e => setForm(f => ({ ...f, beschreibung: e.target.value }))}
            rows={3} style={{ ...s.input, resize: 'vertical' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={s.label}>{T('vorstand_zeitraum_label')}</label>
            <select value={form.zeitraum_typ} onChange={e => setForm(f => ({ ...f, zeitraum_typ: e.target.value, zeitraum_wert: e.target.value === 'jahr' ? String(new Date().getFullYear()) : `${new Date().getFullYear()}-Q1` }))
            } style={s.input}>
              <option value="jahr">{T('vorstand_zeitraum_jahr')}</option>
              <option value="quartal">{T('vorstand_zeitraum_quartal')}</option>
            </select>
          </div>
          <div>
            <label style={s.label}>{form.zeitraum_typ === 'jahr' ? T('vorstand_zeitraum_jahr') : T('vorstand_zeitraum_quartal')}</label>
            <select value={form.zeitraum_wert} onChange={e => setForm(f => ({ ...f, zeitraum_wert: e.target.value }))} style={s.input}>
              {(form.zeitraum_typ === 'jahr' ? jahresOptionen : quartalOptionen).map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label style={s.label}>{T('vorstand_verantwortlicher')}</label>
          <select value={form.verantwortlicher_id} onChange={e => setForm(f => ({ ...f, verantwortlicher_id: e.target.value }))} style={s.input}>
            <option value="">{T('vorstand_kein_verantwortlicher')}</option>
            {vorstandMitglieder.map(m => <option key={m.id} value={m.id}>{m.voller_name}</option>)}
          </select>
        </div>
        <div>
          <label style={s.label}>{T('status')}</label>
          <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={s.input}>
            <option value="offen">{T('vorstand_status_offen')}</option>
            <option value="in_bearbeitung">{T('vorstand_status_in_bearbeitung')}</option>
            <option value="erledigt">{T('vorstand_status_erledigt')}</option>
          </select>
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

function AufgabeModal({ aufgabe, zielId, vorstandMitglieder, schuleId, profilId, onClose, onGespeichert, T }) {
  const [form, setForm] = useState({
    titel: aufgabe?.titel ?? '',
    beschreibung: aufgabe?.beschreibung ?? '',
    verantwortlicher_id: aufgabe?.verantwortlicher_id ?? '',
    faellig_am: aufgabe?.faellig_am ?? '',
    status: aufgabe?.status ?? 'offen',
  })
  const [laden, setLaden] = useState(false)
  const [fehler, setFehler] = useState('')

  async function speichern() {
    if (!form.titel.trim()) { setFehler(T('title_required')); return }
    setLaden(true)
    const payload = {
      ...form,
      schule_id: schuleId,
      ziel_id: zielId,
      erstellt_von: profilId,
      verantwortlicher_id: form.verantwortlicher_id || null,
      faellig_am: form.faellig_am || null,
    }
    const { error } = aufgabe
      ? await supabase.from('vorstand_aufgaben').update(payload).eq('id', aufgabe.id)
      : await supabase.from('vorstand_aufgaben').insert(payload)
    if (error) { setFehler(error.message); setLaden(false); return }
    onGespeichert()
  }

  return (
    <Modal titel={aufgabe ? T('vorstand_edit_aufgabe') : T('vorstand_new_aufgabe')} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={s.label}>{T('name')} *</label>
          <input value={form.titel} onChange={e => setForm(f => ({ ...f, titel: e.target.value }))}
            placeholder={T('vorstand_titel_aufgabe_placeholder')}
            style={s.input} />
        </div>
        <div>
          <label style={s.label}>Beschreibung</label>
          <textarea value={form.beschreibung} onChange={e => setForm(f => ({ ...f, beschreibung: e.target.value }))}
            rows={3} style={{ ...s.input, resize: 'vertical' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={s.label}>{T('vorstand_verantwortlicher')}</label>
            <select value={form.verantwortlicher_id} onChange={e => setForm(f => ({ ...f, verantwortlicher_id: e.target.value }))} style={s.input}>
              <option value="">{T('vorstand_kein_verantwortlicher')}</option>
              {vorstandMitglieder.map(m => <option key={m.id} value={m.id}>{m.voller_name}</option>)}
            </select>
          </div>
          <div>
            <label style={s.label}>{T('vorstand_faellig')}</label>
            <input type="date" value={form.faellig_am} onChange={e => setForm(f => ({ ...f, faellig_am: e.target.value }))} style={s.input} />
          </div>
        </div>
        <div>
          <label style={s.label}>{T('status')}</label>
          <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={s.input}>
            <option value="offen">{T('vorstand_status_offen')}</option>
            <option value="in_bearbeitung">{T('vorstand_status_in_bearbeitung')}</option>
            <option value="erledigt">{T('vorstand_status_erledigt')}</option>
          </select>
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

export default function VorstandZiele() {
  const { profil, T } = useApp()
  const [ziele, setZiele] = useState([])
  const [aufgaben, setAufgaben] = useState([])
  const [vorstandMitglieder, setVorstandMitglieder] = useState([])
  const [laden, setLaden] = useState(true)
  const [zeitraumFilter, setZeitraumFilter] = useState('alle')
  const [aufgeklappte, setAufgeklappte] = useState(new Set())
  const [zielModal, setZielModal] = useState(null)
  const [aufgabeModal, setAufgabeModal] = useState(null)

  async function ladeDaten() {
    if (!profil?.schule_id) return
    const [zieleRes, aufgabenRes, mitgliederRes] = await Promise.all([
      supabase.from('vorstand_ziele').select('*').eq('schule_id', profil.schule_id).order('erstellt_am', { ascending: false }),
      supabase.from('vorstand_aufgaben').select('*').eq('schule_id', profil.schule_id).order('erstellt_am', { ascending: false }),
      supabase.from('profiles').select('id, voller_name').eq('schule_id', profil.schule_id).in('rolle', ['vorstand', 'admin', 'superadmin']),
    ])
    setZiele(zieleRes.data ?? [])
    setAufgaben(aufgabenRes.data ?? [])
    setVorstandMitglieder(mitgliederRes.data ?? [])
    setLaden(false)
  }

  useEffect(() => { ladeDaten() }, [profil])

  async function zielLoeschen(id) {
    if (!window.confirm(T('confirm_delete'))) return
    await supabase.from('vorstand_ziele').delete().eq('id', id)
    await ladeDaten()
  }

  async function aufgabeLoeschen(id) {
    if (!window.confirm(T('confirm_delete'))) return
    await supabase.from('vorstand_aufgaben').delete().eq('id', id)
    await ladeDaten()
  }

  async function aufgabeStatusToggle(aufgabe) {
    const neuerStatus = aufgabe.status === 'erledigt' ? 'offen' : aufgabe.status === 'offen' ? 'in_bearbeitung' : 'erledigt'
    await supabase.from('vorstand_aufgaben').update({ status: neuerStatus }).eq('id', aufgabe.id)
    setAufgaben(prev => prev.map(a => a.id === aufgabe.id ? { ...a, status: neuerStatus } : a))
  }

  const zeitraeume = ['alle', ...new Set(ziele.map(z => z.zeitraum_wert).filter(Boolean).sort().reverse())]
  const gefilterteZiele = zeitraumFilter === 'alle' ? ziele : ziele.filter(z => z.zeitraum_wert === zeitraumFilter)

  const profileNamen = Object.fromEntries(vorstandMitglieder.map(m => [m.id, m.voller_name]))

  function toggleAufgeklappt(id) {
    setAufgeklappte(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', margin: 0 }}>🎯 {T('vorstand_ziele')}</h1>
        <button onClick={() => setZielModal({ neu: true })} style={s.btnPrimaer}>{T('vorstand_new_ziel')}</button>
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {zeitraeume.map(z => (
          <button key={z} onClick={() => setZeitraumFilter(z)} style={{
            ...s.filterBtn,
            ...(zeitraumFilter === z ? s.filterBtnAktiv : {}),
          }}>
            {z === 'alle' ? T('vorstand_alle_zeitraeume') : z}
          </button>
        ))}
      </div>

      {laden ? (
        <div style={s.leer}>{T('loading')}</div>
      ) : gefilterteZiele.length === 0 ? (
        <div style={s.leer}>{T('vorstand_no_ziele')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {gefilterteZiele.map(ziel => {
            const zielAufgaben = aufgaben.filter(a => a.ziel_id === ziel.id)
            const offen = zielAufgaben.filter(a => a.status !== 'erledigt').length
            const erledigt = zielAufgaben.filter(a => a.status === 'erledigt').length
            const aufgeklappt = aufgeklappte.has(ziel.id)

            return (
              <div key={ziel.id} style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
                {/* Ziel Header */}
                <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                      <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>{ziel.titel}</span>
                      <StatusBadge status={ziel.status} />
                      <span style={{ fontSize: 11, color: 'var(--text-3)', background: 'var(--bg-2)', padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>
                        {ziel.zeitraum_wert}
                      </span>
                    </div>
                    {ziel.beschreibung && (
                      <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 8 }}>{ziel.beschreibung}</div>
                    )}
                    <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-3)' }}>
                      {ziel.verantwortlicher_id && (
                        <span>👤 {profileNamen[ziel.verantwortlicher_id] ?? '–'}</span>
                      )}
                      {zielAufgaben.length > 0 && (
                        <span>✅ {erledigt}/{zielAufgaben.length} Aufgaben</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                    <button onClick={() => toggleAufgeklappt(ziel.id)} style={{ ...s.iconBtn, fontSize: 13 }}>
                      {aufgeklappt ? '▲' : `▼ ${zielAufgaben.length > 0 ? `(${offen} offen)` : ''}`}
                    </button>
                    <button onClick={() => setZielModal({ ziel })} style={s.iconBtn}>✏️</button>
                    <button onClick={() => zielLoeschen(ziel.id)} style={s.iconBtn}>🗑</button>
                  </div>
                </div>

                {/* Aufgaben (ausgeklappt) */}
                {aufgeklappt && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '12px 20px 16px', background: 'var(--bg)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {T('vorstand_aufgaben_zu_ziel')}
                      </span>
                      <button onClick={() => setAufgabeModal({ neu: true, zielId: ziel.id })} style={{ ...s.btnPrimaer, fontSize: 12, padding: '6px 12px' }}>
                        {T('vorstand_new_aufgabe')}
                      </button>
                    </div>

                    {zielAufgaben.length === 0 ? (
                      <div style={{ fontSize: 13, color: 'var(--text-3)', padding: '8px 0' }}>{T('vorstand_no_aufgaben')}</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {zielAufgaben.map(aufgabe => (
                          <div key={aufgabe.id} style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '12px 14px', border: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                            <button onClick={() => aufgabeStatusToggle(aufgabe)} style={{
                              width: 22, height: 22, borderRadius: '50%', border: '2px solid var(--border)',
                              background: aufgabe.status === 'erledigt' ? 'var(--success)' : aufgabe.status === 'in_bearbeitung' ? 'var(--accent)' : 'transparent',
                              cursor: 'pointer', flexShrink: 0, marginTop: 1,
                            }} title="Status wechseln" />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600, fontSize: 13, color: aufgabe.status === 'erledigt' ? 'var(--text-3)' : 'var(--text)', textDecoration: aufgabe.status === 'erledigt' ? 'line-through' : 'none' }}>
                                {aufgabe.titel}
                              </div>
                              {aufgabe.beschreibung && (
                                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{aufgabe.beschreibung}</div>
                              )}
                              <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                                {aufgabe.verantwortlicher_id && <span>👤 {profileNamen[aufgabe.verantwortlicher_id] ?? '–'}</span>}
                                {aufgabe.faellig_am && <span>📅 {new Date(aufgabe.faellig_am).toLocaleDateString('de-DE')}</span>}
                                <StatusBadge status={aufgabe.status} />
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                              <button onClick={() => setAufgabeModal({ aufgabe, zielId: ziel.id })} style={s.iconBtn}>✏️</button>
                              <button onClick={() => aufgabeLoeschen(aufgabe.id)} style={s.iconBtn}>🗑</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {zielModal && (
        <ZielModal
          ziel={zielModal.ziel ?? null}
          vorstandMitglieder={vorstandMitglieder}
          schuleId={profil.schule_id}
          profilId={profil.id}
          T={T}
          onClose={() => setZielModal(null)}
          onGespeichert={() => { setZielModal(null); ladeDaten() }}
        />
      )}

      {aufgabeModal && (
        <AufgabeModal
          aufgabe={aufgabeModal.aufgabe ?? null}
          zielId={aufgabeModal.zielId}
          vorstandMitglieder={vorstandMitglieder}
          schuleId={profil.schule_id}
          profilId={profil.id}
          T={T}
          onClose={() => setAufgabeModal(null)}
          onGespeichert={() => { setAufgabeModal(null); ladeDaten() }}
        />
      )}
    </div>
  )
}

const s = {
  label: { fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, display: 'block' },
  input: { width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 'var(--radius)', border: '1.5px solid var(--border)', fontSize: 14, background: 'var(--bg)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit' },
  iconBtn: { background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: 'var(--text-3)', padding: '4px 6px', borderRadius: 'var(--radius)' },
  btnPrimaer: { padding: '10px 18px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  btnSekundaer: { padding: '10px 18px', borderRadius: 'var(--radius)', border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  filterBtn: { padding: '7px 14px', borderRadius: 'var(--radius)', border: '1.5px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  filterBtnAktiv: { background: 'var(--primary)', color: 'var(--primary-fg)', borderColor: 'var(--primary)' },
  leer: { padding: '32px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13, background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' },
}
