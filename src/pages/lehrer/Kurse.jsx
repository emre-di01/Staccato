import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'

const TYP_ICON = { einzel: '🎵', gruppe: '👥', chor: '🎼', ensemble: '🎻' }
const WOCHENTAGE = [
  { wert: 'mo', label: 'Montag' },
  { wert: 'di', label: 'Dienstag' },
  { wert: 'mi', label: 'Mittwoch' },
  { wert: 'do', label: 'Donnerstag' },
  { wert: 'fr', label: 'Freitag' },
  { wert: 'sa', label: 'Samstag' },
  { wert: 'so', label: 'Sonntag' },
]

function NeuerKursModal({ onClose, onErfolg }) {
  const { profil } = useApp()
  const [form, setForm] = useState({
    name: '', typ: 'einzel', instrument_id: '', raum_id: '',
    wochentag: '', uhrzeit_von: '', uhrzeit_bis: '',
  })
  const [instrumente, setInstrumente] = useState([])
  const [raeume,      setRaeume]      = useState([])
  const [laden,  setLaden]  = useState(false)
  const [fehler, setFehler] = useState('')

  useEffect(() => {
    async function ladeOptionen() {
      const [i, r] = await Promise.all([
        supabase.from('instrumente').select('id, name_de, icon').eq('aktiv', true).eq('schule_id', profil?.schule_id).order('name_de'),
        supabase.from('raeume').select('id, name').eq('aktiv', true).order('name'),
      ])
      setInstrumente(i.data ?? [])
      setRaeume(r.data ?? [])
    }
    ladeOptionen()
  }, [profil?.schule_id])

  async function speichern() {
    if (!form.name) { setFehler('Name ist erforderlich.'); return }
    setLaden(true)
    setFehler('')
    const { error } = await supabase.rpc('create_unterricht', {
      p_name:          form.name,
      p_typ:           form.typ,
      p_instrument_id: form.instrument_id || null,
      p_lehrer_ids:    [profil.id],
      p_raum_id:       form.raum_id || null,
      p_wochentag:     form.wochentag || null,
      p_uhrzeit_von:   form.uhrzeit_von || null,
      p_uhrzeit_bis:   form.uhrzeit_bis || null,
      p_schule_id:     profil.schule_id,
    })
    if (error) { setFehler(error.message); setLaden(false); return }
    onErfolg(); onClose()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:'28px 32px', width:'100%', maxWidth:480, boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)', maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
          <h3 style={{ margin:0, fontSize:18, fontWeight:800, color:'var(--text)' }}>+ Neuer Kurs</h3>
          <button onClick={onClose} style={s.iconBtn}>✕</button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label style={s.label}>Kursname *</label>
            <input style={s.input} placeholder="z.B. Klavierunterricht" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label style={s.label}>Typ</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {Object.entries(TYP_ICON).map(([t, icon]) => (
                <button key={t} onClick={() => setForm(f => ({ ...f, typ: t }))}
                  style={{ padding:'6px 12px', borderRadius:'var(--radius)', border:`2px solid ${form.typ===t ? 'var(--accent)' : 'var(--border)'}`, background: form.typ===t ? 'var(--accent)' : 'var(--bg)', color: form.typ===t ? 'var(--accent-fg)' : 'var(--text-2)', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
                  {icon} {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={s.label}>Instrument</label>
            <select style={s.input} value={form.instrument_id} onChange={e => setForm(f => ({ ...f, instrument_id: e.target.value }))}>
              <option value="">– kein –</option>
              {instrumente.map(i => <option key={i.id} value={i.id}>{i.icon} {i.name_de}</option>)}
            </select>
          </div>
          <div>
            <label style={s.label}>Raum</label>
            <select style={s.input} value={form.raum_id} onChange={e => setForm(f => ({ ...f, raum_id: e.target.value }))}>
              <option value="">– kein –</option>
              {raeume.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div>
              <label style={s.label}>Wochentag</label>
              <select style={s.input} value={form.wochentag} onChange={e => setForm(f => ({ ...f, wochentag: e.target.value }))}>
                <option value="">– kein –</option>
                {WOCHENTAGE.map(w => <option key={w.wert} value={w.wert}>{w.label}</option>)}
              </select>
            </div>
            <div>
              <label style={s.label}>Zeit</label>
              <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                <input type="time" style={{ ...s.input, flex:1 }} value={form.uhrzeit_von}
                  onChange={e => setForm(f => ({ ...f, uhrzeit_von: e.target.value }))} />
                <span style={{ color:'var(--text-3)', fontSize:12 }}>–</span>
                <input type="time" style={{ ...s.input, flex:1 }} value={form.uhrzeit_bis}
                  onChange={e => setForm(f => ({ ...f, uhrzeit_bis: e.target.value }))} />
              </div>
            </div>
          </div>
          {fehler && <p style={{ margin:0, color:'var(--danger)', fontSize:13 }}>{fehler}</p>}
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:4 }}>
            <button onClick={onClose} style={s.btnSek}>Abbrechen</button>
            <button onClick={speichern} disabled={laden} style={s.btnPri}>
              {laden ? 'Speichern …' : '✓ Kurs anlegen'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LehrerKurse() {
  const { profil } = useApp()
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const [modal, setModal] = useState(false)

  const { data: kurse = [], isLoading: laden } = useQuery({
    queryKey: ['lehrer-kurse', profil?.id],
    enabled: !!profil?.id,
    queryFn: async () => {
      if (profil.rolle === 'admin' || profil.rolle === 'superadmin') {
        const { data } = await supabase
          .from('unterricht')
          .select('*, instrumente(name_de, icon), raeume(name), unterricht_schueler(schueler_id, status), unterricht_lehrer(lehrer_id, rolle, profiles!unterricht_lehrer_lehrer_id_fkey(voller_name))')
          .order('name')
        return (data ?? []).map(k => ({ ...k, meine_rolle: 'hauptlehrer' }))
      } else {
        const { data } = await supabase
          .from('unterricht_lehrer')
          .select('rolle, unterricht(*, instrumente(name_de, icon), raeume(name), unterricht_schueler(schueler_id, status), unterricht_lehrer(lehrer_id, rolle, profiles!unterricht_lehrer_lehrer_id_fkey(voller_name)))')
          .eq('lehrer_id', profil.id)
        return (data ?? []).map(u => ({ ...u.unterricht, meine_rolle: u.rolle }))
      }
    },
  })

  const kannAnlegen = profil?.kann_kurse_anlegen && profil?.rolle === 'lehrer'

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
        <h1 style={s.h1}>🎵 Meine Kurse</h1>
        {kannAnlegen && (
          <button onClick={() => setModal(true)} style={s.btnPri}>+ Neuer Kurs</button>
        )}
      </div>
      <p style={s.sub}>{kurse.length} Kurse</p>

      {laden ? <div style={s.leer}>Laden …</div> :
       kurse.length === 0 ? <div style={s.leer}>Noch keine Kurse zugeordnet.</div> : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:16, marginTop:24 }}>
          {kurse.map(k => (
            <div key={k.id} style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)', boxShadow:'var(--shadow)', overflow:'hidden', cursor:'pointer', transition:'box-shadow 0.15s' }}
              onClick={() => navigate(`/lehrer/kurse/${k.id}`)}>
              <div style={{ height:4, background: k.farbe ?? 'var(--primary)' }} />
              <div style={{ padding:'16px 20px' }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:12 }}>
                  <span style={{ fontSize:24 }}>{TYP_ICON[k.typ]}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:800, fontSize:16, color:'var(--text)' }}>{k.name}</div>
                    <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>
                      {k.instrumente?.icon} {k.instrumente?.name_de}
                      {k.meine_rolle === 'hauptlehrer' && <span style={{ marginLeft:8, color:'var(--accent)', fontWeight:700 }}>HAUPTLEHRER</span>}
                      {k.meine_rolle === 'co_lehrer'   && <span style={{ marginLeft:8, color:'var(--text-3)', fontWeight:700 }}>CO-LEHRER</span>}
                    </div>
                  </div>
                </div>

                <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:14 }}>
                  {k.wochentag && (
                    <div style={{ fontSize:13, color:'var(--text-2)' }}>
                      📅 {k.wochentag.toUpperCase()} · {k.uhrzeit_von?.slice(0,5)} – {k.uhrzeit_bis?.slice(0,5)}
                    </div>
                  )}
                  {k.raeume && <div style={{ fontSize:13, color:'var(--text-2)' }}>🏫 {k.raeume.name}</div>}
                  <div style={{ fontSize:13, color:'var(--text-2)' }}>
                    👥 {k.unterricht_schueler?.filter(s => s.status === 'aktiv').length ?? 0} Schüler
                  </div>
                </div>

                <div style={{ display:'flex', gap:6 }}>
                  <button onClick={e => { e.stopPropagation(); navigate(`/lehrer/kurse/${k.id}`) }}
                    style={s.btnPri}>📋 Details</button>
                  <button onClick={e => { e.stopPropagation(); navigate(`/lehrer/kurse/${k.id}/unterrichtsmodus`) }}
                    style={s.btnAkzent}>🎬 Unterrichtsmodus</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <NeuerKursModal
          onClose={() => setModal(false)}
          onErfolg={() => queryClient.invalidateQueries({ queryKey: ['lehrer-kurse'] })}
        />
      )}
    </div>
  )
}

const s = {
  h1:       { margin:'0 0 4px', fontSize:26, fontWeight:800, color:'var(--text)', letterSpacing:'-0.5px' },
  sub:      { margin:'0 0 0', color:'var(--text-3)', fontSize:14 },
  leer:     { padding:'48px', textAlign:'center', color:'var(--text-3)', fontSize:14, background:'var(--surface)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)', marginTop:24 },
  btnPri:   { padding:'7px 14px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg)', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  btnSek:   { padding:'7px 14px', borderRadius:'var(--radius)', border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text-2)', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  btnAkzent:{ padding:'7px 14px', borderRadius:'var(--radius)', border:'none', background:'var(--accent)', color:'var(--accent-fg)', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  input:    { width:'100%', padding:'8px 12px', borderRadius:'var(--radius)', border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text)', fontSize:14, fontFamily:'inherit', boxSizing:'border-box' },
  label:    { fontSize:13, fontWeight:600, color:'var(--text-2)', display:'block', marginBottom:4 },
  iconBtn:  { background:'none', border:'none', cursor:'pointer', fontSize:18, color:'var(--text-3)', padding:4, lineHeight:1 },
}
