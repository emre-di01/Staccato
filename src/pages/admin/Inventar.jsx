import { useState, useEffect, useCallback, useRef } from 'react'
import QRCode from 'qrcode'
import jsQR from 'jsqr'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'

const ZUSTAENDE = [
  { wert: 'neu',       label: 'Neu',       farbe: 'var(--success)' },
  { wert: 'gut',       label: 'Gut',       farbe: 'var(--primary)' },
  { wert: 'gebraucht', label: 'Gebraucht', farbe: 'var(--text-3)'  },
  { wert: 'defekt',    label: 'Defekt',    farbe: 'var(--danger)'  },
]

const zLabel = z => ZUSTAENDE.find(x => x.wert === z)?.label ?? z
const zFarbe = z => ZUSTAENDE.find(x => x.wert === z)?.farbe ?? 'var(--text-3)'

const EMOJI_VORSCHLAEGE = ['📦','🎸','🎹','🎺','🎻','🥁','🎷','🪗','🔧','💡','🖥️','📷','🎙️','🪑','🎤','🔌','📺','🗄️','🎭','🏫']

function useMobile() {
  const [mob, setMob] = useState(() => window.innerWidth < 600)
  useEffect(() => {
    const fn = () => setMob(window.innerWidth < 600)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return mob
}

// ─── Kategorien-Verwaltungs-Modal ─────────────────────────────
function KategorienModal({ schuleId, onClose, onGeaendert }) {
  const mob = useMobile()
  const [kategorien, setKategorien] = useState([])
  const [counts,     setCounts]     = useState({})
  const [neuName,    setNeuName]    = useState('')
  const [neuIcon,    setNeuIcon]    = useState('📦')
  const [bearbeite,  setBearbeite]  = useState(null) // { id, name, icon }
  const [laden,      setLaden]      = useState(false)
  const [fehler,     setFehler]     = useState('')

  const ladeKategorien = useCallback(async () => {
    const [{ data: kat }, { data: inv }] = await Promise.all([
      supabase.from('inventar_kategorien').select('*').eq('schule_id', schuleId).order('name'),
      supabase.from('inventar').select('kategorie_id').eq('schule_id', schuleId),
    ])
    setKategorien(kat ?? [])
    const c = {}
    for (const row of inv ?? []) {
      if (row.kategorie_id) c[row.kategorie_id] = (c[row.kategorie_id] ?? 0) + 1
    }
    setCounts(c)
  }, [schuleId])

  useEffect(() => { ladeKategorien() }, [ladeKategorien])

  async function erstellen() {
    if (!neuName.trim()) return
    setFehler('')
    setLaden(true)
    const { error } = await supabase.from('inventar_kategorien').insert({ schule_id: schuleId, name: neuName.trim(), icon: neuIcon })
    if (error) { setFehler(error.message); setLaden(false); return }
    setNeuName(''); setNeuIcon('📦')
    await ladeKategorien()
    onGeaendert()
    setLaden(false)
  }

  async function speichern(kat) {
    setFehler('')
    const { error } = await supabase.from('inventar_kategorien').update({ name: bearbeite.name, icon: bearbeite.icon }).eq('id', kat.id)
    if (error) { setFehler(error.message); return }
    setBearbeite(null)
    await ladeKategorien()
    onGeaendert()
  }

  async function loeschen(kat) {
    if ((counts[kat.id] ?? 0) > 0) return
    if (!confirm(`Kategorie „${kat.name}" wirklich löschen?`)) return
    await supabase.from('inventar_kategorien').delete().eq('id', kat.id)
    await ladeKategorien()
    onGeaendert()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', zIndex:1100,
      alignItems: mob ? 'flex-end' : 'center', justifyContent: mob ? 'stretch' : 'center', padding: mob ? 0 : 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--surface)', width:'100%', maxWidth: mob ? '100%' : 460, maxHeight: mob ? '85vh' : '80vh',
        borderRadius: mob ? '18px 18px 0 0' : 'var(--radius-lg)', padding: mob ? '20px 16px 28px' : '24px 28px',
        boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)', overflowY:'auto' }}>
        {mob && <div style={{ width:40, height:4, borderRadius:2, background:'var(--border)', margin:'0 auto 16px' }} />}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <h3 style={{ margin:0, fontSize:17, fontWeight:800, color:'var(--text)' }}>⚙️ Kategorien verwalten</h3>
          <button onClick={onClose} style={s.iconBtn}>✕</button>
        </div>

        {/* Bestehende Kategorien */}
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20 }}>
          {kategorien.length === 0 && (
            <div style={{ color:'var(--text-3)', fontSize:13, padding:'12px 0' }}>Noch keine Kategorien erstellt.</div>
          )}
          {kategorien.map(kat => (
            <div key={kat.id} style={{ background:'var(--bg)', borderRadius:'var(--radius)', border:'1px solid var(--border)', padding:'10px 12px' }}>
              {bearbeite?.id === kat.id ? (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <input value={bearbeite.icon} onChange={e => setBearbeite(b => ({ ...b, icon: e.target.value }))}
                      style={{ ...s.input, width:52, textAlign:'center', fontSize:18, padding:'6px 8px' }} />
                    <input value={bearbeite.name} onChange={e => setBearbeite(b => ({ ...b, name: e.target.value }))}
                      style={{ ...s.input, flex:1 }} autoFocus />
                  </div>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    {EMOJI_VORSCHLAEGE.map(e => (
                      <button key={e} onClick={() => setBearbeite(b => ({ ...b, icon: e }))}
                        style={{ width:32, height:32, fontSize:16, borderRadius:'var(--radius)', border:`1.5px solid ${bearbeite.icon === e ? 'var(--primary)' : 'var(--border)'}`, background: bearbeite.icon === e ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'var(--bg-2)', cursor:'pointer' }}>
                        {e}
                      </button>
                    ))}
                  </div>
                  <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                    <button onClick={() => setBearbeite(null)} style={s.btnSek}>Abbrechen</button>
                    <button onClick={() => speichern(kat)} style={s.btnPri}>💾 Speichern</button>
                  </div>
                </div>
              ) : (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ fontSize:20 }}>{kat.icon}</span>
                    <span style={{ fontWeight:600, fontSize:14, color:'var(--text)' }}>{kat.name}</span>
                    {(counts[kat.id] ?? 0) > 0 && (
                      <span style={{ fontSize:11, color:'var(--text-3)', background:'var(--bg-2)', padding:'2px 7px', borderRadius:99, border:'1px solid var(--border)' }}>
                        {counts[kat.id]}×
                      </span>
                    )}
                  </div>
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={() => setBearbeite({ id: kat.id, name: kat.name, icon: kat.icon })} style={s.btnKlein}>✏️</button>
                    <button onClick={() => loeschen(kat)} disabled={(counts[kat.id] ?? 0) > 0}
                      style={{ ...s.btnKlein, color:(counts[kat.id] ?? 0) > 0 ? 'var(--text-3)' : 'var(--danger)', cursor:(counts[kat.id] ?? 0) > 0 ? 'not-allowed' : 'pointer' }}
                      title={(counts[kat.id] ?? 0) > 0 ? 'Wird noch verwendet' : 'Löschen'}>🗑</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {fehler && <p style={{ margin:'8px 0 0', color:'var(--danger)', fontSize:13 }}>{fehler}</p>}

        {/* Neue Kategorie */}
        <div style={{ borderTop:'1px solid var(--border)', paddingTop:16 }}>
          <label style={s.label}>Neue Kategorie</label>
          <div style={{ display:'flex', gap:8, marginTop:8, alignItems:'center' }}>
            <input value={neuIcon} onChange={e => setNeuIcon(e.target.value)}
              style={{ ...s.input, width:52, textAlign:'center', fontSize:18, padding:'8px', flexShrink:0 }} />
            <input value={neuName} onChange={e => setNeuName(e.target.value)} placeholder="Name der Kategorie"
              style={{ ...s.input, flex:1 }}
              onKeyDown={e => e.key === 'Enter' && erstellen()} />
            <button onClick={erstellen} disabled={laden || !neuName.trim()} style={{ ...s.btnPri, padding:'10px 16px', flexShrink:0 }}>+</button>
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:8 }}>
            {EMOJI_VORSCHLAEGE.map(e => (
              <button key={e} onClick={() => setNeuIcon(e)}
                style={{ width:32, height:32, fontSize:16, borderRadius:'var(--radius)', border:`1.5px solid ${neuIcon === e ? 'var(--primary)' : 'var(--border)'}`, background: neuIcon === e ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'var(--bg-2)', cursor:'pointer' }}>
                {e}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Barcode-Eingabe-Modal (Scan → Formularfeld) ──────────────
function BarcodeEingabeModal({ onGescannt, onClose }) {
  const videoRef  = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const animRef   = useRef(null)
  const aktiv     = useRef(true)
  const [kameraErr, setKameraErr] = useState('')
  const hatNativ = typeof BarcodeDetector !== 'undefined'

  useEffect(() => {
    aktiv.current = true
    startKamera()
    return () => { aktiv.current = false; stopKamera() }
  }, [])

  async function startKamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 } },
      })
      if (!aktiv.current) { stream.getTracks().forEach(t => t.stop()); return }
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      scanLoop()
    } catch (e) {
      setKameraErr('Kamera nicht verfügbar: ' + (e.message ?? String(e)))
    }
  }

  function stopKamera() {
    cancelAnimationFrame(animRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  function scanLoop() {
    if (!aktiv.current) return
    animRef.current = requestAnimationFrame(async () => {
      if (!aktiv.current) return
      const vid = videoRef.current
      if (!vid || vid.readyState < 2 || vid.paused) { scanLoop(); return }
      let erkannt = null
      try {
        if (hatNativ) {
          const det = new BarcodeDetector({ formats: ['qr_code','code_128','code_39','ean_13','ean_8','upc_a','upc_e'] })
          const codes = await det.detect(vid)
          if (codes.length > 0) erkannt = codes[0].rawValue
        } else {
          const cvs = canvasRef.current
          const w = vid.videoWidth, h = vid.videoHeight
          if (w && h) {
            cvs.width = w; cvs.height = h
            const ctx = cvs.getContext('2d')
            ctx.drawImage(vid, 0, 0, w, h)
            const img = ctx.getImageData(0, 0, w, h)
            const result = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' })
            if (result) erkannt = result.data
          }
        }
      } catch {}
      if (erkannt && aktiv.current) { stopKamera(); onGescannt(erkannt); return }
      scanLoop()
    })
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:1200, display:'flex', flexDirection:'column' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', background:'rgba(0,0,0,0.6)' }}>
        <span style={{ color:'#fff', fontWeight:800, fontSize:17 }}>📷 Barcode / EAN scannen</span>
        <button onClick={onClose} style={{ background:'none', border:'none', color:'#fff', fontSize:22, cursor:'pointer', padding:4 }}>✕</button>
      </div>
      <div style={{ flex:1, position:'relative', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <video ref={videoRef} playsInline muted autoPlay style={{ width:'100%', height:'100%', objectFit:'cover' }} />
        <canvas ref={canvasRef} style={{ display:'none' }} />
        <div style={{ position:'absolute', width:280, height:110, border:'3px solid rgba(255,255,255,0.6)', borderRadius:12, boxShadow:'0 0 0 9999px rgba(0,0,0,0.45)', pointerEvents:'none' }}>
          {[['top','left'],['top','right'],['bottom','left'],['bottom','right']].map(([v,h]) => (
            <div key={v+h} style={{ position:'absolute', [v]:-3, [h]:-3, width:24, height:24,
              borderTop:    v==='top'    ? '4px solid var(--primary)' : 'none',
              borderBottom: v==='bottom' ? '4px solid var(--primary)' : 'none',
              borderLeft:   h==='left'   ? '4px solid var(--primary)' : 'none',
              borderRight:  h==='right'  ? '4px solid var(--primary)' : 'none',
              borderRadius: v==='top'&&h==='left'?'6px 0 0 0':v==='top'&&h==='right'?'0 6px 0 0':v==='bottom'&&h==='left'?'0 0 0 6px':'0 0 6px 0',
            }} />
          ))}
        </div>
        <div style={{ position:'absolute', bottom:16, color:'rgba(255,255,255,0.75)', fontSize:13, textAlign:'center', padding:'0 20px' }}>
          Barcode oder EAN in den Rahmen halten
        </div>
        {kameraErr && (
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
            <p style={{ color:'#fff', textAlign:'center', fontSize:14, background:'rgba(0,0,0,0.7)', padding:'16px 20px', borderRadius:12 }}>{kameraErr}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Inventar-Modal ───────────────────────────────────────────
function InventarModal({ item, schuleId, kategorien, onClose, onErfolg }) {
  const istNeu = !item?.id
  const mob = useMobile()
  const [form, setForm] = useState({
    name:             item?.name                           ?? '',
    kategorie_id:     item?.kategorie_id                  ?? (kategorien[0]?.id ?? ''),
    hersteller:       item?.hersteller                     ?? '',
    seriennummer:     item?.seriennummer                   ?? '',
    barcode:          item?.barcode                        ?? '',
    kaufdatum:        item?.kaufdatum                      ?? '',
    anschaffungswert: item?.anschaffungswert != null ? String(item.anschaffungswert) : '',
    zustand:          item?.zustand                        ?? 'gut',
    notizen:          item?.notizen                        ?? '',
  })
  const [laden,          setLaden]          = useState(false)
  const [fehler,         setFehler]         = useState('')
  const [barcodeScanner, setBarcodeScanner] = useState(false)

  async function speichern() {
    if (!form.name.trim()) { setFehler('Bezeichnung ist erforderlich.'); return }
    setLaden(true)
    const payload = {
      name:             form.name.trim(),
      kategorie_id:     form.kategorie_id || null,
      hersteller:       form.hersteller.trim()   || null,
      seriennummer:     form.seriennummer.trim()  || null,
      barcode:          form.barcode.trim()       || null,
      kaufdatum:        form.kaufdatum            || null,
      anschaffungswert: form.anschaffungswert     ? parseFloat(form.anschaffungswert) : null,
      zustand:          form.zustand,
      notizen:          form.notizen.trim()        || null,
      aktualisiert_am:  new Date().toISOString(),
    }
    const { error } = istNeu
      ? await supabase.from('inventar').insert({ ...payload, schule_id: schuleId })
      : await supabase.from('inventar').update(payload).eq('id', item.id)
    if (error) setFehler(error.message)
    else { onErfolg(); onClose() }
    setLaden(false)
  }

  return (<>
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', zIndex:1000,
      alignItems: mob ? 'flex-end' : 'center', justifyContent: mob ? 'stretch' : 'center', padding: mob ? 0 : 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--surface)', width:'100%', maxWidth: mob ? '100%' : 520,
        maxHeight: mob ? '92vh' : '90vh', borderRadius: mob ? '18px 18px 0 0' : 'var(--radius-lg)',
        padding: mob ? '20px 16px 28px' : '28px 32px', boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)', overflowY:'auto' }}>
        {mob && <div style={{ width:40, height:4, borderRadius:2, background:'var(--border)', margin:'0 auto 18px' }} />}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <h3 style={{ margin:0, fontSize:17, fontWeight:800, color:'var(--text)' }}>
            {istNeu ? '+ Neuer Gegenstand' : 'Gegenstand bearbeiten'}
          </h3>
          <button onClick={onClose} style={s.iconBtn}>✕</button>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {/* Kategorie */}
          {kategorien.length > 0 && (
            <div>
              <label style={s.label}>Kategorie</label>
              <div style={{ display:'flex', gap:6, marginTop:6, flexWrap:'wrap' }}>
                <button onClick={() => setForm(f => ({ ...f, kategorie_id: '' }))}
                  style={{ padding:'7px 12px', borderRadius:'var(--radius)', border:`1.5px solid ${!form.kategorie_id ? 'var(--primary)' : 'var(--border)'}`, background: !form.kategorie_id ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'var(--bg)', color: !form.kategorie_id ? 'var(--primary)' : 'var(--text-2)', fontSize:13, cursor:'pointer', fontFamily:'inherit', fontWeight: !form.kategorie_id ? 700 : 400 }}>
                  — Keine
                </button>
                {kategorien.map(k => (
                  <button key={k.id} onClick={() => setForm(f => ({ ...f, kategorie_id: k.id }))}
                    style={{ padding:'7px 12px', borderRadius:'var(--radius)', border:`1.5px solid ${form.kategorie_id === k.id ? 'var(--primary)' : 'var(--border)'}`, background: form.kategorie_id === k.id ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'var(--bg)', color: form.kategorie_id === k.id ? 'var(--primary)' : 'var(--text-2)', fontSize:13, cursor:'pointer', fontFamily:'inherit', fontWeight: form.kategorie_id === k.id ? 700 : 400 }}>
                    {k.icon} {k.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Name */}
          <div>
            <label style={s.label}>Bezeichnung *</label>
            <input style={{ ...s.input, marginTop:6 }} placeholder="z.B. Yamaha Flügel" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>

          {/* Hersteller */}
          <div>
            <label style={s.label}>Hersteller / Marke</label>
            <input style={{ ...s.input, marginTop:6 }} placeholder="z.B. Yamaha" value={form.hersteller}
              onChange={e => setForm(f => ({ ...f, hersteller: e.target.value }))} />
          </div>

          {/* Seriennummer + Barcode */}
          <div style={{ display:'grid', gridTemplateColumns: mob ? '1fr' : '1fr 1fr', gap:12 }}>
            <div>
              <label style={s.label}>Seriennummer</label>
              <input style={{ ...s.input, marginTop:6 }} placeholder="SN-12345" value={form.seriennummer}
                onChange={e => setForm(f => ({ ...f, seriennummer: e.target.value }))} />
            </div>
            <div>
              <label style={s.label}>Barcode / EAN</label>
              <div style={{ display:'flex', gap:6, marginTop:6 }}>
                <input style={{ ...s.input, flex:1 }} placeholder="4012345678901" value={form.barcode}
                  onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))} />
                <button type="button" onClick={() => setBarcodeScanner(true)}
                  style={{ padding:'10px 12px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-2)', fontSize:16, cursor:'pointer', flexShrink:0 }}
                  title="Barcode scannen">📷</button>
              </div>
            </div>
          </div>

          {/* Kaufdatum + Wert */}
          <div style={{ display:'grid', gridTemplateColumns: mob ? '1fr' : '1fr 1fr', gap:12 }}>
            <div>
              <label style={s.label}>Kaufdatum</label>
              <input type="date" style={{ ...s.input, marginTop:6 }} value={form.kaufdatum}
                onChange={e => setForm(f => ({ ...f, kaufdatum: e.target.value }))} />
            </div>
            <div>
              <label style={s.label}>Anschaffungswert (€)</label>
              <input type="number" min="0" step="0.01" style={{ ...s.input, marginTop:6 }} placeholder="0,00"
                value={form.anschaffungswert} onChange={e => setForm(f => ({ ...f, anschaffungswert: e.target.value }))} />
            </div>
          </div>

          {/* Zustand */}
          <div>
            <label style={s.label}>Zustand</label>
            <div style={{ display:'flex', gap:6, marginTop:6 }}>
              {ZUSTAENDE.map(z => (
                <button key={z.wert} onClick={() => setForm(f => ({ ...f, zustand: z.wert }))}
                  style={{ flex:1, padding:'8px 2px', borderRadius:'var(--radius)', border:`1.5px solid ${form.zustand === z.wert ? z.farbe : 'var(--border)'}`, background: form.zustand === z.wert ? `color-mix(in srgb, ${z.farbe} 12%, transparent)` : 'var(--bg)', color: form.zustand === z.wert ? z.farbe : 'var(--text-2)', fontSize: mob ? 12 : 13, cursor:'pointer', fontFamily:'inherit', fontWeight: form.zustand === z.wert ? 700 : 400 }}>
                  {z.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notizen */}
          <div>
            <label style={s.label}>Notizen</label>
            <textarea style={{ ...s.input, marginTop:6, minHeight:68, resize:'vertical' }} placeholder="Optionale Anmerkungen …"
              value={form.notizen} onChange={e => setForm(f => ({ ...f, notizen: e.target.value }))} />
          </div>

          {fehler && <p style={{ margin:0, color:'var(--danger)', fontSize:13 }}>{fehler}</p>}

          <div style={{ display:'flex', gap:10, flexDirection: mob ? 'column-reverse' : 'row', justifyContent:'flex-end', marginTop: mob ? 4 : 0 }}>
            <button onClick={onClose} style={s.btnSek}>Abbrechen</button>
            <button onClick={speichern} disabled={laden} style={s.btnPri}>
              {laden ? 'Speichere …' : istNeu ? '+ Erstellen' : '💾 Speichern'}
            </button>
          </div>
        </div>
      </div>
    </div>

    {barcodeScanner && (
      <BarcodeEingabeModal
        onGescannt={code => { setForm(f => ({ ...f, barcode: code })); setBarcodeScanner(false) }}
        onClose={() => setBarcodeScanner(false)}
      />
    )}
  </>)
}

// ─── Label-Größen ─────────────────────────────────────────────
const LABEL_GROESSEN = [
  { label: '62 × 29 mm',         w: 62,  h: 29  },
  { label: '57 × 32 mm (Dymo)',   w: 57,  h: 32  },
  { label: '54 × 25 mm',         w: 54,  h: 25  },
  { label: '38 × 90 mm (Brother)',w: 38,  h: 90  },
  { label: '29 × 90 mm (Brother)',w: 29,  h: 90  },
  { label: 'Benutzerdefiniert',   w: null, h: null },
]

// ─── Einzel-Etikett-Modal (Labeldruckergröße) ─────────────────
function EtikettEinzelModal({ item, onClose }) {
  const mob = useMobile()
  const gespeichert = (() => { try { return JSON.parse(localStorage.getItem('staccato_label_size') ?? 'null') } catch { return null } })()
  const [preset,    setPreset]    = useState(gespeichert?.preset ?? 0)
  const [breite,    setBreite]    = useState(String(gespeichert?.w ?? LABEL_GROESSEN[0].w))
  const [hoehe,     setHoehe]     = useState(String(gespeichert?.h ?? LABEL_GROESSEN[0].h))
  const [vorschau,  setVorschau]  = useState(null)
  const [laden,     setLaden]     = useState(false)

  const istCustom = LABEL_GROESSEN[preset].w === null

  useEffect(() => {
    if (!istCustom) {
      setBreite(String(LABEL_GROESSEN[preset].w))
      setHoehe(String(LABEL_GROESSEN[preset].h))
    }
  }, [preset, istCustom])

  useEffect(() => {
    const w = parseFloat(breite), h = parseFloat(hoehe)
    if (!w || !h) return
    let aktiv = true
    QRCode.toDataURL(item.inventarnummer, { width: 200, margin: 1 }).then(url => {
      if (aktiv) setVorschau({ url, w, h })
    })
    return () => { aktiv = false }
  }, [breite, hoehe, item.inventarnummer])

  async function drucken() {
    const w = parseFloat(breite), h = parseFloat(hoehe)
    if (!w || !h) return
    localStorage.setItem('staccato_label_size', JSON.stringify({ preset, w, h }))
    setLaden(true)
    const qrUrl = await QRCode.toDataURL(item.inventarnummer, { width: 300, margin: 1 })
    const quer = w > h
    // QR-Größe: etwas kleiner als die kürzere Seite
    const qrMm = Math.min(w, h) - (quer ? 6 : 10)
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      @page{size:${w}mm ${h}mm;margin:0}
      *{box-sizing:border-box;margin:0;padding:0}
      body{width:${w}mm;height:${h}mm;font-family:Arial,sans-serif;overflow:hidden}
      .wrap{width:100%;height:100%;display:flex;flex-direction:${quer?'row':'column'};align-items:center;justify-content:center;padding:2mm;gap:2mm}
      img{width:${qrMm}mm;height:${qrMm}mm;flex-shrink:0}
      .txt{display:flex;flex-direction:column;gap:1mm;overflow:hidden;${quer?`max-width:${w-qrMm-8}mm`:''}}
      .nr{font-size:${quer?9:8}pt;font-weight:bold;letter-spacing:0.03em;white-space:nowrap}
      .name{font-size:${quer?7:6}pt;color:#444;overflow:hidden;text-overflow:ellipsis;${quer?'white-space:nowrap':''}}
    </style></head><body>
    <div class="wrap">
      <img src="${qrUrl}"/>
      <div class="txt">
        <div class="nr">${item.inventarnummer}</div>
        <div class="name">${item.name.replace(/</g,'&lt;')}</div>
      </div>
    </div>
    <script>window.onload=()=>{window.print();}<\/script>
    </body></html>`
    const win = window.open('', '_blank', `width=${Math.round(w*4)},height=${Math.round(h*4+80)}`)
    win.document.write(html); win.document.close()
    setLaden(false)
    onClose()
  }

  // Vorschau-Skalierung: max 260px breit
  const SCALE = vorschau ? Math.min(260 / (vorschau.w * 3.78), 150 / (vorschau.h * 3.78)) : 1
  const vpx = vorschau ? { w: vorschau.w * 3.78 * SCALE, h: vorschau.h * 3.78 * SCALE } : null
  const quer = vorschau ? vorschau.w > vorschau.h : false
  const qrPx = vorschau ? (Math.min(vorschau.w, vorschau.h) - (quer ? 6 : 10)) * 3.78 * SCALE : 0

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', zIndex:1000,
      alignItems: mob ? 'flex-end' : 'center', justifyContent: mob ? 'stretch' : 'center', padding: mob ? 0 : 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--surface)', width:'100%', maxWidth: mob ? '100%' : 440,
        maxHeight: mob ? '88vh' : '85vh', borderRadius: mob ? '18px 18px 0 0' : 'var(--radius-lg)',
        padding: mob ? '20px 16px 28px' : '24px 28px', boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)', overflowY:'auto' }}>
        {mob && <div style={{ width:40, height:4, borderRadius:2, background:'var(--border)', margin:'0 auto 16px' }} />}

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <h3 style={{ margin:0, fontSize:17, fontWeight:800, color:'var(--text)' }}>🏷️ Etikett drucken</h3>
          <button onClick={onClose} style={s.iconBtn}>✕</button>
        </div>

        <div style={{ fontSize:13, color:'var(--text-2)', marginBottom:16, background:'var(--bg)', borderRadius:'var(--radius)', padding:'8px 12px' }}>
          <strong style={{ color:'var(--text)' }}>{item.inventarnummer}</strong> · {item.name}
        </div>

        {/* Größe */}
        <div style={{ marginBottom:16 }}>
          <label style={s.label}>Etikettgröße</label>
          <select value={preset} onChange={e => setPreset(Number(e.target.value))}
            style={{ ...s.input, marginTop:6 }}>
            {LABEL_GROESSEN.map((g, i) => <option key={i} value={i}>{g.label}</option>)}
          </select>
        </div>

        {istCustom && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
            <div>
              <label style={s.label}>Breite (mm)</label>
              <input type="number" min="10" max="200" value={breite} onChange={e => setBreite(e.target.value)}
                style={{ ...s.input, marginTop:6 }} />
            </div>
            <div>
              <label style={s.label}>Höhe (mm)</label>
              <input type="number" min="10" max="200" value={hoehe} onChange={e => setHoehe(e.target.value)}
                style={{ ...s.input, marginTop:6 }} />
            </div>
          </div>
        )}

        {/* Vorschau */}
        {vpx && (
          <div style={{ marginBottom:20, display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Vorschau</div>
            <div style={{ width: vpx.w, height: vpx.h, border:'1.5px solid var(--border)', borderRadius:4, background:'#fff', display:'flex', flexDirection: quer ? 'row' : 'column', alignItems:'center', justifyContent:'center', gap: 4 * SCALE, padding: 6 * SCALE, overflow:'hidden' }}>
              <img src={vorschau.url} style={{ width: qrPx, height: qrPx, flexShrink:0 }} alt="" />
              <div style={{ display:'flex', flexDirection:'column', gap: 2 * SCALE, overflow:'hidden', ...(quer ? { maxWidth: vpx.w - qrPx - 16 * SCALE } : {}) }}>
                <div style={{ fontSize: Math.max(8, 9 * SCALE), fontWeight:'bold', color:'#000', whiteSpace:'nowrap', letterSpacing:'0.03em' }}>{item.inventarnummer}</div>
                <div style={{ fontSize: Math.max(7, 7 * SCALE), color:'#555', overflow:'hidden', textOverflow:'ellipsis', whiteSpace: quer ? 'nowrap' : 'normal' }}>{item.name}</div>
              </div>
            </div>
            <div style={{ fontSize:11, color:'var(--text-3)' }}>{breite} × {hoehe} mm</div>
          </div>
        )}

        <div style={{ display:'flex', gap:10, flexDirection: mob ? 'column-reverse' : 'row', justifyContent:'flex-end' }}>
          <button onClick={onClose} style={s.btnSek}>Abbrechen</button>
          <button onClick={drucken} disabled={laden} style={s.btnPri}>🖨️ Drucken</button>
        </div>
      </div>
    </div>
  )
}

// ─── Etiketten drucken (A4-Grid) ─────────────────────────────
async function etikettenDrucken(items) {
  const labels = await Promise.all(items.map(async item => ({
    ...item,
    qrUrl: await QRCode.toDataURL(item.inventarnummer, { width: 220, margin: 1, color: { dark: '#000000', light: '#ffffff' } }),
  })))

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;background:#fff}
    .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6mm;padding:10mm}
    .label{border:1px solid #ccc;border-radius:3mm;padding:4mm;display:flex;flex-direction:column;align-items:center;gap:2mm;break-inside:avoid;page-break-inside:avoid}
    .label img{width:32mm;height:32mm}
    .nr{font-size:11pt;font-weight:bold;letter-spacing:0.05em;text-align:center}
    .name{font-size:8pt;color:#444;text-align:center;max-width:50mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    @media print{@page{margin:0}body{margin:0}}
  </style></head><body>
  <div class="grid">
    ${labels.map(l => `<div class="label">
      <img src="${l.qrUrl}" />
      <div class="nr">${l.inventarnummer}</div>
      <div class="name">${l.name.replace(/</g,'&lt;')}</div>
    </div>`).join('')}
  </div>
  <script>window.onload=()=>{window.print();}<\/script>
  </body></html>`

  const win = window.open('', '_blank', 'width=900,height=700')
  win.document.write(html)
  win.document.close()
}

// ─── Scanner-Modal ────────────────────────────────────────────
function ScannerModal({ schuleId, onClose, onBearbeiten }) {
  const videoRef   = useRef(null)
  const canvasRef  = useRef(null)
  const streamRef  = useRef(null)
  const animRef    = useRef(null)
  const aktiv      = useRef(true)

  const [phase,       setPhase]       = useState('scan')
  const [gefunden,    setGefunden]    = useState(null)
  const [letzterCode, setLetzterCode] = useState('')
  const [manuell,     setManuell]     = useState('')
  const [kameraErr,   setKameraErr]   = useState('')

  const hatNativ = typeof BarcodeDetector !== 'undefined'

  useEffect(() => {
    aktiv.current = true
    startKamera()
    return () => { aktiv.current = false; stopKamera() }
  }, [])

  async function startKamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 } },
      })
      if (!aktiv.current) { stream.getTracks().forEach(t => t.stop()); return }
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      scanLoop()
    } catch (e) {
      setKameraErr('Kamera nicht verfügbar: ' + (e.message ?? String(e)))
    }
  }

  function stopKamera() {
    cancelAnimationFrame(animRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  function scanLoop() {
    if (!aktiv.current) return
    animRef.current = requestAnimationFrame(async () => {
      if (!aktiv.current) return
      const vid = videoRef.current
      if (!vid || vid.readyState < 2 || vid.paused) { scanLoop(); return }
      let erkannt = null
      try {
        if (hatNativ) {
          const det = new BarcodeDetector({ formats: ['qr_code','code_128','code_39','ean_13','ean_8'] })
          const codes = await det.detect(vid)
          if (codes.length > 0) erkannt = codes[0].rawValue
        } else {
          const cvs = canvasRef.current
          const w = vid.videoWidth, h = vid.videoHeight
          if (w && h) {
            cvs.width = w; cvs.height = h
            const ctx = cvs.getContext('2d')
            ctx.drawImage(vid, 0, 0, w, h)
            const img = ctx.getImageData(0, 0, w, h)
            const result = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' })
            if (result) erkannt = result.data
          }
        }
      } catch {}
      if (erkannt && aktiv.current) { stopKamera(); await sucheArtikel(erkannt); return }
      scanLoop()
    })
  }

  async function sucheArtikel(code) {
    setLetzterCode(code)
    const q = code.trim()
    const { data } = await supabase
      .from('inventar')
      .select('*, inventar_kategorien(id, name, icon)')
      .eq('schule_id', schuleId)
      .or(`inventarnummer.ilike.${q},barcode.eq.${q}`)
      .maybeSingle()
    if (data) { setGefunden(data); setPhase('gefunden') }
    else setPhase('nichtGefunden')
  }

  async function manuellSuchen() {
    if (!manuell.trim()) return
    stopKamera()
    await sucheArtikel(manuell.trim())
  }

  function nochmal() {
    setPhase('scan'); setGefunden(null); setLetzterCode(''); setManuell('')
    startKamera()
  }

  const kat = gefunden?.inventar_kategorien

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:2000, display:'flex', flexDirection:'column' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', background:'rgba(0,0,0,0.6)' }}>
        <span style={{ color:'#fff', fontWeight:800, fontSize:17 }}>📷 Inventar scannen</span>
        <button onClick={onClose} style={{ background:'none', border:'none', color:'#fff', fontSize:22, cursor:'pointer', padding:4 }}>✕</button>
      </div>

      {phase === 'scan' && (
        <div style={{ flex:1, position:'relative', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <video ref={videoRef} playsInline muted autoPlay style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          <canvas ref={canvasRef} style={{ display:'none' }} />
          <div style={{ position:'absolute', width:220, height:220, border:'3px solid rgba(255,255,255,0.6)', borderRadius:12, boxShadow:'0 0 0 9999px rgba(0,0,0,0.45)', pointerEvents:'none' }}>
            {[['top','left'],['top','right'],['bottom','left'],['bottom','right']].map(([v,h]) => (
              <div key={v+h} style={{ position:'absolute', [v]:-3, [h]:-3, width:24, height:24,
                borderTop:    v==='top'    ? '4px solid var(--primary)' : 'none',
                borderBottom: v==='bottom' ? '4px solid var(--primary)' : 'none',
                borderLeft:   h==='left'   ? '4px solid var(--primary)' : 'none',
                borderRight:  h==='right'  ? '4px solid var(--primary)' : 'none',
                borderRadius: v==='top'&&h==='left'?'6px 0 0 0':v==='top'&&h==='right'?'0 6px 0 0':v==='bottom'&&h==='left'?'0 0 0 6px':'0 0 6px 0',
              }} />
            ))}
          </div>
          <div style={{ position:'absolute', bottom:16, color:'rgba(255,255,255,0.75)', fontSize:13 }}>
            QR-Code in den Rahmen halten
          </div>
          {kameraErr && (
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
              <p style={{ color:'#fff', textAlign:'center', fontSize:14, background:'rgba(0,0,0,0.7)', padding:'16px 20px', borderRadius:12 }}>{kameraErr}</p>
            </div>
          )}
        </div>
      )}

      {phase === 'gefunden' && gefunden && (
        <div style={{ flex:1, display:'flex', alignItems:'flex-end' }}>
          <div style={{ width:'100%', background:'var(--surface)', borderRadius:'18px 18px 0 0', padding:'24px 20px 32px', maxHeight:'80vh', overflowY:'auto' }}>
            <div style={{ width:40, height:4, borderRadius:2, background:'var(--border)', margin:'0 auto 20px' }} />
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
              <span style={{ fontSize:28 }}>{kat?.icon ?? '📦'}</span>
              <div>
                <div style={{ fontWeight:800, fontSize:18, color:'var(--text)' }}>{gefunden.name}</div>
                {gefunden.hersteller && <div style={{ fontSize:13, color:'var(--text-3)' }}>{gefunden.hersteller}</div>}
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
              {[
                ['Nr.',       gefunden.inventarnummer],
                ['Zustand',   zLabel(gefunden.zustand)],
                kat                       && ['Kategorie', `${kat.icon} ${kat.name}`],
                gefunden.seriennummer     && ['Seriennr.',  gefunden.seriennummer],
                gefunden.kaufdatum        && ['Kaufdatum',  new Date(gefunden.kaufdatum).toLocaleDateString('de-DE')],
                gefunden.anschaffungswert && ['Wert',       `${Number(gefunden.anschaffungswert).toLocaleString('de-DE')} €`],
              ].filter(Boolean).map(([lbl, val]) => (
                <div key={lbl} style={{ background:'var(--bg)', borderRadius:'var(--radius)', padding:'8px 12px' }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2 }}>{lbl}</div>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{val}</div>
                </div>
              ))}
            </div>
            {gefunden.notizen && (
              <div style={{ background:'var(--bg)', borderRadius:'var(--radius)', padding:'8px 12px', marginBottom:16, fontSize:13, color:'var(--text-2)' }}>
                {gefunden.notizen}
              </div>
            )}
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={nochmal} style={{ ...sScanner.btnSek, flex:1 }}>↩ Nochmal</button>
              <button onClick={() => { onClose(); onBearbeiten(gefunden) }} style={{ ...sScanner.btnPri, flex:2 }}>✏️ Bearbeiten</button>
            </div>
          </div>
        </div>
      )}

      {phase === 'nichtGefunden' && (
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16, padding:24 }}>
          <span style={{ fontSize:40 }}>🔍</span>
          <p style={{ color:'#fff', textAlign:'center', fontSize:14 }}>
            Kein Artikel gefunden für:<br/>
            <strong style={{ fontFamily:'monospace', fontSize:15 }}>{letzterCode}</strong>
          </p>
          <button onClick={nochmal} style={sScanner.btnPri}>↩ Nochmal scannen</button>
        </div>
      )}

      {(phase === 'scan' || phase === 'nichtGefunden') && (
        <div style={{ padding:'12px 16px 24px', background:'rgba(0,0,0,0.7)' }}>
          <div style={{ display:'flex', gap:8 }}>
            <input value={manuell} onChange={e => setManuell(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && manuellSuchen()}
              placeholder="Inventarnummer manuell eingeben …"
              style={{ flex:1, padding:'10px 14px', borderRadius:'var(--radius)', border:'1.5px solid rgba(255,255,255,0.25)', background:'rgba(255,255,255,0.12)', color:'#fff', fontSize:14, fontFamily:'inherit', outline:'none' }} />
            <button onClick={manuellSuchen} style={sScanner.btnPri}>Suchen</button>
          </div>
        </div>
      )}
    </div>
  )
}

const sScanner = {
  btnPri: { padding:'11px 20px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg)', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' },
  btnSek: { padding:'11px 16px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-2)', fontSize:14, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' },
}

// ─── Hauptkomponente ──────────────────────────────────────────
export default function Inventar() {
  const { profil } = useApp()

  const [items,         setItems]         = useState([])
  const [kategorien,    setKategorien]    = useState([])
  const [laden,         setLaden]         = useState(true)
  const [modal,         setModal]         = useState(null) // null | { typ: 'neu'|'bearbeiten'|'kategorien'|'scanner' }
  const [suche,         setSuche]         = useState('')
  const [katFilter,     setKatFilter]     = useState('alle')
  const [zustandFilter, setZustandFilter] = useState('alle')

  const ladeKategorien = useCallback(async () => {
    const { data } = await supabase.from('inventar_kategorien').select('*').eq('schule_id', profil?.schule_id).order('name')
    setKategorien(data ?? [])
  }, [profil?.schule_id])

  const ladeItems = useCallback(async () => {
    setLaden(true)
    const { data } = await supabase
      .from('inventar')
      .select('*, inventar_kategorien(id, name, icon)')
      .eq('schule_id', profil?.schule_id)
      .order('laufnummer', { ascending: true })
    setItems(data ?? [])
    setLaden(false)
  }, [profil?.schule_id])

  useEffect(() => {
    ladeKategorien()
    ladeItems()
  }, [ladeKategorien, ladeItems])

  async function loeschen(item) {
    if (!confirm(`„${item.name}" (${item.inventarnummer}) wirklich löschen?`)) return
    await supabase.from('inventar').delete().eq('id', item.id)
    ladeItems()
  }

  const anzeige = items.filter(i => {
    if (katFilter !== 'alle' && (i.kategorie_id ?? 'keine') !== katFilter) return false
    if (zustandFilter !== 'alle' && i.zustand !== zustandFilter) return false
    if (suche.trim()) {
      const q = suche.toLowerCase()
      return (
        i.name?.toLowerCase().includes(q) ||
        i.inventarnummer?.toLowerCase().includes(q) ||
        i.seriennummer?.toLowerCase().includes(q) ||
        i.barcode?.toLowerCase().includes(q) ||
        i.hersteller?.toLowerCase().includes(q)
      )
    }
    return true
  })

  const mob = useMobile()
  const cols = '110px 1fr 120px 140px 130px 90px 100px'

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={s.h1}>📦 Inventar</h1>
          <p style={s.sub}>{items.length} Gegenstände erfasst</p>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button onClick={() => setModal({ typ:'kategorien' })} style={s.btnSek}>⚙️ Kategorien</button>
          <button onClick={() => setModal({ typ:'scanner' })}   style={s.btnSek}>📷 Scannen</button>
          <button onClick={() => etikettenDrucken(anzeige)}     style={s.btnSek} disabled={anzeige.length === 0}>🏷️ Etiketten</button>
          <button onClick={() => setModal({ typ:'neu' })}       style={s.btnPri}>+ Neu</button>
        </div>
      </div>

      {/* Suche */}
      <input style={{ ...s.input, marginBottom:12 }}
        placeholder="Suchen (Name, Nr., Seriennr., Barcode …)"
        value={suche} onChange={e => setSuche(e.target.value)} />

      {/* Filter — horizontal scrollbar auf Mobile */}
      <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:18 }}>
        <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:2 }}>
          <button onClick={() => setKatFilter('alle')} style={fBtn(katFilter === 'alle')}>Alle</button>
          {kategorien.map(k => (
            <button key={k.id} onClick={() => setKatFilter(k.id)} style={fBtn(katFilter === k.id)}>
              {k.icon} {k.name}
            </button>
          ))}
          {items.some(i => !i.kategorie_id) && (
            <button onClick={() => setKatFilter('keine')} style={fBtn(katFilter === 'keine')}>— Keine</button>
          )}
        </div>
        <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:2 }}>
          {ZUSTAENDE.map(z => (
            <button key={z.wert} onClick={() => setZustandFilter(zustandFilter === z.wert ? 'alle' : z.wert)}
              style={{ ...fBtn(zustandFilter === z.wert), color: zustandFilter === z.wert ? 'var(--primary-fg)' : z.farbe, borderColor: zustandFilter === z.wert ? 'var(--primary)' : z.farbe }}>
              {z.label}
            </button>
          ))}
        </div>
      </div>

      {/* Liste */}
      {laden ? (
        <div style={s.leer}>Lade Inventar …</div>
      ) : anzeige.length === 0 ? (
        <div style={s.leer}>
          {items.length === 0
            ? 'Noch keine Gegenstände erfasst. Klick auf "+ Neu".'
            : 'Keine Einträge mit diesen Filtern.'
          }
        </div>
      ) : mob ? (
        /* ── Mobile: Karten ── */
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {anzeige.map(item => (
            <div key={item.id} style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)', overflow:'hidden' }}>
              <div style={{ height:3, background: zFarbe(item.zustand) }} />
              <div style={{ padding:'12px 14px' }}>
                {/* Zeile 1: Nr + Zustand */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:'var(--primary)', fontVariantNumeric:'tabular-nums' }}>
                    {item.inventarnummer}
                  </span>
                  <span style={{ fontSize:11, fontWeight:700, color: zFarbe(item.zustand), background:`color-mix(in srgb, ${zFarbe(item.zustand)} 14%, transparent)`, padding:'2px 8px', borderRadius:99 }}>
                    {zLabel(item.zustand)}
                  </span>
                </div>
                {/* Zeile 2: Name + Hersteller */}
                <div style={{ fontWeight:700, fontSize:15, color:'var(--text)', marginBottom:2 }}>{item.name}</div>
                {item.hersteller && <div style={{ fontSize:12, color:'var(--text-3)', marginBottom:6 }}>{item.hersteller}</div>}
                {/* Zeile 3: Kategorie + Details */}
                <div style={{ display:'flex', gap:10, fontSize:12, color:'var(--text-3)', marginBottom:10, flexWrap:'wrap' }}>
                  {item.inventar_kategorien && (
                    <span>{item.inventar_kategorien.icon} {item.inventar_kategorien.name}</span>
                  )}
                  {item.seriennummer && <span>SN: {item.seriennummer}</span>}
                  {item.barcode && <span>📊 {item.barcode}</span>}
                </div>
                {/* Aktionen */}
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => setModal({ typ:'bearbeiten', item })} style={{ ...s.btnKlein, flex:1, textAlign:'center' }}>✏️ Bearbeiten</button>
                  <button onClick={() => setModal({ typ:'etikettEinzel', item })} style={s.btnKlein} title="Etikett drucken">🏷️</button>
                  <button onClick={() => loeschen(item)} style={{ ...s.btnKlein, color:'var(--danger)' }}>🗑</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ── Desktop: Tabelle ── */
        <div style={{ overflowX:'auto' }}>
          <div style={{ minWidth:700, background:'var(--surface)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)', overflow:'hidden' }}>
            <div style={{ display:'grid', gridTemplateColumns:cols, padding:'10px 16px', background:'var(--bg-2)', borderBottom:'2px solid var(--border)' }}>
              {['Nr.','Bezeichnung','Kategorie','Seriennummer','Barcode','Zustand',''].map((h, i) => (
                <div key={i} style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em' }}>{h}</div>
              ))}
            </div>
            {anzeige.map((item, idx) => (
              <div key={item.id} style={{ display:'grid', gridTemplateColumns:cols, padding:'12px 16px', borderBottom: idx < anzeige.length - 1 ? '1px solid var(--border)' : 'none', alignItems:'center', background: idx % 2 === 0 ? 'var(--surface)' : 'var(--bg)' }}>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--primary)', fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap' }}>
                  {item.inventarnummer}
                </div>
                <div style={{ paddingRight:8 }}>
                  <div style={{ fontWeight:600, fontSize:14, color:'var(--text)' }}>{item.name}</div>
                  {item.hersteller && <div style={{ fontSize:12, color:'var(--text-3)' }}>{item.hersteller}</div>}
                </div>
                <div style={{ fontSize:12, color:'var(--text-2)' }}>
                  {item.inventar_kategorien ? `${item.inventar_kategorien.icon} ${item.inventar_kategorien.name}` : '—'}
                </div>
                <div style={{ fontSize:12, color:'var(--text-2)', fontFamily:'monospace' }}>{item.seriennummer ?? '—'}</div>
                <div style={{ fontSize:12, color:'var(--text-2)', fontFamily:'monospace' }}>{item.barcode ?? '—'}</div>
                <div>
                  <span style={{ fontSize:12, fontWeight:700, color: zFarbe(item.zustand), background:`color-mix(in srgb, ${zFarbe(item.zustand)} 14%, transparent)`, padding:'3px 9px', borderRadius:'var(--radius)', display:'inline-block', whiteSpace:'nowrap' }}>
                    {zLabel(item.zustand)}
                  </span>
                </div>
                <div style={{ display:'flex', gap:4, justifyContent:'flex-end' }}>
                  <button onClick={() => setModal({ typ:'bearbeiten', item })} style={s.btnKlein} title="Bearbeiten">✏️</button>
                  <button onClick={() => setModal({ typ:'etikettEinzel', item })} style={s.btnKlein} title="Etikett drucken">🏷️</button>
                  <button onClick={() => loeschen(item)} style={{ ...s.btnKlein, color:'var(--danger)' }} title="Löschen">🗑</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(modal?.typ === 'neu' || modal?.typ === 'bearbeiten') && (
        <InventarModal
          item={modal.item ?? null}
          schuleId={profil?.schule_id}
          kategorien={kategorien}
          onClose={() => setModal(null)}
          onErfolg={ladeItems}
        />
      )}

      {modal?.typ === 'kategorien' && (
        <KategorienModal
          schuleId={profil?.schule_id}
          onClose={() => setModal(null)}
          onGeaendert={() => { ladeKategorien(); ladeItems() }}
        />
      )}

      {modal?.typ === 'etikettEinzel' && (
        <EtikettEinzelModal
          item={modal.item}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.typ === 'scanner' && (
        <ScannerModal
          schuleId={profil?.schule_id}
          onClose={() => setModal(null)}
          onBearbeiten={item => setModal({ typ:'bearbeiten', item })}
        />
      )}
    </div>
  )
}

function fBtn(aktiv) {
  return {
    padding:'7px 14px', borderRadius:'var(--radius)', fontFamily:'inherit', fontSize:13, cursor:'pointer', whiteSpace:'nowrap',
    border:`1.5px solid ${aktiv ? 'var(--primary)' : 'var(--border)'}`,
    background: aktiv ? 'var(--primary)' : 'var(--surface)',
    color: aktiv ? 'var(--primary-fg)' : 'var(--text-2)',
  }
}

const s = {
  h1:       { margin:'0 0 4px', fontSize:26, fontWeight:800, color:'var(--text)', letterSpacing:'-0.5px' },
  sub:      { margin:0, color:'var(--text-3)', fontSize:14 },
  label:    { fontSize:12, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em' },
  input:    { padding:'10px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', fontSize:14, outline:'none', fontFamily:'inherit', background:'var(--bg)', color:'var(--text)', width:'100%', boxSizing:'border-box' },
  btnPri:   { padding:'10px 20px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg)', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' },
  btnSek:   { padding:'10px 16px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-2)', fontSize:14, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' },
  btnKlein: { padding:'6px 10px', borderRadius:'var(--radius)', border:'none', background:'var(--bg-2)', color:'var(--text-2)', fontSize:13, cursor:'pointer', fontFamily:'inherit' },
  iconBtn:  { background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--text-3)', padding:4 },
  leer:     { padding:'48px', textAlign:'center', color:'var(--text-3)', fontSize:14, background:'var(--surface)', borderRadius:'var(--radius-lg)', border:'1px dashed var(--border)' },
}
