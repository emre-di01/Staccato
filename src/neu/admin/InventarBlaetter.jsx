import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import QRCode from 'qrcode'
import jsQR from 'jsqr'
import { X, Camera, Pencil, Trash2, Plus, Printer, RotateCcw, SearchX, Package } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { Blatt, Feld, Knopf, Gruppe, Trenner, Segment, FehlerText, eingabeStil } from '../../ui'
import { ZUSTAENDE } from '../../pages/admin/Inventar'

// Formular-Blätter des Inventars: Gegenstand, Kategorien, Einzel-Etikett, Scanner.
// Logik wie in pages/admin/Inventar.jsx, nur neue Oberfläche.

const LOCALE = { de: 'de-DE', en: 'en-GB', tr: 'tr-TR' }
const EMOJI_VORSCHLAEGE = ['📦','🎸','🎹','🎺','🎻','🥁','🎷','🪗','🔧','💡','🖥️','📷','🎙️','🪑','🎤','🔌','📺','🗄️','🎭','🏫']

function EmojiWahl({ wert, onChange }) {
  const { T } = useApp()
  return (
    <div role="radiogroup" aria-label={T('nb_symbol')} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {EMOJI_VORSCHLAEGE.map(e => (
        <button key={e} type="button" role="radio" aria-checked={wert === e} onClick={() => onChange(e)} style={{
          width: 44, height: 44, fontSize: 20, borderRadius: 12, cursor: 'pointer',
          border: `2px solid ${wert === e ? 'var(--primary)' : 'transparent'}`, background: 'var(--n-fill)',
        }}>{e}</button>
      ))}
    </div>
  )
}

const symbolFeld = { ...eingabeStil, width: 60, flexShrink: 0, textAlign: 'center', fontSize: 22, padding: '8px' }

