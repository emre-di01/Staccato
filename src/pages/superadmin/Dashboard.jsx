import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import Modal from '../../components/Modal'
import { startseiteNach } from '../../components/ProtectedRoute'


export default function SuperadminDashboard() {
  const { schuleWechseln, ladeProfil, session, schule, rolle, T } = useApp()
  const navigate = useNavigate()

  const [schulen,       setSchulen]       = useState([])
  const [laden,         setLaden]         = useState(true)
  const [neuModal,      setNeuModal]      = useState(false)
  const [form,          setForm]          = useState({ name: '', adresse: '', email: '', telefon: '', farbe: '' })
  const [saving,        setSaving]        = useState(false)
  const [fehler,        setFehler]        = useState('')
  const [erfolg,        setErfolg]        = useState('')
  const [wechseln,      setWechseln]      = useState(null)
  const [loeschenModal, setLoeschenModal] = useState(null)
  const [loeschen,      setLoeschen]      = useState(false)
  const [planModal,     setPlanModal]     = useState(null)
  const [planForm,      setPlanForm]      = useState({})
  const [planSaving,    setPlanSaving]    = useState(false)
  const [planFehler,    setPlanFehler]    = useState('')

  useEffect(() => {
    ladeSchulen()
  }, [])

  async function ladeSchulen() {
    setLaden(true)
    const { data } = await supabase.rpc('alle_schulen_stats')
    setSchulen(data ?? [])
    setLaden(false)
  }

  async function handleNeuSchule() {
    if (!form.name.trim()) { setFehler(T('name_required')); return }
    setSaving(true)
    setFehler('')
    const { error } = await supabase.rpc('schule_anlegen', {
      p_name:    form.name,
      p_adresse: form.adresse,
      p_email:   form.email,
      p_telefon: form.telefon,
      p_farbe:   form.farbe || null,
    })
    if (error) { setFehler(error.message); setSaving(false); return }
    setErfolg(T('school_created'))
    setSaving(false)
    setNeuModal(false)
    setForm({ name: '', adresse: '', email: '', telefon: '', farbe: '' })
    await ladeSchulen()
    setTimeout(() => setErfolg(''), 3000)
  }

  async function handleAktivToggle(schule_id, aktiv) {
    await supabase.from('schulen').update({ aktiv: !aktiv }).eq('id', schule_id)
    await ladeSchulen()
  }

  async function handleLoeschen() {
    if (!loeschenModal) return
    setLoeschen(true)
    setFehler('')
    const { error } = await supabase.rpc('demo_schule_loeschen', { p_schule_id: loeschenModal.id })
    if (error) {
      setFehler('Schule konnte nicht gelöscht werden: ' + error.message)
      setLoeschen(false)
      return
    }
    setLoeschenModal(null)
    setLoeschen(false)
    await ladeSchulen()
  }

  function openPlanModal(s) {
    setPlanForm({
      plan:              s.plan ?? 'pro',
      abo_status:        s.abo_status ?? 'aktiv',
      abo_bis:           s.abo_bis ?? '',
      verein_verifiziert: s.verein_verifiziert ?? false,
      hat_vorstand:      s.hat_vorstand ?? true,
      hat_inventar:      s.hat_inventar ?? true,
      max_lehrer:        s.max_lehrer ?? '',
      max_schueler:      s.max_schueler ?? '',
      max_storage_mb:    s.max_storage_mb ?? '',
    })
    setPlanFehler('')
    setPlanModal(s)
  }

  async function handlePlanSpeichern() {
    setPlanSaving(true)
    setPlanFehler('')
    const { error } = await supabase.from('schulen').update({
      plan:               planForm.plan,
      abo_status:         planForm.abo_status,
      abo_bis:            planForm.abo_bis || null,
      verein_verifiziert: planForm.verein_verifiziert,
      hat_vorstand:       planForm.hat_vorstand,
      hat_inventar:       planForm.hat_inventar,
      max_lehrer:         planForm.max_lehrer !== '' ? parseInt(planForm.max_lehrer) : null,
      max_schueler:       planForm.max_schueler !== '' ? parseInt(planForm.max_schueler) : null,
      max_storage_mb:     planForm.max_storage_mb !== '' ? parseInt(planForm.max_storage_mb) : null,
    }).eq('id', planModal.schule_id)
    if (error) { setPlanFehler(error.message); setPlanSaving(false); return }
    setPlanModal(null)
    setPlanSaving(false)
    await ladeSchulen()
  }

  async function handleWechsel(schule_id) {
    if (wechseln) return
    setWechseln(schule_id)
    try {
      await schuleWechseln(schule_id)
      navigate(startseiteNach(rolle), { replace: true })
    } catch (e) {
      console.error(e)
    } finally {
      setWechseln(null)
    }
  }

  function formatDate(dt) {
    if (!dt) return '–'
    return new Date(dt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
            🏫 {T('superadmin_title')}
          </h1>
          <p style={{ color: 'var(--text-3)', fontSize: 14, margin: '4px 0 0' }}>
            {schulen.length} {schulen.length === 1 ? 'Schule' : 'Schulen'} registriert
          </p>
        </div>
        <button onClick={() => setNeuModal(true)} style={btnPri}>
          + {T('create_school')}
        </button>
      </div>

      {erfolg && (
        <div style={{ background: 'color-mix(in srgb, var(--success) 15%, transparent)', border: '1px solid var(--success)', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 20, color: 'var(--success)', fontSize: 14 }}>
          {erfolg}
        </div>
      )}

      {laden ? (
        <div style={{ color: 'var(--text-3)', textAlign: 'center', padding: 48 }}>Lade Schulen …</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {schulen.map(s => {
            const isAktiv = schule?.name === s.name
            return (
              <div key={s.schule_id} className="schul-karte" style={{
                background: 'var(--surface)', border: `1px solid ${isAktiv ? 'var(--primary)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-lg)', padding: '20px 24px',
                display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
              }}>
                {s.logo_url ? (
                  <img src={s.logo_url} alt="" style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{
                    width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                    background: s.farbe ?? 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20, color: '#fff', fontWeight: 700,
                  }}>
                    {s.name.charAt(0).toUpperCase()}
                  </div>
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>{s.name}</span>
                    {isAktiv && (
                      <span style={{ fontSize: 11, background: 'var(--primary)', color: 'var(--primary-fg)', padding: '2px 8px', borderRadius: 99, fontWeight: 700 }}>
                        Aktiv
                      </span>
                    )}
                    {!s.aktiv && (
                      <span style={{ fontSize: 11, background: 'var(--danger)', color: '#fff', padding: '2px 8px', borderRadius: 99, fontWeight: 700 }}>
                        Deaktiviert
                      </span>
                    )}
                    {s.ist_demo && (
                      <span style={{ fontSize: 11, background: '#f59e0b', color: '#fff', padding: '2px 8px', borderRadius: 99, fontWeight: 700 }}>
                        Demo
                      </span>
                    )}
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 99, fontWeight: 700,
                      background: s.abo_status === 'gesperrt' ? 'var(--danger)' : 'color-mix(in srgb, var(--primary) 15%, transparent)',
                      color: s.abo_status === 'gesperrt' ? '#fff' : 'var(--primary)',
                    }}>
                      {s.plan ?? 'pro'}{s.verein_verifiziert ? ' e.V.' : ''}{s.abo_status === 'trial' ? ' (Trial)' : ''}{s.abo_status === 'gesperrt' ? ' ⛔' : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      👥 {s.mitglieder_anzahl} {T('members_count')}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      🕐 {T('last_activity')}: {formatDate(s.letzte_aktivitaet)}
                    </span>
                  </div>
                </div>

                <div className="schul-karte-buttons" style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                  {isAktiv ? (
                    <button
                      onClick={() => navigate('/admin')}
                      style={{ padding: '8px 16px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                    >
                      {T('manage_school')} →
                    </button>
                  ) : (
                    <button
                      onClick={() => handleWechsel(s.schule_id)}
                      disabled={!!wechseln}
                      style={{ padding: '8px 16px', borderRadius: 'var(--radius)', border: '1px solid var(--primary)', background: 'transparent', color: 'var(--primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                    >
                      {wechseln === s.schule_id ? '…' : T('switch_to_school')}
                    </button>
                  )}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => openPlanModal(s)}
                      style={{ flex: 1, padding: '6px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                    >
                      ⚙ Plan
                    </button>
                    <button
                      onClick={() => handleAktivToggle(s.schule_id, s.aktiv)}
                      style={{ flex: 1, padding: '6px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'transparent', color: s.aktiv ? 'var(--warning)' : 'var(--success)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                    >
                      {s.aktiv ? '⏸ Deaktiv.' : '▶ Reaktiv.'}
                    </button>
                    <button
                      onClick={() => setLoeschenModal({ id: s.schule_id, name: s.name })}
                      style={{ padding: '6px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--danger)', background: 'transparent', color: 'var(--danger)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              </div>
            )
          })}

          {schulen.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: 48 }}>
              Noch keine Schulen vorhanden.
            </div>
          )}
        </div>
      )}

      {loeschenModal && (
        <Modal titel="🗑 Schule löschen" onClose={() => { setLoeschenModal(null); setFehler('') }}>
          <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.6 }}>
            Soll <strong>{loeschenModal.name}</strong> wirklich permanent gelöscht werden?
            <br /><br />
            <span style={{ color: 'var(--danger)', fontWeight: 600 }}>⚠ Achtung:</span> Alle Mitglieder und Daten müssen vorher entfernt sein, sonst schlägt das Löschen fehl.
          </p>
          {fehler && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{fehler}</p>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => { setLoeschenModal(null); setFehler('') }} style={btnSek}>Abbrechen</button>
            <button onClick={handleLoeschen} disabled={loeschen} style={{ ...btnPri, background: 'var(--danger)' }}>
              {loeschen ? 'Löschen …' : 'Endgültig löschen'}
            </button>
          </div>
        </Modal>
      )}

      {neuModal && (
        <Modal titel={`+ ${T('create_school')}`} onClose={() => setNeuModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={lbl}>Schulname *</label>
              <input style={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="z.B. Musikschule Musterstadt" autoFocus />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={lbl}>Adresse</label>
              <input style={inp} value={form.adresse} onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))}
                placeholder="Musterstraße 1, 12345 Musterstadt" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={lbl}>E-Mail</label>
                <input type="email" style={inp} value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="info@schule.de" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={lbl}>Telefon</label>
                <input style={inp} value={form.telefon}
                  onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))} placeholder="+49 …" />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={lbl}>Primärfarbe (optional, z.B. #6366f1)</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input style={{ ...inp, flex: 1 }} value={form.farbe}
                  onChange={e => setForm(f => ({ ...f, farbe: e.target.value }))} placeholder="#6366f1" />
                {form.farbe && <div style={{ width: 36, height: 36, borderRadius: 8, background: form.farbe, flexShrink: 0, border: '1px solid var(--border)' }} />}
              </div>
            </div>
            {fehler && <p style={{ color: 'var(--danger)', fontSize: 13, margin: 0 }}>{fehler}</p>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button onClick={() => setNeuModal(false)} style={btnSek}>Abbrechen</button>
              <button onClick={handleNeuSchule} disabled={saving} style={btnPri}>
                {saving ? 'Anlegen …' : '+ Schule anlegen'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {planModal && (
        <Modal titel={`⚙ Plan: ${planModal.name}`} onClose={() => setPlanModal(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={lbl}>Plan</label>
                <select style={inp} value={planForm.plan} onChange={e => setPlanForm(f => ({ ...f, plan: e.target.value }))}>
                  {['solo','starter','verein','pro','enterprise'].map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={lbl}>Abo-Status</label>
                <select style={inp} value={planForm.abo_status} onChange={e => setPlanForm(f => ({ ...f, abo_status: e.target.value }))}>
                  <option value="aktiv">Aktiv</option>
                  <option value="trial">Trial</option>
                  <option value="gesperrt">Gesperrt</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={lbl}>Abo läuft ab (optional)</label>
              <input type="date" style={inp} value={planForm.abo_bis}
                onChange={e => setPlanForm(f => ({ ...f, abo_bis: e.target.value }))} />
            </div>

            <div style={{ display: 'flex', gap: 20 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: 'var(--text)' }}>
                <input type="checkbox" checked={planForm.hat_vorstand}
                  onChange={e => setPlanForm(f => ({ ...f, hat_vorstand: e.target.checked }))} />
                Vorstandsmodul
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: 'var(--text)' }}>
                <input type="checkbox" checked={planForm.hat_inventar}
                  onChange={e => setPlanForm(f => ({ ...f, hat_inventar: e.target.checked }))} />
                Inventarmodul
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: 'var(--text)' }}>
                <input type="checkbox" checked={planForm.verein_verifiziert}
                  onChange={e => setPlanForm(f => ({ ...f, verein_verifiziert: e.target.checked }))} />
                e.V. verifiziert
              </label>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 10px' }}>
                Individuelle Limits (leer = unbegrenzt, überschreibt Plan-Defaults)
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={lbl}>Max. Lehrer</label>
                  <input type="number" style={inp} placeholder="∞" value={planForm.max_lehrer}
                    onChange={e => setPlanForm(f => ({ ...f, max_lehrer: e.target.value }))} min="1" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={lbl}>Max. Schüler</label>
                  <input type="number" style={inp} placeholder="∞" value={planForm.max_schueler}
                    onChange={e => setPlanForm(f => ({ ...f, max_schueler: e.target.value }))} min="1" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={lbl}>Max. Storage (MB)</label>
                  <input type="number" style={inp} placeholder="∞" value={planForm.max_storage_mb}
                    onChange={e => setPlanForm(f => ({ ...f, max_storage_mb: e.target.value }))} min="1" />
                </div>
              </div>
            </div>

            {planFehler && <p style={{ color: 'var(--danger)', fontSize: 13, margin: 0 }}>{planFehler}</p>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button onClick={() => setPlanModal(null)} style={btnSek}>Abbrechen</button>
              <button onClick={handlePlanSpeichern} disabled={planSaving} style={btnPri}>
                {planSaving ? 'Speichern …' : 'Speichern'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <style>{`
        @media (max-width: 640px) {
          .schul-karte { padding: 14px 16px !important; }
          .schul-karte-buttons { width: 100%; flex-shrink: 1 !important; }
          .schul-karte-buttons button { flex: 1; justify-content: center; }
        }
      `}</style>
    </div>
  )
}

const lbl = { fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }
const inp = {
  padding: '10px 14px', borderRadius: 'var(--radius)',
  border: '1.5px solid var(--border)', fontSize: 14,
  outline: 'none', fontFamily: 'inherit',
  background: 'var(--bg)', color: 'var(--text)', width: '100%',
}
const btnPri = {
  padding: '10px 20px', borderRadius: 'var(--radius)', border: 'none',
  background: 'var(--primary)', color: 'var(--primary-fg)',
  fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
}
const btnSek = {
  padding: '10px 20px', borderRadius: 'var(--radius)',
  border: '1px solid var(--border)', background: 'transparent',
  color: 'var(--text-2)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
}
