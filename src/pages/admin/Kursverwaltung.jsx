import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import Avatar from '../../components/Avatar'

const TYP_ICON = { einzel: '🎵', gruppe: '👥', chor: '🎼', ensemble: '🎻' }
const TYP_FARBE = {
  einzel:   { bg: 'var(--bg-2)', text: 'var(--text-2)' },
  gruppe:   { bg: '#dbeafe',     text: '#1e40af' },
  chor:     { bg: '#ede9fe',     text: '#5b21b6' },
  ensemble: { bg: '#d1fae5',     text: '#065f46' },
}
const WOCHENTAGE = [
  { key: 'mo', label: 'Mo' }, { key: 'di', label: 'Di' },
  { key: 'mi', label: 'Mi' }, { key: 'do', label: 'Do' },
  { key: 'fr', label: 'Fr' }, { key: 'sa', label: 'Sa' },
  { key: 'so', label: 'So' },
]

// ─── UI Basis ─────────────────────────────────────────────────

function Modal({ titel, onClose, children, breit = false }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="kurs-modal-inner" style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:'28px 32px', width:'100%', maxWidth: breit ? 680 : 500, boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)', maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
          <h3 style={{ margin:0, fontSize:18, fontWeight:800, color:'var(--text)' }}>{titel}</h3>
          <button onClick={onClose} style={s.iconBtn}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Feld({ label, children, halb = false }) {
  return (
    <div className={halb ? 'kurs-feld-halb' : 'kurs-feld-voll'} style={{ display:'flex', flexDirection:'column', gap:6, gridColumn: halb ? 'span 1' : 'span 2' }}>
      <label style={s.label}>{label}</label>
      {children}
    </div>
  )
}

function Badge({ typ }) {
  const f = TYP_FARBE[typ] ?? TYP_FARBE.einzel
  return (
    <span style={{ background:f.bg, color:f.text, padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:700, textTransform:'capitalize', whiteSpace:'nowrap' }}>
      {TYP_ICON[typ]} {typ}
    </span>
  )
}

// ─── Kurs erstellen / bearbeiten Modal ────────────────────────