// ─── Kategorien ───────────────────────────────────────────────
export function KategorienBlatt({ schuleId, onClose, onGeaendert }) {
  const { confirm, T } = useApp()
  const [kategorien, setKategorien] = useState([])
  const [counts,     setCounts]     = useState({})
  const [neuName,    setNeuName]    = useState('')
  const [neuIcon,    setNeuIcon]    = useState('📦')
  const [bearbeite,  setBearbeite]  = useState(null) // { id, name, icon }
  const [sendet,     setSendet]     = useState(false)
  const [fehler,     setFehler]     = useState('')

  const ladeKategorien = useCallback(async () => {
    const [{ data: kat }, { data: inv }] = await Promise.all([
      supabase.from('inventar_kategorien').select('*').eq('schule_id', schuleId).order('name'),
      supabase.from('inventar').select('kategorie_id').eq('schule_id', schuleId),
    ])
    setKategorien(kat ?? [])
    const c = {}
    for (const row of inv ?? []) if (row.kategorie_id) c[row.kategorie_id] = (c[row.kategorie_id] ?? 0) + 1
    setCounts(c)
  }, [schuleId])

  useEffect(() => { ladeKategorien() }, [ladeKategorien])

  async function erstellen() {
    if (!neuName.trim()) return
    setFehler(''); setSendet(true)
    const { error } = await supabase.from('inventar_kategorien').insert({ schule_id: schuleId, name: neuName.trim(), icon: neuIcon })
    if (error) { setFehler(error.message); setSendet(false); return }
    setNeuName(''); setNeuIcon('📦')
    await ladeKategorien()
    onGeaendert()
    setSendet(false)
  }

  async function speichern() {
    setFehler('')
    const { error } = await supabase.from('inventar_kategorien').update({ name: bearbeite.name, icon: bearbeite.icon }).eq('id', bearbeite.id)
    if (error) { setFehler(error.message); return }
    setBearbeite(null)
    await ladeKategorien()
    onGeaendert()
  }

  async function loeschen(kat) {
    if ((counts[kat.id] ?? 0) > 0) return
    if (!await confirm(T('nb_kategorie_loeschen').replace('{name}', kat.name), { confirmLabel: T('delete') })) return
    await supabase.from('inventar_kategorien').delete().eq('id', kat.id)
    await ladeKategorien()
    onGeaendert()
  }

  return (
    <Blatt titel={T('inv_kat_manage')} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {kategorien.length === 0 ? (
          <p style={{ margin: 0, fontSize: 17, color: 'var(--text-2)' }}>{T('inv_kat_empty')}</p>
        ) : (
          <Gruppe style={{ margin: 0 }}>
            {kategorien.map((kat, i) => {
              const anzahl = counts[kat.id] ?? 0
              return (
                <div key={kat.id}>
                  {i > 0 && <Trenner />}
                  {bearbeite?.id === kat.id ? (
                    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input aria-label={T('nb_symbol')} value={bearbeite.icon} onChange={e => setBearbeite(b => ({ ...b, icon: e.target.value }))} style={symbolFeld} />
                        <input aria-label={T('name')} value={bearbeite.name} onChange={e => setBearbeite(b => ({ ...b, name: e.target.value }))} style={{ ...eingabeStil, flex: 1 }} autoFocus />
                      </div>
                      <EmojiWahl wert={bearbeite.icon} onChange={icon => setBearbeite(b => ({ ...b, icon }))} />
                      <div style={{ display: 'flex', gap: 10 }}>
                        <Knopf variante="sekundaer" style={{ flex: 1 }} onClick={() => setBearbeite(null)}>{T('cancel')}</Knopf>
                        <Knopf style={{ flex: 1 }} onClick={speichern}>{T('save')}</Knopf>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, padding: '6px 8px 6px 16px' }}>
                      <span aria-hidden="true" style={{ fontSize: 24 }}>{kat.icon}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 17, fontWeight: 600 }}>{kat.name}</span>
                        {anzahl > 0 && <span style={{ display: 'block', fontSize: 15, color: 'var(--text-2)' }}>{T('nb_x_gegenstaende').replace('{n}', anzahl)}</span>}
                      </span>
                      <button onClick={() => setBearbeite({ id: kat.id, name: kat.name, icon: kat.icon })} aria-label={`${kat.name}: ${T('edit')}`} style={iconKnopf}><Pencil size={20} /></button>
                      <button onClick={() => loeschen(kat)} disabled={anzahl > 0} aria-label={`${kat.name}: ${T('delete')}`} title={anzahl > 0 ? T('inv_kat_in_use') : undefined}
                        style={{ ...iconKnopf, color: anzahl > 0 ? 'var(--n-chev)' : 'var(--danger)', cursor: anzahl > 0 ? 'not-allowed' : 'pointer' }}><Trash2 size={20} /></button>
                    </div>
                  )}
                </div>
              )
            })}
          </Gruppe>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-2)' }}>{T('inv_kat_new')}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input aria-label={T('nb_symbol')} value={neuIcon} onChange={e => setNeuIcon(e.target.value)} style={symbolFeld} />
            <input aria-label={T('name')} value={neuName} onChange={e => setNeuName(e.target.value)} placeholder={T('inv_kat_name_placeholder')}
              onKeyDown={e => e.key === 'Enter' && erstellen()} style={{ ...eingabeStil, flex: 1 }} />
          </div>
          <EmojiWahl wert={neuIcon} onChange={setNeuIcon} />
          {fehler && <FehlerText>{fehler}</FehlerText>}
          <Knopf voll icon={Plus} onClick={erstellen} disabled={sendet || !neuName.trim()}>{T('nb_kategorie_anlegen')}</Knopf>
        </div>
      </div>
    </Blatt>
  )
}

