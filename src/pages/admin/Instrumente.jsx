import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'

const INSTRUMENT_ICONS = [
  '🎹','🎸','🎺','🎻','🥁','🎷','🪗','🪕','🎵','🎼','🎤','🎙','🪘','🪈','🎶','🎐','🎊',
]

// ─── Modal ────────────────────────────────────────────────────
function InstrumentModal({ instrument, onClose, onErfolg }) {
  const { profil } = useApp()
  const istNeu = !instrument?.id
  const [form, setForm] = useState({
    name_de: instrument?.name_de ?? '',
    name_en: instrument?.name_en ?? '',
    name_tr: instrument?.name_tr ?? '',
    icon:    instrument?.icon    ?? '🎵',
    aktiv:   instrument?.aktiv   ?? true,
  })
  const [laden,  setLaden]  = useState(false)
  const [fehler, setFehler] = useState('')

  async function speichern() {
    if (!form.name_de.trim()) { setFehler('Deutscher Name ist erforderlich.'); return }
    setLaden(true)
    const payload = {
      name_de: form.name_de.trim(),
      name_en: form.name_en.trim() || null,
      name_tr: form.name_tr.trim() || null,
      icon:    form.icon,
      aktiv:   form.aktiv,
    }
    const { error } = istNeu
      ? await supabase.from('instrumente').insert({ ...payload, schule_id: profil.schule_id })
      : await supabase.from('instrumente').update(payload).eq('id', instrument.id)
    if (error) setFehler(error.message)
    else { onErfolg(); onClose() }
    setLaden(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:'28px 32px', width:'100%', maxWidth:480, boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)', maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
          <h3 style={{ margin:0, fontSize:18, fontWeight:800, color:'var(--text)' }}>
            {istNeu ? '+ Neues Instrument' : 'Instrument bearbeiten'}
          </h3>
          <button onClick={onClose} style={s.iconBtn}>✕</button>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {/* Icon Auswahl */}
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <label style={s.label}>Icon</label>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {INSTRUMENT_ICONS.map(ic => (
                <button key={ic} onClick={() => setForm(f => ({ ...f, icon: ic }))}
                  style={{ width:40, height:40, fontSize:22, borderRadius:'var(--radius)', border:`2px solid ${form.icon === ic ? 'var(--primary)' : 'var(--border)'}`, background: form.icon === ic ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'var(--bg-2)', cursor:'pointer' }}>
                  {ic}
                </button>
              ))}
              <input value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
                placeholder="Eigenes Emoji"
                style={{ ...s.input, width:100, textAlign:'center', fontSize:18 }} />
            </div>
          </div>

          {/* Namen */}
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={s.label}>Name (Deutsch) *</label>
            <input style={s.input} placeholder="z.B. Klavier" value={form.name_de}
              onChange={e => setForm(f => ({ ...f, name_de: e.target.value }))} />
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={s.label}>Name (Englisch)</label>
            <input style={s.input} placeholder="z.B. Piano" value={form.name_en}
              onChange={e => setForm(f => ({ ...f, name_en: e.target.value }))} />
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={s.label}>Name (Türkisch)</label>
            <input style={s.input} placeholder="z.B. Piyano" value={form.name_tr}
              onChange={e => setForm(f => ({ ...f, name_tr: e.target.value }))} />
          </div>

          {!istNeu && (
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <input type="checkbox" id="aktiv" checked={form.aktiv}
                onChange={e => setForm(f => ({ ...f, aktiv: e.target.checked }))} />
              <label htmlFor="aktiv" style={{ fontSize:14, color:'var(--text-2)' }}>Instrument aktiv</label>
            </div>
          )}

          {fehler && <p style={{ margin:0, color:'var(--danger)', fontSize:13 }}>{fehler}</p>}

          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
            <button onClick={onClose} style={s.btnSek}>Abbrechen</button>
            <button onClick={speichern} disabled={laden} style={s.btnPri}>
              {laden ? 'Speichere …' : istNeu ? '+ Erstellen' : '💾 Speichern'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Hauptkomponente ──────────────────────────────────────────
export default function Instrumente() {
  const { profil } = useApp()
  const [instrumente, setInstrumente] = useState([])
  const [laden,       setLaden]       = useState(true)
  const [modal,       setModal]       = useState(null)
  const [filter,      setFilter]      = useState('alle') // 'alle' | 'aktiv' | 'inaktiv'

  const ladeInstrumente = useCallback(async () => {
    setLaden(true)
    const { data } = await supabase.from('instrumente')
      .select('*')
      .eq('schule_id', profil?.schule_id)
      .order('name_de')
    setInstrumente(data ?? [])
    setLaden(false)
  }, [profil?.schule_id])

  useEffect(() => { ladeInstrumente() }, [ladeInstrumente])

  async function loeschen(instr) {
    if (!confirm(`„${instr.name_de}" wirklich löschen?\n\nKurse, die dieses Instrument verwenden, behalten die Zuweisung.`)) return
    await supabase.from('instrumente').delete().eq('id', instr.id)
    ladeInstrumente()
  }

  const anzeige = instrumente.filter(i =>
    filter === 'alle' ? true : filter === 'aktiv' ? i.aktiv : !i.aktiv
  )

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={s.h1}>🎸 Instrumente</h1>
          <p style={s.sub}>{instrumente.length} Instrumente · {instrumente.filter(i => i.aktiv).length} aktiv</p>
        </div>
        <button onClick={() => setModal({ typ:'neu' })} style={s.btnPri}>+ Neues Instrument</button>
      </div>

      {/* Filter */}
      <div style={{ display:'flex', gap:6, marginBottom:20 }}>
        {['alle','aktiv','inaktiv'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding:'7px 16px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background: filter===f ? 'var(--primary)' : 'var(--surface)', color: filter===f ? 'var(--primary-fg)' : 'var(--text-2)', fontSize:13, cursor:'pointer', fontFamily:'inherit', textTransform:'capitalize' }}>
            {f === 'alle' ? 'Alle' : f === 'aktiv' ? '● Aktiv' : '○ Inaktiv'}
          </button>
        ))}
      </div>

      {laden ? (
        <div style={s.leer}>Lade Instrumente …</div>
      ) : anzeige.length === 0 ? (
        <div style={s.leer}>
          {instrumente.length === 0
            ? 'Noch keine Instrumente. Klick auf "+ Neues Instrument".'
            : 'Keine Instrumente mit diesem Filter.'
          }
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:14 }}>
          {anzeige.map(instr => (
            <div key={instr.id} style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)', overflow:'hidden', boxShadow:'var(--shadow)' }}>
              <div style={{ height:4, background:'var(--primary)' }} />
              <div style={{ padding:'16px 18px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ fontSize:28 }}>{instr.icon}</span>
                    <div>
                      <div style={{ fontWeight:800, fontSize:16, color:'var(--text)' }}>{instr.name_de}</div>
                      {instr.name_en && <div style={{ fontSize:12, color:'var(--text-3)' }}>{instr.name_en}</div>}
                      {instr.name_tr && <div style={{ fontSize:12, color:'var(--text-3)' }}>{instr.name_tr}</div>}
                    </div>
                  </div>
                  <span style={{ fontSize:11, fontWeight:700, color: instr.aktiv ? 'var(--success)' : 'var(--danger)' }}>
                    {instr.aktiv ? '● Aktiv' : '○ Inaktiv'}
                  </span>
                </div>
                <div style={{ display:'flex', gap:6, marginTop:10 }}>
                  <button onClick={() => setModal({ typ:'bearbeiten', instrument: instr })} style={s.btnKlein}>✏️ Bearbeiten</button>
                  <button onClick={() => loeschen(instr)} style={{ ...s.btnKlein, color:'var(--danger)' }}>🗑</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(modal?.typ === 'neu' || modal?.typ === 'bearbeiten') && (
        <InstrumentModal
          instrument={modal.instrument ?? null}
          onClose={() => setModal(null)}
          onErfolg={ladeInstrumente}
        />
      )}
    </div>
  )
}

const s = {
  h1:       { margin:'0 0 4px', fontSize:26, fontWeight:800, color:'var(--text)', letterSpacing:'-0.5px' },
  sub:      { margin:0, color:'var(--text-3)', fontSize:14 },
  label:    { fontSize:12, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em' },
  input:    { padding:'10px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', fontSize:14, outline:'none', fontFamily:'inherit', background:'var(--bg)', color:'var(--text)', width:'100%', boxSizing:'border-box' },
  btnPri:   { padding:'10px 20px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg)', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' },
  btnSek:   { padding:'10px 16px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-2)', fontSize:14, cursor:'pointer', fontFamily:'inherit' },
  btnKlein: { padding:'6px 12px', borderRadius:'var(--radius)', border:'none', background:'var(--bg-2)', color:'var(--text-2)', fontSize:13, cursor:'pointer', fontFamily:'inherit' },
  iconBtn:  { background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--text-3)', padding:4 },
  leer:     { padding:'48px', textAlign:'center', color:'var(--text-3)', fontSize:14, background:'var(--surface)', borderRadius:'var(--radius-lg)', border:'1px dashed var(--border)' },
}