function KursModal({ kurs, onClose, onErfolg }) {
  const { T, profil } = useApp()
  const istNeu = !kurs?.id
  const [form, setForm] = useState({
    name:             kurs?.name            ?? '',
    typ:              kurs?.typ             ?? 'einzel',
    instrument_id:    kurs?.instrument_id   ?? '',
    raum_id:          kurs?.raum_id         ?? '',
    wochentag:        kurs?.wochentag       ?? '',
    uhrzeit_von:      kurs?.uhrzeit_von     ?? '',
    uhrzeit_bis:      kurs?.uhrzeit_bis     ?? '',
    abrechnungs_typ:  kurs?.abrechnungs_typ ?? 'einzeln',
    preis_pro_stunde: kurs?.preis_pro_stunde ?? '',
    paket_stunden:    kurs?.paket_stunden   ?? '',
    pauschale_monat:  kurs?.pauschale_monat ?? '',
    farbe:            kurs?.farbe           ?? '#3b82f6',
    notizen:          kurs?.notizen         ?? '',
    aktiv:            kurs?.aktiv           ?? true,
  })
  const [lehrer_ids, setLehrerIds] = useState([])
  const [instrumente, setInstrumente] = useState([])
  const [raeume,      setRaeume]      = useState([])
  const [alleLehrer,  setAlleLehrer]  = useState([])
  const [laden,  setLaden]  = useState(false)
  const [fehler, setFehler] = useState('')

  useEffect(() => {
    async function ladeOptionen() {
      const [i, r, l] = await Promise.all([
        supabase.from('instrumente').select('id, name_de, icon').eq('aktiv', true).eq('schule_id', profil?.schule_id).order('name_de'),
        supabase.from('raeume').select('id, name').eq('schule_id', profil?.schule_id).eq('aktiv', true).order('name'),
        supabase.from('profiles').select('id, voller_name, rolle').in('rolle', ['lehrer', 'admin', 'superadmin']).eq('aktiv', true).order('voller_name'),
      ])
      setInstrumente(i.data ?? [])
      setRaeume(r.data ?? [])
      setAlleLehrer(l.data ?? [])

      // Bestehende Lehrer laden
      if (kurs?.id) {
        const { data: ul } = await supabase.from('unterricht_lehrer').select('lehrer_id').eq('unterricht_id', kurs.id)
        setLehrerIds((ul ?? []).map(u => u.lehrer_id))
      }
    }
    ladeOptionen()
  }, [kurs?.id])

  function toggleLehrer(id) {
    setLehrerIds(prev => prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id])
  }

  async function speichern() {
    if (!form.name) { setFehler(T('kurs_mgmt_err_name')); return }
    if (lehrer_ids.length === 0) { setFehler(T('kurs_mgmt_err_teacher')); return }
    setLaden(true)
    setFehler('')

    if (istNeu) {
      const { error } = await supabase.rpc('create_unterricht', {
        p_name:            form.name,
        p_typ:             form.typ,
        p_instrument_id:   form.instrument_id || null,
        p_lehrer_ids:      lehrer_ids,
        p_raum_id:         form.raum_id || null,
        p_wochentag:       form.wochentag || null,
        p_uhrzeit_von:     form.uhrzeit_von || null,
        p_uhrzeit_bis:     form.uhrzeit_bis || null,
        p_abrechnungs_typ: form.abrechnungs_typ,
        p_preis:           form.preis_pro_stunde || null,
      })
      if (error) { setFehler(error.message); setLaden(false); return }
    } else {
      // Unterricht updaten
      const { error } = await supabase.from('unterricht').update({
        name: form.name, typ: form.typ,
        instrument_id: form.instrument_id || null,
        raum_id: form.raum_id || null,
        wochentag: form.wochentag || null,
        uhrzeit_von: form.uhrzeit_von || null,
        uhrzeit_bis: form.uhrzeit_bis || null,
        abrechnungs_typ: form.abrechnungs_typ,
        preis_pro_stunde: form.preis_pro_stunde || null,
        paket_stunden: form.paket_stunden || null,
        pauschale_monat: form.pauschale_monat || null,
        farbe: form.farbe, notizen: form.notizen, aktiv: form.aktiv,
      }).eq('id', kurs.id)
      if (error) { setFehler(error.message); setLaden(false); return }

      // Lehrer neu setzen
      await supabase.from('unterricht_lehrer').delete().eq('unterricht_id', kurs.id)
      for (let i = 0; i < lehrer_ids.length; i++) {
        await supabase.from('unterricht_lehrer').insert({
          unterricht_id: kurs.id, lehrer_id: lehrer_ids[i],
          rolle: i === 0 ? 'hauptlehrer' : 'co_lehrer',
        })
      }
    }

    onErfolg(); onClose()
  }

  return (
    <Modal titel={istNeu ? T('kurs_mgmt_modal_new') : T('kurs_mgmt_modal_edit')} onClose={onClose} breit>
      <style>{`
        @media (max-width: 600px) {
          .kurs-modal-inner { padding: 20px 16px !important; }
          .kurs-form-grid { grid-template-columns: 1fr !important; }
          .kurs-feld-halb, .kurs-feld-voll { grid-column: span 1 !important; }
          .kurs-zeit-row { flex-direction: column !important; align-items: stretch !important; }
          .kurs-zeit-sep { display: none !important; }
          .kurs-abrechnung-row { flex-wrap: wrap !important; }
          .kurs-modal-btnrow { flex-direction: column-reverse !important; }
          .kurs-modal-btnrow button { width: 100%; justify-content: center; }
        }
      `}</style>
      <div className="kurs-form-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

        {/* Name */}
        <Feld label={T('kurs_mgmt_name')}>
          <input style={s.input} placeholder="z.B. Klavierunterricht Max" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </Feld>

        {/* Typ */}
        <Feld label={T('kurs_mgmt_type')} halb>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {['einzel','gruppe','chor','ensemble'].map(t => (
              <button key={t} onClick={() => setForm(f => ({ ...f, typ: t }))}
                style={{ padding:'6px 12px', borderRadius:'var(--radius)', border:`2px solid ${form.typ===t ? 'var(--accent)' : 'var(--border)'}`, background: form.typ===t ? 'var(--accent)' : 'var(--bg-2)', color: form.typ===t ? 'var(--accent-fg)' : 'var(--text-2)', fontSize:13, cursor:'pointer', fontFamily:'inherit', fontWeight: form.typ===t ? 700 : 400 }}>
                {TYP_ICON[t]} {t}
              </button>
            ))}
          </div>
        </Feld>

        {/* Instrument */}
        <Feld label={T('kurs_mgmt_instrument')} halb>
          <select style={s.input} value={form.instrument_id} onChange={e => setForm(f => ({ ...f, instrument_id: e.target.value }))}>
            <option value="">{T('kurs_mgmt_no_instrument')}</option>
            {instrumente.map(i => <option key={i.id} value={i.id}>{i.icon} {i.name_de}</option>)}
          </select>
        </Feld>

        {/* Raum */}
        <Feld label={T('kurs_mgmt_room')} halb>
          <select style={s.input} value={form.raum_id} onChange={e => setForm(f => ({ ...f, raum_id: e.target.value }))}>
            <option value="">{T('kurs_mgmt_no_room')}</option>
            {raeume.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Feld>

        {/* Wochentag */}
        <Feld label={T('kurs_mgmt_weekday')} halb>
          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
            {WOCHENTAGE.map(w => (
              <button key={w.key} onClick={() => setForm(f => ({ ...f, wochentag: f.wochentag === w.key ? '' : w.key }))}
                style={{ padding:'6px 10px', borderRadius:8, border:`2px solid ${form.wochentag===w.key ? 'var(--primary)' : 'var(--border)'}`, background: form.wochentag===w.key ? 'var(--primary)' : 'var(--bg-2)', color: form.wochentag===w.key ? 'var(--primary-fg)' : 'var(--text-2)', fontSize:12, cursor:'pointer', fontFamily:'inherit', fontWeight: form.wochentag===w.key ? 700 : 400 }}>
                {w.label}
              </button>
            ))}
          </div>
        </Feld>

        {/* Uhrzeit */}
        <Feld label={T('kurs_mgmt_time')} halb>
          <div className="kurs-zeit-row" style={{ display:'flex', gap:8, alignItems:'center' }}>
            <input type="time" style={{ ...s.input, flex:1 }} value={form.uhrzeit_von}
              onChange={e => setForm(f => ({ ...f, uhrzeit_von: e.target.value }))} />
            <span className="kurs-zeit-sep" style={{ color:'var(--text-3)', fontSize:13 }}>{T('kurs_mgmt_time_to')}</span>
            <input type="time" style={{ ...s.input, flex:1 }} value={form.uhrzeit_bis}
              onChange={e => setForm(f => ({ ...f, uhrzeit_bis: e.target.value }))} />
          </div>
        </Feld>

        {/* Abrechnung */}
        <Feld label={T('kurs_mgmt_billing')} halb>
          <div className="kurs-abrechnung-row" style={{ display:'flex', gap:6 }}>
            {['einzeln','paket','pauschale'].map(a => (
              <button key={a} onClick={() => setForm(f => ({ ...f, abrechnungs_typ: a }))}
                style={{ padding:'6px 12px', borderRadius:'var(--radius)', border:`2px solid ${form.abrechnungs_typ===a ? 'var(--accent)' : 'var(--border)'}`, background: form.abrechnungs_typ===a ? 'var(--accent)' : 'var(--bg-2)', color: form.abrechnungs_typ===a ? 'var(--accent-fg)' : 'var(--text-2)', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
                {a}
              </button>
            ))}
          </div>
        </Feld>

        {/* Preis */}
        <Feld label={form.abrechnungs_typ === 'pauschale' ? T('kurs_mgmt_monthly') : T('kurs_mgmt_hourly')} halb>
          <input type="number" style={s.input} placeholder="0.00"
            value={form.abrechnungs_typ === 'pauschale' ? form.pauschale_monat : form.preis_pro_stunde}
            onChange={e => setForm(f => form.abrechnungs_typ === 'pauschale'
              ? ({ ...f, pauschale_monat: e.target.value })
              : ({ ...f, preis_pro_stunde: e.target.value }))} />
        </Feld>

        {form.abrechnungs_typ === 'paket' && (
          <Feld label={T('kurs_mgmt_package_hours')} halb>
            <input type="number" style={s.input} placeholder="10" value={form.paket_stunden}
              onChange={e => setForm(f => ({ ...f, paket_stunden: e.target.value }))} />
          </Feld>
        )}

        {/* Lehrer */}
        <Feld label={`${T('kurs_mgmt_teacher')} * (${lehrer_ids.length} ${T('kurs_mgmt_selected')})`}>
          <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:160, overflowY:'auto', padding:4 }}>
            {alleLehrer.map((l, idx) => {
              const aktiv = lehrer_ids.includes(l.id)
              const istErster = lehrer_ids[0] === l.id
              return (
                <div key={l.id} onClick={() => toggleLehrer(l.id)}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderRadius:'var(--radius)', border:`1.5px solid ${aktiv ? 'var(--primary)' : 'var(--border)'}`, background: aktiv ? 'var(--bg-2)' : 'transparent', cursor:'pointer', userSelect:'none' }}>
                  <div style={{ width:20, height:20, borderRadius:4, border:`2px solid ${aktiv ? 'var(--primary)' : 'var(--border)'}`, background: aktiv ? 'var(--primary)' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, color:'var(--primary-fg)', flexShrink:0 }}>
                    {aktiv && '✓'}
                  </div>
                  <span style={{ fontSize:14, color:'var(--text)', fontWeight: aktiv ? 600 : 400 }}>{l.voller_name}</span>
                  {(l.rolle === 'admin' || l.rolle === 'superadmin') && (
                    <span style={{ fontSize:10, fontWeight:700, color:'#7c3aed', background:'#ede9fe', padding:'2px 6px', borderRadius:99 }}>
                      {l.rolle === 'superadmin' ? 'SUPERADMIN' : 'ADMIN'}
                    </span>
                  )}
                  {istErster && aktiv && <span style={{ marginLeft:'auto', fontSize:10, color:'var(--accent)', fontWeight:700 }}>{T('kurs_head_teacher')}</span>}
                  {aktiv && !istErster && <span style={{ marginLeft:'auto', fontSize:10, color:'var(--text-3)', fontWeight:700 }}>{T('kurs_mgmt_co_teacher')}</span>}
                </div>
              )
            })}
          </div>
        </Feld>

        {/* Notizen */}
        <Feld label={T('kurs_mgmt_notes')}>
          <textarea style={{ ...s.input, minHeight:60, resize:'vertical' }} value={form.notizen}
            onChange={e => setForm(f => ({ ...f, notizen: e.target.value }))} />
        </Feld>

        {!istNeu && (
          <Feld label="" halb>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <input type="checkbox" id="aktiv" checked={form.aktiv} onChange={e => setForm(f => ({ ...f, aktiv: e.target.checked }))} />
              <label htmlFor="aktiv" style={{ ...s.label, textTransform:'none', letterSpacing:0 }}>{T('kurs_course_active')}</label>
            </div>
          </Feld>
        )}

        {fehler && <p style={{ ...s.fehler, gridColumn:'span 2' }}>{fehler}</p>}

        <div className="kurs-modal-btnrow kurs-feld-voll" style={{ gridColumn:'span 2', display:'flex', gap:10, justifyContent:'flex-end', marginTop:8 }}>
          <button onClick={onClose} style={s.btnSek}>{T('cancel')}</button>
          <button onClick={speichern} disabled={laden} style={s.btnPri}>
            {laden ? '…' : istNeu ? T('kurs_mgmt_create') : `💾 ${T('save')}`}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Schüler verwalten Modal ──────────────────────────────────