const iconKnopf = { width: 44, height: 44, flexShrink: 0, borderRadius: 22, border: 'none', background: 'none', color: 'var(--text-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }

// ─── Kamera-Scan (QR/Barcode) ─────────────────────────────────
// Startet die Rückkamera und meldet den ersten erkannten Code; ohne BarcodeDetector per jsQR (nur QR).
function useKameraScan(onErkannt, formate) {
  const { T } = useApp()
  const videoRef  = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const animRef   = useRef(null)
  const aktiv     = useRef(true)
  const meldenRef = useRef(onErkannt)
  useEffect(() => { meldenRef.current = onErkannt })
  const [fehler, setFehler] = useState('')

  const stop = useCallback(() => {
    cancelAnimationFrame(animRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  const start = useCallback(async () => {
    const hatNativ = typeof BarcodeDetector !== 'undefined'
    function schleife() {
      if (!aktiv.current) return
      animRef.current = requestAnimationFrame(async () => {
        if (!aktiv.current) return
        const vid = videoRef.current
        if (!vid || vid.readyState < 2 || vid.paused) { schleife(); return }
        let erkannt = null
        try {
          if (hatNativ) {
            const codes = await new BarcodeDetector({ formats: formate }).detect(vid)
            if (codes.length > 0) erkannt = codes[0].rawValue
          } else {
            const cvs = canvasRef.current
            const w = vid.videoWidth, h = vid.videoHeight
            if (w && h) {
              cvs.width = w; cvs.height = h
              const ctx = cvs.getContext('2d')
              ctx.drawImage(vid, 0, 0, w, h)
              const res = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' })
              if (res) erkannt = res.data
            }
          }
        } catch { /* einzelnes Bild nicht lesbar – weiter */ }
        if (erkannt && aktiv.current) { stop(); meldenRef.current(erkannt); return }
        schleife()
      })
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } } })
      if (!aktiv.current) { stream.getTracks().forEach(t => t.stop()); return }
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      schleife()
    } catch (e) {
      setFehler(T('inv_camera_error') + ' ' + (e.message ?? String(e)))
    }
  }, [formate, stop, T])

  useEffect(() => {
    aktiv.current = true
    start()
    return () => { aktiv.current = false; stop() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { videoRef, canvasRef, fehler, start, stop }
}

// Vollbild mit Kamerabild und Sucher-Rahmen (dunkel, unabhängig vom Farbmodus)
function KameraVollbild({ titel, hinweis, rahmen, onClose, videoRef, canvasRef, fehler, zeigeKamera = true, children, unten }) {
  const { T } = useApp()
  useEffect(() => {
    const esc = e => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])
  return createPortal(
    // z-index unter dem Blatt (1000), damit das Ergebnis-Blatt darüber erscheint
    <div role="dialog" aria-modal="true" aria-label={titel} style={{ position: 'fixed', inset: 0, zIndex: 999, background: '#000', color: '#F5F5F7', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 'calc(10px + env(safe-area-inset-top, 0px)) 16px 10px' }}>
        <span style={{ fontSize: 20, fontWeight: 800 }}>{titel}</span>
        <button onClick={onClose} aria-label={T('close')} style={{ width: 44, height: 44, borderRadius: 22, border: 'none', background: 'rgba(255,255,255,0.16)', color: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={22} /></button>
      </div>
      {/* Video bleibt immer eingehängt, sonst findet ein Neustart der Kamera kein Element */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <video ref={videoRef} playsInline muted autoPlay style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        {zeigeKamera ? (
          <>
            <div aria-hidden="true" style={{ position: 'absolute', width: rahmen.w, height: rahmen.h, border: '3px solid #FB923C', borderRadius: 18, boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: 20, left: 20, right: 20, textAlign: 'center', fontSize: 17, color: 'rgba(255,255,255,0.85)' }}>{hinweis}</div>
            {fehler && (
              <div role="alert" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                <p style={{ margin: 0, textAlign: 'center', fontSize: 17, lineHeight: 1.45, background: 'rgba(0,0,0,0.8)', padding: '16px 20px', borderRadius: 16 }}>{fehler}</p>
              </div>
            )}
          </>
        ) : (
          <div style={{ position: 'absolute', inset: 0, background: '#000', display: 'flex' }}>{children}</div>
        )}
      </div>
      {unten}
    </div>,
    document.body,
  )
}

const SCAN_FORMATE_SUCHE = ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8']
const SCAN_FORMATE_BARCODE = ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e']

function BarcodeErfassen({ onGescannt, onClose }) {
  const { T } = useApp()
  const { videoRef, canvasRef, fehler } = useKameraScan(onGescannt, SCAN_FORMATE_BARCODE)
  return <KameraVollbild titel={T('inv_barcode_scan_title')} hinweis={T('inv_barcode_hint')} rahmen={{ w: 280, h: 120 }} onClose={onClose} videoRef={videoRef} canvasRef={canvasRef} fehler={fehler} />
}

// ─── Gegenstand anlegen / bearbeiten ──────────────────────────
export function InventarBlatt({ item, schuleId, kategorien, onClose, onErfolg }) {
  const { T } = useApp()
  const istNeu = !item?.id
  const [form, setForm] = useState({
    name:             item?.name         ?? '',
    kategorie_id:     item?.kategorie_id ?? (kategorien[0]?.id ?? ''),
    hersteller:       item?.hersteller   ?? '',
    seriennummer:     item?.seriennummer ?? '',
    barcode:          item?.barcode      ?? '',
    kaufdatum:        item?.kaufdatum    ?? '',
    anschaffungswert: item?.anschaffungswert != null ? String(item.anschaffungswert) : '',
    zustand:          item?.zustand      ?? 'gut',
    notizen:          item?.notizen      ?? '',
  })
  const setze = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const [sendet,  setSendet]  = useState(false)
  const [fehler,  setFehler]  = useState('')
  const [scannen, setScannen] = useState(false)

  async function speichern() {
    if (!form.name.trim()) { setFehler(T('inv_label_required')); return }
    setSendet(true)
    const payload = {
      name:             form.name.trim(),
      kategorie_id:     form.kategorie_id || null,
      hersteller:       form.hersteller.trim()   || null,
      seriennummer:     form.seriennummer.trim() || null,
      barcode:          form.barcode.trim()      || null,
      kaufdatum:        form.kaufdatum           || null,
      anschaffungswert: form.anschaffungswert ? parseFloat(form.anschaffungswert) : null,
      zustand:          form.zustand,
      notizen:          form.notizen.trim()      || null,
      aktualisiert_am:  new Date().toISOString(),
    }
    const { error } = istNeu
      ? await supabase.from('inventar').insert({ ...payload, schule_id: schuleId })
      : await supabase.from('inventar').update(payload).eq('id', item.id)
    if (error) setFehler(error.message)
    else { onErfolg(); onClose() }
    setSendet(false)
  }

  return (
    <>
      <Blatt titel={istNeu ? T('inv_item_new') : T('inv_item_edit')} onClose={onClose}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {kategorien.length > 0 && (
            <Feld label={T('inv_col_cat')}>
              <select value={form.kategorie_id} onChange={e => setze('kategorie_id', e.target.value)} style={eingabeStil}>
                <option value="">{T('inv_filter_no_cat')}</option>
                {kategorien.map(k => <option key={k.id} value={k.id}>{k.icon} {k.name}</option>)}
              </select>
            </Feld>
          )}
          <Feld label={T('inv_field_name')}>
            <input value={form.name} onChange={e => setze('name', e.target.value)} placeholder={T('nb_inv_name_beispiel')} style={eingabeStil} />
          </Feld>
          <Feld label={T('inv_field_brand')}>
            <input value={form.hersteller} onChange={e => setze('hersteller', e.target.value)} style={eingabeStil} />
          </Feld>
          <Feld label={T('inv_field_serial')}>
            <input value={form.seriennummer} onChange={e => setze('seriennummer', e.target.value)} style={eingabeStil} />
          </Feld>
          <div>
            <label htmlFor="inv-barcode" style={{ display: 'block', fontSize: 16, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>{T('inv_field_barcode')}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input id="inv-barcode" value={form.barcode} onChange={e => setze('barcode', e.target.value)} style={{ ...eingabeStil, flex: 1 }} />
              <Knopf variante="sekundaer" icon={Camera} aria-label={T('inv_scan_barcode')} onClick={() => setScannen(true)} style={{ padding: '0 16px' }} />
            </div>
          </div>
          <Feld label={T('inv_field_purchase_date')}>
            <input type="date" value={form.kaufdatum} onChange={e => setze('kaufdatum', e.target.value)} style={eingabeStil} />
          </Feld>
          <Feld label={T('inv_field_value')}>
            <input type="number" inputMode="decimal" min="0" step="0.01" placeholder="0,00" value={form.anschaffungswert} onChange={e => setze('anschaffungswert', e.target.value)} style={eingabeStil} />
          </Feld>
          <Feld label={T('inv_field_condition')}>
            <Segment label={T('inv_field_condition')} wert={form.zustand} onChange={v => setze('zustand', v)} optionen={ZUSTAENDE.map(z => [z.wert, T(z.labelKey)])} />
          </Feld>
          <Feld label={T('inv_field_notes')}>
            <textarea rows={3} value={form.notizen} onChange={e => setze('notizen', e.target.value)} placeholder={T('inv_notes_placeholder')} style={{ ...eingabeStil, resize: 'vertical' }} />
          </Feld>
          {fehler && <FehlerText>{fehler}</FehlerText>}
          <Knopf voll onClick={speichern} disabled={sendet}>{sendet ? T('inv_saving') : istNeu ? T('inv_create') : T('save')}</Knopf>
        </div>
      </Blatt>
      {scannen && <BarcodeErfassen onGescannt={code => { setze('barcode', code); setScannen(false) }} onClose={() => setScannen(false)} />}
    </>
  )
}

// ─── Einzel-Etikett (Labeldrucker) ────────────────────────────
const LABEL_GROESSEN = [
  { label: '62 × 29 mm',           w: 62, h: 29 },
  { label: '57 × 32 mm (Dymo)',    w: 57, h: 32 },
  { label: '54 × 25 mm',           w: 54, h: 25 },
  { label: '38 × 90 mm (Brother)', w: 38, h: 90 },
  { label: '29 × 90 mm (Brother)', w: 29, h: 90 },
  { label: null,                   w: null, h: null },
]

export function EtikettBlatt({ item, onClose }) {
  const { T } = useApp()
  const gespeichert = (() => { try { return JSON.parse(localStorage.getItem('staccato_label_size') ?? 'null') } catch { return null } })()
  const [preset,   setPreset]   = useState(gespeichert?.preset ?? 0)
  const [breite,   setBreite]   = useState(String(gespeichert?.w ?? LABEL_GROESSEN[0].w))
  const [hoehe,    setHoehe]    = useState(String(gespeichert?.h ?? LABEL_GROESSEN[0].h))
  const [vorschau, setVorschau] = useState(null)
  const [sendet,   setSendet]   = useState(false)

  const istCustom = LABEL_GROESSEN[preset].w === null

  function presetWaehlen(i) {
    setPreset(i)
    if (LABEL_GROESSEN[i].w !== null) {
      setBreite(String(LABEL_GROESSEN[i].w))
      setHoehe(String(LABEL_GROESSEN[i].h))
    }
  }

  useEffect(() => {
    const w = parseFloat(breite), h = parseFloat(hoehe)
    if (!w || !h) return
    let aktiv = true
    QRCode.toDataURL(item.inventarnummer, { width: 200, margin: 1 }).then(url => { if (aktiv) setVorschau({ url, w, h }) })
    return () => { aktiv = false }
  }, [breite, hoehe, item.inventarnummer])

  async function drucken() {
    const w = parseFloat(breite), h = parseFloat(hoehe)
    if (!w || !h) return
    localStorage.setItem('staccato_label_size', JSON.stringify({ preset, w, h }))
    setSendet(true)
    const qrUrl = await QRCode.toDataURL(item.inventarnummer, { width: 300, margin: 1 })
    const quer = w > h
    const qrMm = Math.min(w, h) - (quer ? 6 : 10)
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      @page{size:${w}mm ${h}mm;margin:0}
      *{box-sizing:border-box;margin:0;padding:0}
      body{width:${w}mm;height:${h}mm;font-family:Arial,sans-serif;overflow:hidden}
      .wrap{width:100%;height:100%;display:flex;flex-direction:${quer ? 'row' : 'column'};align-items:center;justify-content:center;padding:2mm;gap:2mm}
      img{width:${qrMm}mm;height:${qrMm}mm;flex-shrink:0}
      .txt{display:flex;flex-direction:column;gap:1mm;overflow:hidden;${quer ? `max-width:${w - qrMm - 8}mm` : ''}}
      .nr{font-size:${quer ? 9 : 8}pt;font-weight:bold;letter-spacing:0.03em;white-space:nowrap}
      .name{font-size:${quer ? 7 : 6}pt;color:#444;overflow:hidden;text-overflow:ellipsis;${quer ? 'white-space:nowrap' : ''}}
    </style></head><body>
    <div class="wrap"><img src="${qrUrl}"/><div class="txt"><div class="nr">${item.inventarnummer}</div><div class="name">${item.name.replace(/</g, '&lt;')}</div></div></div>
    <script>window.onload=()=>{window.print();}<\/script>
    </body></html>`
    const win = window.open('', '_blank', `width=${Math.round(w * 4)},height=${Math.round(h * 4 + 80)}`)
    win.document.write(html); win.document.close()
    setSendet(false)
    onClose()
  }

  // Vorschau maßstabsgetreu, höchstens 280 × 160 px
  const SCALE = vorschau ? Math.min(280 / (vorschau.w * 3.78), 160 / (vorschau.h * 3.78)) : 1
  const vpx = vorschau ? { w: vorschau.w * 3.78 * SCALE, h: vorschau.h * 3.78 * SCALE } : null
  const quer = vorschau ? vorschau.w > vorschau.h : false
  const qrPx = vorschau ? (Math.min(vorschau.w, vorschau.h) - (quer ? 6 : 10)) * 3.78 * SCALE : 0

  return (
    <Blatt titel={T('inv_label_print')} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ padding: '12px 16px', borderRadius: 14, background: 'var(--n-fill)', fontSize: 17 }}>
          <strong>{item.inventarnummer}</strong> · {item.name}
        </div>
        <Feld label={T('inv_label_size')}>
          <select value={preset} onChange={e => presetWaehlen(Number(e.target.value))} style={eingabeStil}>
            {LABEL_GROESSEN.map((g, i) => <option key={i} value={i}>{g.label ?? T('nb_eigene_groesse')}</option>)}
          </select>
        </Feld>
        {istCustom && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Feld label={T('inv_label_width')}>
              <input type="number" inputMode="numeric" min="10" max="200" value={breite} onChange={e => setBreite(e.target.value)} style={eingabeStil} />
            </Feld>
            <Feld label={T('inv_label_height')}>
              <input type="number" inputMode="numeric" min="10" max="200" value={hoehe} onChange={e => setHoehe(e.target.value)} style={eingabeStil} />
            </Feld>
          </div>
        )}
        {vpx && (
          <div style={{ padding: 20, borderRadius: 18, background: 'var(--n-fill)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div style={{ width: vpx.w, height: vpx.h, borderRadius: 4, background: '#FFFFFF', boxShadow: '0 1px 4px rgba(0,0,0,0.2)', display: 'flex', flexDirection: quer ? 'row' : 'column', alignItems: 'center', justifyContent: 'center', gap: 4 * SCALE, padding: 6 * SCALE, overflow: 'hidden' }}>
              <img src={vorschau.url} style={{ width: qrPx, height: qrPx, flexShrink: 0 }} alt="" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 * SCALE, overflow: 'hidden', ...(quer ? { maxWidth: vpx.w - qrPx - 16 * SCALE } : {}) }}>
                <div style={{ fontSize: Math.max(8, 9 * SCALE), fontWeight: 'bold', color: '#000', whiteSpace: 'nowrap' }}>{item.inventarnummer}</div>
                <div style={{ fontSize: Math.max(7, 7 * SCALE), color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: quer ? 'nowrap' : 'normal' }}>{item.name}</div>
              </div>
            </div>
            <div style={{ fontSize: 15, color: 'var(--text-2)' }}>{breite} × {hoehe} mm</div>
          </div>
        )}
        <Knopf voll icon={Printer} onClick={drucken} disabled={sendet}>{T('inv_print')}</Knopf>
      </div>
    </Blatt>
  )
}

// ─── Scanner: Gegenstand per QR/Barcode finden ────────────────
export function ScannerVollbild({ schuleId, onClose, onBearbeiten }) {
  const { T, lang } = useApp()
  const [phase,       setPhase]       = useState('scan') // 'scan' | 'gefunden' | 'nichtGefunden'
  const [gefunden,    setGefunden]    = useState(null)
  const [letzterCode, setLetzterCode] = useState('')
  const [manuell,     setManuell]     = useState('')

  async function sucheArtikel(code) {
    setLetzterCode(code)
    const q = code.trim()
    const { data } = await supabase.from('inventar')
      .select('*, inventar_kategorien(id, name, icon)')
      .eq('schule_id', schuleId)
      .or(`inventarnummer.ilike.${q},barcode.eq.${q}`)
      .maybeSingle()
    if (data) { setGefunden(data); setPhase('gefunden') }
    else setPhase('nichtGefunden')
  }

  const { videoRef, canvasRef, fehler, start, stop } = useKameraScan(sucheArtikel, SCAN_FORMATE_SUCHE)

  async function manuellSuchen() {
    if (!manuell.trim()) return
    stop()
    await sucheArtikel(manuell.trim())
  }

  function nochmal() {
    setPhase('scan'); setGefunden(null); setLetzterCode(''); setManuell('')
    start()
  }

  const loc = LOCALE[lang] ?? 'de-DE'
  const kat = gefunden?.inventar_kategorien
  const zustandLabel = z => T(ZUSTAENDE.find(x => x.wert === z)?.labelKey ?? z)

  const suchleiste = (phase === 'scan' || phase === 'nichtGefunden') && (
    <div style={{ display: 'flex', gap: 8, padding: '12px 16px calc(16px + env(safe-area-inset-bottom, 0px))' }}>
      <input value={manuell} onChange={e => setManuell(e.target.value)} onKeyDown={e => e.key === 'Enter' && manuellSuchen()}
        aria-label={T('inv_manual_placeholder')} placeholder={T('inv_manual_placeholder')}
        style={{ ...eingabeStil, flex: 1, background: 'rgba(255,255,255,0.12)', border: '1.5px solid rgba(255,255,255,0.25)', color: '#FFFFFF' }} />
      <Knopf onClick={manuellSuchen}>{T('inv_search_btn')}</Knopf>
    </div>
  )

  return (
    <>
      <KameraVollbild titel={T('inv_scanner_title')} hinweis={T('inv_scanner_hint')} rahmen={{ w: 230, h: 230 }} onClose={onClose}
        videoRef={videoRef} canvasRef={canvasRef} fehler={fehler} zeigeKamera={phase !== 'nichtGefunden'} unten={suchleiste}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center' }}>
          <SearchX aria-hidden="true" size={48} strokeWidth={1.7} />
          <p style={{ margin: 0, fontSize: 17, lineHeight: 1.5 }}>
            {T('inv_not_found')}<br /><strong style={{ fontFamily: 'ui-monospace, monospace' }}>{letzterCode}</strong>
          </p>
          <Knopf icon={RotateCcw} onClick={nochmal}>{T('inv_scan_again')}</Knopf>
        </div>
      </KameraVollbild>

      {phase === 'gefunden' && gefunden && (
        <Blatt titel={gefunden.name} onClose={nochmal}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span aria-hidden="true" style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--n-fill)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>
                {kat?.icon ?? <Package size={26} />}
              </span>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700 }}>{gefunden.inventarnummer}</div>
                {gefunden.hersteller && <div style={{ fontSize: 15, color: 'var(--text-2)' }}>{gefunden.hersteller}</div>}
              </div>
            </div>
            <Gruppe style={{ margin: 0 }}>
              {[
                [T('inv_field_condition'), zustandLabel(gefunden.zustand)],
                kat && [T('inv_col_cat'), `${kat.icon} ${kat.name}`],
                gefunden.seriennummer && [T('inv_scanner_serial'), gefunden.seriennummer],
                gefunden.kaufdatum && [T('inv_field_purchase_date'), new Date(gefunden.kaufdatum).toLocaleDateString(loc)],
                gefunden.anschaffungswert && [T('inv_field_value'), Number(gefunden.anschaffungswert).toLocaleString(loc, { style: 'currency', currency: 'EUR' })],
              ].filter(Boolean).map(([lbl, val], i) => (
                <div key={lbl}>
                  {i > 0 && <Trenner />}
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '14px 16px', fontSize: 17 }}>
                    <span style={{ color: 'var(--text-2)' }}>{lbl}</span>
                    <span style={{ fontWeight: 600, textAlign: 'right' }}>{val}</span>
                  </div>
                </div>
              ))}
            </Gruppe>
            {gefunden.notizen && <p style={{ margin: 0, fontSize: 17, lineHeight: 1.45, color: 'var(--text-2)' }}>{gefunden.notizen}</p>}
            <Knopf voll icon={Pencil} onClick={() => { onClose(); onBearbeiten(gefunden) }}>{T('inv_edit_btn')}</Knopf>
            <Knopf voll variante="sekundaer" icon={RotateCcw} onClick={nochmal}>{T('inv_scanner_again')}</Knopf>
          </div>
        </Blatt>
      )}
    </>
  )
}