function SchuelerModal({ kurs, onClose, onErfolg }) {
  const { T, confirm } = useApp()
  const [teilnehmer, setTeilnehmer] = useState([])
  const [alleSchueler, setAlleSchueler] = useState([])
  const [laden, setLaden] = useState(true)

  useEffect(() => {
    async function laden() {
      const [t, s] = await Promise.all([
        supabase.from('unterricht_schueler')
          .select('*, profiles!unterricht_schueler_schueler_id_fkey(id, voller_name, geburtsdatum, rolle, avatar_url)')
          .eq('unterricht_id', kurs.id),
        supabase.from('profiles').select('id, voller_name, rolle').in('rolle', ['schueler', 'vorstand', 'admin', 'superadmin']).eq('aktiv', true).order('voller_name'),
      ])
      setTeilnehmer(t.data ?? [])
      setAlleSchueler(s.data ?? [])
      setLaden(false)
    }
    laden()
  }, [kurs.id])

  async function hinzufuegen(schuelerId) {
    await supabase.from('unterricht_schueler').upsert({ unterricht_id: kurs.id, schueler_id: schuelerId, status: 'aktiv' })
    const { data } = await supabase.from('unterricht_schueler')
      .select('*, profiles!unterricht_schueler_schueler_id_fkey(id, voller_name, geburtsdatum, rolle, avatar_url)')
      .eq('unterricht_id', kurs.id)
    setTeilnehmer(data ?? [])
  }

  async function entfernen(schuelerId) {
    if (!await confirm(T('kurs_mgmt_confirm_remove'), { confirmLabel: 'Entfernen' })) return
    await supabase.from('unterricht_schueler').delete().eq('unterricht_id', kurs.id).eq('schueler_id', schuelerId)
    setTeilnehmer(prev => prev.filter(t => t.schueler_id !== schuelerId))
  }

  async function statusAendern(schuelerId, status) {
    await supabase.from('unterricht_schueler').update({ status }).eq('unterricht_id', kurs.id).eq('schueler_id', schuelerId)
    setTeilnehmer(prev => prev.map(t => t.schueler_id === schuelerId ? { ...t, status } : t))
  }

  const [suche, setSuche] = useState('')
  const teilnehmerIds = new Set(teilnehmer.map(t => t.schueler_id))
  const verfuegbar = alleSchueler.filter(s =>
    !teilnehmerIds.has(s.id) &&
    (!suche || s.voller_name.toLowerCase().includes(suche.toLowerCase()))
  )

  return (
    <Modal titel={`${T('kurs_mgmt_students_title')} – ${kurs.name}`} onClose={onClose} breit>
      <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

        {/* Aktuelle Teilnehmer */}
        <div>
          <div style={s.sectionLabel}>{T('kurs_mgmt_current_students')} ({teilnehmer.length})</div>
          {laden ? <p style={{ color:'var(--text-3)', fontSize:13 }}>{T('loading')}</p> :
          teilnehmer.length === 0 ? <p style={{ color:'var(--text-3)', fontSize:13 }}>{T('kurs_no_students_yet')}</p> : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {teilnehmer.map(t => (
                <div key={t.schueler_id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:'var(--radius)', background:'var(--bg-2)', border:'1px solid var(--border)' }}>
                  <Avatar name={t.profiles?.voller_name} avatarUrl={t.profiles?.avatar_url} size={32} />
                  <span style={{ flex:1, fontSize:14, fontWeight:600, color:'var(--text)' }}>{t.profiles?.voller_name}</span>
                  {(t.profiles?.rolle === 'admin' || t.profiles?.rolle === 'superadmin') && (
                    <span style={{ fontSize:10, color:'var(--text-3)', background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:4, padding:'1px 5px' }}>Admin</span>
                  )}
                  <select value={t.status} onChange={e => statusAendern(t.schueler_id, e.target.value)}
                    style={{ ...s.input, width:'auto', fontSize:12, padding:'4px 8px' }}>
                    <option value="aktiv">{T('kurs_mgmt_status_active')}</option>
                    <option value="probe">{T('kurs_mgmt_status_trial')}</option>
                    <option value="pausiert">{T('kurs_mgmt_status_paused')}</option>
                    <option value="abgemeldet">{T('kurs_mgmt_status_resigned')}</option>
                  </select>
                  <button onClick={() => entfernen(t.schueler_id)} style={{ ...s.iconBtn, color:'var(--danger)' }}>🗑</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Schüler hinzufügen */}
        {alleSchueler.filter(s => !teilnehmerIds.has(s.id)).length > 0 && (
          <div>
            <div style={s.sectionLabel}>{T('kurs_add_students')}</div>
            <input
              type="text"
              value={suche}
              onChange={e => setSuche(e.target.value)}
              placeholder={T('kurs_mgmt_search_name')}
              style={{ ...s.input, marginTop:8, marginBottom:8, width:'100%', boxSizing:'border-box' }}
            />
            {verfuegbar.length === 0 ? (
              <p style={{ fontSize:13, color:'var(--text-3)', margin:0 }}>{T('kurs_mgmt_no_matches')}</p>
            ) : (
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {verfuegbar.map(sc => (
                  <button key={sc.id} onClick={() => hinzufuegen(sc.id)}
                    style={{ padding:'6px 12px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--surface)', color:'var(--text-2)', fontSize:13, cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s' }}>
                    + {sc.voller_name}{(sc.rolle === 'admin' || sc.rolle === 'superadmin') ? ' (Admin)' : ''}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ display:'flex', justifyContent:'flex-end' }}>
          <button onClick={() => { onErfolg(); onClose() }} style={s.btnPri}>{T('kurs_mgmt_done')}</button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Stunden generieren Modal ─────────────────────────────────

function StundenModal({ kurs, onClose, onErfolg }) {
  const { T, confirm } = useApp()
  const [von,         setVon]         = useState('')
  const [bis,         setBis]         = useState('')
  const [laden,       setLaden]       = useState(false)
  const [loeschLaden, setLoeschLaden] = useState(false)
  const [result,      setResult]      = useState(null)
  const [geloescht,   setGeloescht]   = useState(null)
  const [fehler,      setFehler]      = useState('')

  async function generieren() {
    if (!von || !bis) { setFehler(T('kurs_mgmt_err_dates')); return }
    if (!kurs.wochentag) { setFehler('Kurs hat keinen Wochentag definiert.'); return }
    setLaden(true); setFehler(''); setGeloescht(null)
    const { data, error } = await supabase.rpc('stunden_generieren', {
      p_unterricht_id: kurs.id,
      p_von: von,
      p_bis: bis,
    })
    if (error) setFehler(error.message)
    else setResult(data)
    setLaden(false)
  }

  async function loeschen() {
    if (!von || !bis) { setFehler(T('kurs_mgmt_err_dates')); return }
    if (!await confirm(`Alle Stunden von ${von} bis ${bis} für „${kurs.name}" löschen?`, { confirmLabel: 'Löschen' })) return
    setLoeschLaden(true); setFehler(''); setResult(null)
    const { data, error } = await supabase
      .from('stunden')
      .delete()
      .eq('unterricht_id', kurs.id)
      .gte('beginn', `${von}T00:00:00`)
      .lte('beginn', `${bis}T23:59:59`)
      .select('id')
    if (error) setFehler(error.message)
    else setGeloescht(data?.length ?? 0)
    setLoeschLaden(false)
  }

  return (
    <Modal titel={`${T('kurs_mgmt_lessons_title')} – ${kurs.name}`} onClose={onClose}>
      <div style={s.formGrid}>
        {kurs.wochentag ? (
          <div style={{ padding:'10px 14px', borderRadius:'var(--radius)', background:'var(--bg-2)', border:'1px solid var(--border)', fontSize:14, color:'var(--text-2)' }}>
            📅 {T('kurs_mgmt_weekly')} <strong>{kurs.wochentag?.toUpperCase()}</strong> {T('kurs_mgmt_weekly_from')} <strong>{kurs.uhrzeit_von}</strong> {T('kurs_mgmt_time_to')} <strong>{kurs.uhrzeit_bis}</strong>
          </div>
        ) : (
          <div style={{ padding:'10px 14px', borderRadius:'var(--radius)', background:'#fee2e2', border:'1px solid #fecaca', fontSize:13, color:'var(--danger)' }}>
            {T('kurs_mgmt_no_weekday')}
          </div>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={s.label}>{T('kurs_mgmt_date_from')}</label>
            <input type="date" style={s.input} value={von} onChange={e => setVon(e.target.value)} />
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={s.label}>{T('kurs_mgmt_date_to')}</label>
            <input type="date" style={s.input} value={bis} onChange={e => setBis(e.target.value)} />
          </div>
        </div>

        {result !== null && (
          <div style={{ padding:'12px 16px', borderRadius:'var(--radius)', background:'var(--bg-2)', border:'1px solid var(--success)', color:'var(--success)', fontWeight:700, fontSize:14 }}>
            ✅ {result} {T('kurs_mgmt_lessons_generated')}
          </div>
        )}
        {geloescht !== null && (
          <div style={{ padding:'12px 16px', borderRadius:'var(--radius)', background:'#fee2e2', border:'1px solid #fecaca', color:'var(--danger)', fontWeight:700, fontSize:14 }}>
            🗑 {geloescht} {T('kurs_mgmt_lessons_removed')}
          </div>
        )}

        {fehler && <p style={s.fehler}>{fehler}</p>}

        <div style={{ display:'flex', gap:10, justifyContent:'space-between', marginTop:8 }}>
          <button onClick={loeschen} disabled={loeschLaden || !von || !bis}
            style={{ ...s.btnSek, color:'var(--danger)', borderColor:'var(--danger)' }}>
            {loeschLaden ? T('kurs_mgmt_deleting') : T('kurs_mgmt_delete_lessons')}
          </button>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={onClose} style={s.btnSek}>{T('close')}</button>
            <button onClick={generieren} disabled={laden || !kurs.wochentag} style={s.btnPri}>
              {laden ? T('kurs_mgmt_generating') : T('kurs_mgmt_generate')}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ─── Kurs Detail / Karte ──────────────────────────────────────

function KursKarte({ kurs, onBearbeiten, onLoeschen, onDetail, T }) {
  return (
    <div
      onClick={onDetail}
      style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)', boxShadow: 'var(--shadow)',
        overflow: 'hidden', cursor: 'pointer',
        transition: 'box-shadow 0.15s, border-color 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; e.currentTarget.style.borderColor = 'var(--primary)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow)';    e.currentTarget.style.borderColor = 'var(--border)' }}
    >
      {/* Farbstreifen */}
      <div style={{ height: 4, background: kurs.farbe ?? 'var(--primary)' }} />

      <div style={{ padding: '16px 20px' }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10, marginBottom:12 }}>
          <div>
            <div style={{ fontSize:16, fontWeight:800, color:'var(--text)', marginBottom:4 }}>{kurs.name}</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              <Badge typ={kurs.typ} />
              {kurs.instrumente && <span style={{ fontSize:11, color:'var(--text-3)' }}>{kurs.instrumente.icon} {kurs.instrumente.name_de}</span>}
            </div>
          </div>
          <span style={{ fontSize:11, fontWeight:700, color: kurs.aktiv ? 'var(--success)' : 'var(--danger)', whiteSpace:'nowrap' }}>
            {kurs.aktiv ? T('kurs_mgmt_badge_active') : T('kurs_mgmt_badge_inactive')}
          </span>
        </div>

        {/* Meta-Info */}
        <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:14 }}>
          {kurs.wochentag && (
            <div style={{ fontSize:13, color:'var(--text-2)', display:'flex', alignItems:'center', gap:6 }}>
              📅 {kurs.wochentag.toUpperCase()} · {kurs.uhrzeit_von?.slice(0,5)} – {kurs.uhrzeit_bis?.slice(0,5)} Uhr
            </div>
          )}
          {kurs.raeume && (
            <div style={{ fontSize:13, color:'var(--text-2)', display:'flex', alignItems:'center', gap:6 }}>
              🏫 {kurs.raeume.name}
            </div>
          )}
          {kurs.unterricht_lehrer?.length > 0 && (
            <div style={{ fontSize:13, color:'var(--text-2)', display:'flex', alignItems:'center', gap:6 }}>
              👨‍🏫 {kurs.unterricht_lehrer.map(ul => ul.profiles?.voller_name).filter(Boolean).join(', ')}
            </div>
          )}
          <div style={{ fontSize:13, color:'var(--text-2)', display:'flex', alignItems:'center', gap:6 }}>
            👥 {kurs.unterricht_schueler?.length ?? 0} {T('kurs_mgmt_card_students')} ·
            💰 {kurs.abrechnungs_typ === 'pauschale' ? `€${kurs.pauschale_monat}${T('kurs_mgmt_per_month')}` : kurs.abrechnungs_typ === 'paket' ? `${kurs.paket_stunden}er Paket` : `€${kurs.preis_pro_stunde}${T('kurs_mgmt_per_hour')}`}
          </div>
        </div>

        {/* Aktionen */}
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }} onClick={e => e.stopPropagation()}>
          <button onClick={onBearbeiten} style={s.btnKlein}>{T('kurs_mgmt_edit')}</button>
          <button onClick={onLoeschen}   style={{ ...s.btnKlein, color:'var(--danger)' }}>{T('kurs_mgmt_delete')}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Kurs Löschen Modal ───────────────────────────────────────

function KursLoeschenModal({ kurs, onClose, onErfolg }) {
  const { T } = useApp()
  const [laden,  setLaden]  = useState(false)
  const [fehler, setFehler] = useState('')

  async function loeschen() {
    setLaden(true)
    setFehler('')

    // 1. Kurs-Dateien aus Storage löschen (kurs-dateien & schueler-dateien)
    const { data: docs } = await supabase.from('dateien')
      .select('bucket_pfad, schueler_id').eq('unterricht_id', kurs.id)
    if (docs?.length > 0) {
      const kursPfade     = docs.filter(d => !d.schueler_id).map(d => d.bucket_pfad)
      const schuelerPfade = docs.filter(d =>  d.schueler_id).map(d => d.bucket_pfad)
      if (kursPfade.length > 0)     await supabase.storage.from('kurs-dateien').remove(kursPfade)
      if (schuelerPfade.length > 0) await supabase.storage.from('schueler-dateien').remove(schuelerPfade)
    }

    // 2. Stücke löschen die ausschließlich in diesem Kurs verwendet werden
    const { data: kStuecke } = await supabase.from('unterricht_stuecke')
      .select('stueck_id').eq('unterricht_id', kurs.id)
    for (const { stueck_id } of (kStuecke ?? [])) {
      const [{ count: kCount }, { count: eCount }] = await Promise.all([
        supabase.from('unterricht_stuecke').select('*', { count: 'exact', head: true }).eq('stueck_id', stueck_id).neq('unterricht_id', kurs.id),
        supabase.from('event_stuecke').select('*', { count: 'exact', head: true }).eq('stueck_id', stueck_id),
      ])
      if ((kCount ?? 0) === 0 && (eCount ?? 0) === 0) {
        const { data: sDocs } = await supabase.from('stueck_dateien').select('bucket_pfad').eq('stueck_id', stueck_id)
        if (sDocs?.length > 0) await supabase.storage.from('stueck-dateien').remove(sDocs.map(d => d.bucket_pfad))
        await supabase.from('stuecke').delete().eq('id', stueck_id)
      }
    }

    // 3. Kurs löschen (kaskadiert auf stunden, anwesenheit, dateien, etc.)
    const { error } = await supabase.rpc('delete_unterricht', { p_unterricht_id: kurs.id })
    if (error) {
      const { error: e2 } = await supabase.from('unterricht').delete().eq('id', kurs.id)
      if (e2) { setFehler(e2.message); setLaden(false); return }
    }
    onErfolg()
    onClose()
  }

  return (
    <Modal titel={T('kurs_mgmt_delete_title')} onClose={onClose}>
      <div style={s.formGrid}>
        <div style={{ padding:'16px', borderRadius:'var(--radius)', background:'#fee2e2', border:'1px solid #fecaca', color:'var(--danger)', fontSize:14, lineHeight:1.6 }}>
          ⚠️ Bist du sicher, dass du <strong>„{kurs.name}"</strong> löschen möchtest?<br/>
          <span style={{ fontSize:12, opacity:0.8 }}>{T('kurs_mgmt_delete_warning')}</span>
        </div>
        {fehler && <p style={s.fehler}>{fehler}</p>}
        <div style={s.btnRow}>
          <button onClick={onClose} style={s.btnSek}>{T('cancel')}</button>
          <button onClick={loeschen} disabled={laden}
            style={{ ...s.btnPri, background:'var(--danger)' }}>
            {laden ? T('kurs_mgmt_deleting') : T('kurs_mgmt_delete_btn')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Hauptkomponente ──────────────────────────────────────────

export default function Kursverwaltung() {
  const { T, profil } = useApp()
  const navigate = useNavigate()
  const [kurse,       setKurse]       = useState([])
  const [laden,       setLaden]       = useState(true)
  const [suche,       setSuche]       = useState('')
  const [filterTyp,   setFilterTyp]   = useState('alle')
  const [filterAktiv, setFilterAktiv] = useState('aktiv')
  const [modal,       setModal]       = useState(null)

  const ladeKurse = useCallback(async () => {
    if (!profil?.schule_id) return
    setLaden(true)
    const { data } = await supabase
      .from('unterricht')
      .select(`
        *,
        instrumente(id, name_de, icon),
        raeume(id, name),
        unterricht_lehrer(lehrer_id, rolle, profiles!unterricht_lehrer_lehrer_id_fkey(voller_name)),
        unterricht_schueler(schueler_id, status)
      `)
      .eq('schule_id', profil.schule_id)
      .order('name')
    setKurse(data ?? [])
    setLaden(false)
  }, [profil?.schule_id])

  useEffect(() => { ladeKurse() }, [ladeKurse])

  const gefiltert = kurse.filter(k => {
    const passt   = k.name?.toLowerCase().includes(suche.toLowerCase())
    const typPasst = filterTyp === 'alle' || k.typ === filterTyp
    const aktivPasst = filterAktiv === 'alle' || (filterAktiv === 'aktiv' ? k.aktiv : !k.aktiv)
    return passt && typPasst && aktivPasst
  })

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={s.h1}>{T('kurs_mgmt_title')}</h1>
          <p style={s.sub}>{kurse.length} {T('kurs_mgmt_courses')} · {kurse.filter(k=>k.aktiv).length} {T('kurs_mgmt_active')}</p>
        </div>
        <button onClick={() => setModal({ typ:'kurs' })} style={s.btnPri}>{T('kurs_mgmt_new')}</button>
      </div>

      {/* Filter */}
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <input placeholder={T('kurs_search')} value={suche} onChange={e => setSuche(e.target.value)}
          style={{ ...s.input, flex:1, maxWidth:300 }} />
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {['alle','einzel','gruppe','chor','ensemble'].map(t => (
            <button key={t} onClick={() => setFilterTyp(t)}
              style={{ padding:'6px 14px', borderRadius:99, border:'1.5px solid var(--border)', background: filterTyp===t ? 'var(--primary)' : 'var(--surface)', color: filterTyp===t ? 'var(--primary-fg)' : 'var(--text-2)', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s' }}>
              {t === 'alle' ? T('kurs_mgmt_filter_all') : `${TYP_ICON[t]} ${t}`}
            </button>
          ))}
        </div>
        <select style={{ ...s.input, width:'auto' }} value={filterAktiv} onChange={e => setFilterAktiv(e.target.value)}>
          <option value="alle">{T('kurs_mgmt_filter_all')}</option>
          <option value="aktiv">{T('kurs_mgmt_filter_active')}</option>
          <option value="inaktiv">{T('kurs_mgmt_filter_inactive')}</option>
        </select>
      </div>

      {/* Kurse Grid */}
      {laden ? (
        <div style={s.leer}>{T('kurs_loading')}</div>
      ) : gefiltert.length === 0 ? (
        <div style={s.leer}>
          <div style={{ marginBottom: 12 }}>{T('kurs_none_found')}</div>
          {suche === '' && filterTyp === 'alle' && filterAktiv !== 'inaktiv' && (
            <button onClick={() => setModal({ typ:'kurs' })} style={s.btnPri}>{T('kurs_mgmt_new')}</button>
          )}
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:16 }}>
          {gefiltert.map(kurs => (
            <KursKarte
              key={kurs.id}
              kurs={kurs}
              T={T}
              onDetail={()     => navigate(`/admin/kurse/${kurs.id}`)}
              onBearbeiten={() => setModal({ typ:'kurs', kurs })}
              onLoeschen={()   => setModal({ typ:'loeschen', kurs })}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {modal?.typ === 'kurs'     && <KursModal     kurs={modal.kurs} onClose={() => setModal(null)} onErfolg={ladeKurse} />}
      {modal?.typ === 'schueler' && <SchuelerModal kurs={modal.kurs} onClose={() => setModal(null)} onErfolg={ladeKurse} />}
      {modal?.typ === 'stunden'  && <StundenModal  kurs={modal.kurs} onClose={() => setModal(null)} onErfolg={ladeKurse} />}
      {modal?.typ === 'loeschen' && <KursLoeschenModal kurs={modal.kurs} onClose={() => setModal(null)} onErfolg={ladeKurse} />}
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────
const s = {
  h1:           { margin:'0 0 4px', fontSize:26, fontWeight:800, color:'var(--text)', letterSpacing:'-0.5px' },
  sub:          { margin:0, color:'var(--text-3)', fontSize:14 },
  label:        { fontSize:12, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em' },
  sectionLabel: { fontSize:12, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 },
  input:        { padding:'10px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', fontSize:14, outline:'none', fontFamily:'inherit', background:'var(--bg)', color:'var(--text)', width:'100%', boxSizing:'border-box', transition:'border-color 0.15s' },
  btnPri:       { padding:'10px 20px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg)', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' },
  btnSek:       { padding:'10px 16px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-2)', fontSize:14, cursor:'pointer', fontFamily:'inherit' },
  btnKlein:     { padding:'6px 12px', borderRadius:'var(--radius)', border:'none', background:'var(--bg-2)', color:'var(--text-2)', fontSize:13, cursor:'pointer', fontFamily:'inherit', fontWeight:500 },
  iconBtn:      { background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--text-3)', padding:4 },
  leer:         { padding:'64px', textAlign:'center', color:'var(--text-3)', fontSize:14, background:'var(--surface)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)' },
  formGrid:     { display:'flex', flexDirection:'column', gap:16 },
  btnRow:       { display:'flex', gap:10, justifyContent:'flex-end', marginTop:8 },
  fehler:       { margin:0, color:'var(--danger)', fontSize:13 },
}
