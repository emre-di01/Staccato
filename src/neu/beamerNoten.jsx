import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ZoomIn, ZoomOut } from 'lucide-react'
import { useApp } from '../context/AppContext'

// Noten auf dem Beamer, gesteuert vom Handy.
// Der Beamer führt die Ansicht (Datei, Seite, Zoom, Ausschnitt) und meldet sie per `noten_status`;
// das Handy schickt nur Befehle per `noten_befehl` (Kanal `beamer-<code>`).
//
// Ausschnitt in Seiten-Anteilen: l/t = linke/obere Kante, b/h = sichtbare Breite/Höhe (0…1).
// Zoom z = gezeichnete Seitenbreite / Breite der Beamer-Fläche (1 = volle Breite).

const pdfCache = new Map()
export function ladePdf(url) {
  if (!pdfCache.has(url)) {
    pdfCache.set(url, (async () => {
      const pdfjs = await import('pdfjs-dist')
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href
      return pdfjs.getDocument({ url }).promise
    })().catch(e => { pdfCache.delete(url); throw e }))
  }
  return pdfCache.get(url)
}

const ZOOM_MAX = 5
const SCHRITT = 0.85   // „Weiter“ rückt um 85 % der sichtbaren Höhe – eine Zeile bleibt zur Orientierung

// Zoom für „ganze Seite“: Seite passt komplett in die Fläche (W×H), a = Höhe/Breite der Seite
const zGanz = (W, H, a) => Math.min(1, H / (a * W))

// Ansicht auf gültige Werte begrenzen und den sichtbaren Ausschnitt berechnen
function klemmen(s, W, H, a, seiten) {
  const z = Math.min(ZOOM_MAX, Math.max(zGanz(W, H, a), s.z))
  const pw = z * W, ph = pw * a
  const b = Math.min(1, W / pw), h = Math.min(1, H / ph)
  const begrenzt = (v, max) => Math.min(max, Math.max(0, v))
  return {
    ...s, z,
    seite: Math.min(Math.max(1, s.seite), seiten || 1),
    l: begrenzt(s.l, 1 - b), t: begrenzt(s.t, 1 - h), b, h,
  }
}

function anwenden(s, cmd, W, H, a, seiten) {
  const k = klemmen(s, W, H, a, seiten)
  switch (cmd.befehl) {
    case 'weiter':
      if (k.t + k.h < 0.999) return { ...k, t: k.t + k.h * SCHRITT }
      return k.seite < seiten ? { ...k, seite: k.seite + 1, t: 0 } : k
    case 'zurueck':
      if (k.t > 0.001) return { ...k, t: k.t - k.h * SCHRITT }
      return k.seite > 1 ? { ...k, seite: k.seite - 1, t: 1 } : k
    case 'seite':  return { ...k, seite: k.seite + (cmd.richtung ?? 0), t: 0 }
    case 'ganz':   return { ...k, z: 0, l: 0, t: 0 }
    case 'breite': return { ...k, z: 1, l: 0, t: 0 }
    case 'oben':   return { ...k, z: (2 * H) / (a * W), l: 0, t: 0 }
    case 'unten':  return { ...k, z: (2 * H) / (a * W), l: 0, t: 1 }
    case 'setzen': return { ...k, l: cmd.l ?? k.l, t: cmd.t ?? k.t }
    case 'datei':  return { datei: cmd.datei ?? 0, seite: 1, z: 1, l: 0, t: 0 }
    case 'zoom': {
      // Mitte des Ausschnitts bleibt stehen
      const n = klemmen({ ...k, z: k.z * cmd.faktor }, W, H, a, seiten)
      return { ...n, l: k.l + k.b / 2 - n.b / 2, t: k.t + k.h / 2 - n.h / 2 }
    }
    default: return k
  }
}

// ─── Beamer: zeichnet den sichtbaren Ausschnitt ───────────────
export function NotenBeamer({ dateien, befehlRef, senden }) {
  const { T } = useApp()
  const boxRef = useRef(null)
  const canvasRef = useRef(null)
  const [mass, setMass] = useState({ W: 0, H: 0 })
  const [sicht, setSicht] = useState({ datei: 0, seite: 1, z: 1, l: 0, t: 0 })
  const [pdf, setPdf] = useState(null)
  const [seite, setSeite] = useState(null)
  const [fehler, setFehler] = useState(false)
  const url = dateien[sicht.datei]?.url

  // Aktuelle Werte für Befehle (kommen asynchron über den Kanal)
  const lage = useRef({})
  const basis = seite?.getViewport({ scale: 1 })
  const a = basis ? basis.height / basis.width : 1.414
  useEffect(() => { lage.current = { W: mass.W, H: mass.H, a, seiten: pdf?.numPages ?? 1 } })

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setMass({ W: e.contentRect.width, H: e.contentRect.height }))
    ro.observe(boxRef.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!url) return
    let weg = false
    ladePdf(url).then(d => { if (!weg) { setPdf(d); setFehler(false) } }).catch(() => { if (!weg) setFehler(true) })
    return () => { weg = true }
  }, [url])

  useEffect(() => {
    if (!pdf) return
    let weg = false
    const n = Math.min(Math.max(1, sicht.seite), pdf.numPages)
    pdf.getPage(n).then(p => { if (!weg) setSeite(p) })
    return () => { weg = true }
  }, [pdf, sicht.seite])

  // Befehle vom Handy und von der Tastatur/einem Presenter am Beamer-Rechner
  useEffect(() => {
    const ausfuehren = cmd => {
      const { W, H, a: as, seiten } = lage.current
      if (!W || !H) return
      setSicht(s => anwenden(s, cmd, W, H, as, seiten))
    }
    befehlRef.current = ausfuehren
    const taste = e => {
      const zuordnung = { ArrowDown: 'weiter', PageDown: 'weiter', ' ': 'weiter', ArrowRight: 'weiter', ArrowUp: 'zurueck', PageUp: 'zurueck', ArrowLeft: 'zurueck' }
      if (zuordnung[e.key]) { e.preventDefault(); ausfuehren({ befehl: zuordnung[e.key] }) }
      else if (e.key === '+' || e.key === '=') ausfuehren({ befehl: 'zoom', faktor: 1.25 })
      else if (e.key === '-') ausfuehren({ befehl: 'zoom', faktor: 0.8 })
    }
    window.addEventListener('keydown', taste)
    return () => { befehlRef.current = null; window.removeEventListener('keydown', taste) }
  }, [befehlRef])

  // Zeichnen: nur der sichtbare Teil der Seite, in voller Auflösung
  const k = mass.W && seite ? klemmen(sicht, mass.W, mass.H, a, pdf?.numPages) : null
  useEffect(() => {
    if (!k || !seite) return
    const { W, H } = mass
    const pw = k.z * W, ph = pw * a
    const ox = pw <= W ? (W - pw) / 2 : -k.l * pw
    const oy = ph <= H ? (H - ph) / 2 : -k.t * ph
    const links = Math.max(0, ox), oben = Math.max(0, oy)
    const breite = Math.min(W, ox + pw) - links, hoehe = Math.min(H, oy + ph) - oben
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const cvs = canvasRef.current
    cvs.width = Math.round(breite * dpr); cvs.height = Math.round(hoehe * dpr)
    Object.assign(cvs.style, { left: `${links}px`, top: `${oben}px`, width: `${breite}px`, height: `${hoehe}px` })
    const vp = seite.getViewport({ scale: (pw * dpr) / basis.width, offsetX: (ox - links) * dpr, offsetY: (oy - oben) * dpr })
    const aufgabe = seite.render({ canvasContext: cvs.getContext('2d'), viewport: vp })
    aufgabe.promise.catch(() => {})
    senden('noten_status', { datei: sicht.datei, dateien: dateien.length, seite: k.seite, seiten: pdf.numPages, rect: { l: k.l, t: k.t, b: k.b, h: k.h } })
    return () => aufgabe.cancel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seite, mass.W, mass.H, k?.z, k?.l, k?.t, k?.seite])

  return (
    <div ref={boxRef} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', background: '#FFFFFF', borderRadius: 4 }} />
      {fehler && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: '#A1A1AA' }}>{T('nbn_fehler')}</div>}
      {k && pdf?.numPages > 1 && (
        <div style={{ position: 'absolute', right: 16, bottom: 16, padding: '6px 14px', borderRadius: 16, background: 'rgba(0,0,0,0.7)', color: '#F5F5F7', fontSize: 17, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {k.seite} / {pdf.numPages}
        </div>
      )}
    </div>
  )
}

// ─── Handy: Vorschau mit Rahmen + Knöpfe ──────────────────────
const F = { karte: '#1C1C21', linie: '#2A2A30', text: '#F5F5F7', text2: '#A1A1AA', akzent: '#FB923C' }

export function NotenSteuerung({ dateien, status, befehl }) {
  const { T } = useApp()
  const datei = status?.datei ?? 0
  const seiten = status?.seiten ?? 1
  const seite = status?.seite ?? 1
  const k = (cmd, label, inhalt, extra = {}) => (
    <button onClick={() => befehl(cmd)} aria-label={label} style={{ ...knopf, ...extra }}>{inhalt ?? label}</button>
  )

  return (
    <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {dateien.length > 1 && (
        <div role="group" aria-label={T('nbn_datei')} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {dateien.map((d, i) => (
            <button key={i} onClick={() => befehl({ befehl: 'datei', datei: i })} aria-pressed={datei === i}
              style={{ ...chip, background: datei === i ? '#FFFFFF' : F.linie, color: datei === i ? '#111114' : F.text }}>
              {d.stimme && d.stimme !== 'keine' ? d.stimme : `${T('piece_notes_label')} ${i + 1}`}
            </button>
          ))}
        </div>
      )}

      {dateien[datei]?.url && <NotenVorschau url={dateien[datei].url} seite={seite} rect={status?.rect} befehl={befehl} />}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {k({ befehl: 'zurueck' }, T('nbn_zurueck'), <><ChevronUp aria-hidden="true" size={22} />{T('nbn_zurueck')}</>, { minHeight: 60 })}
        {k({ befehl: 'weiter' }, T('nbn_weiter'), <><ChevronDown aria-hidden="true" size={22} />{T('nbn_weiter')}</>, { minHeight: 60, background: F.akzent, color: '#111114' })}
      </div>
      <div role="group" aria-label={T('nbn_ansicht')} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {k({ befehl: 'ganz' }, T('nbn_ganz'))}
        {k({ befehl: 'breite' }, T('nbn_breite'))}
        {k({ befehl: 'oben' }, T('nbn_oben'))}
        {k({ befehl: 'unten' }, T('nbn_unten'))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {k({ befehl: 'seite', richtung: -1 }, T('nbn_seite_zurueck'), <ChevronLeft aria-hidden="true" size={22} />, { width: 52, padding: 0 })}
        <span aria-live="polite" style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: 600, color: F.text2, fontVariantNumeric: 'tabular-nums' }}>
          {T('nbn_seite').replace('{n}', seite).replace('{m}', seiten)}
        </span>
        {k({ befehl: 'seite', richtung: 1 }, T('nbn_seite_weiter'), <ChevronRight aria-hidden="true" size={22} />, { width: 52, padding: 0 })}
        <span aria-hidden="true" style={{ width: 1, height: 28, background: F.linie, margin: '0 4px' }} />
        {k({ befehl: 'zoom', faktor: 0.8 }, T('nbn_kleiner'), <ZoomOut aria-hidden="true" size={22} />, { width: 52, padding: 0 })}
        {k({ befehl: 'zoom', faktor: 1.25 }, T('nbn_groesser'), <ZoomIn aria-hidden="true" size={22} />, { width: 52, padding: 0 })}
      </div>
    </div>
  )
}

// Kleine Seitenvorschau; der Rahmen zeigt, was der Beamer gerade zeigt, und lässt sich verschieben
function NotenVorschau({ url, seite, rect, befehl }) {
  const { T } = useApp()
  const canvasRef = useRef(null)
  const boxRef = useRef(null)
  const [bereit, setBereit] = useState(false)
  const [lokal, setLokal] = useState(null)       // Rahmen während des Ziehens
  const zug = useRef(null)
  const zuletzt = useRef(0)

  useEffect(() => {
    let weg = false, aufgabe = null
    ladePdf(url).then(pdf => pdf.getPage(Math.min(seite, pdf.numPages))).then(p => {
      if (weg) return
      const breite = boxRef.current?.clientWidth || 300
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const vp = p.getViewport({ scale: (breite * dpr) / p.getViewport({ scale: 1 }).width })
      const cvs = canvasRef.current
      cvs.width = vp.width; cvs.height = vp.height
      cvs.style.width = '100%'; cvs.style.height = 'auto'
      aufgabe = p.render({ canvasContext: cvs.getContext('2d'), viewport: vp })
      aufgabe.promise.then(() => !weg && setBereit(true)).catch(() => {})
    }).catch(() => {})
    return () => { weg = true; aufgabe?.cancel() }
  }, [url, seite])

  const r = lokal ?? rect
  const ganzSichtbar = r && r.b >= 0.999 && r.h >= 0.999

  function position(e) {
    const box = boxRef.current.getBoundingClientRect()
    return { x: (e.clientX - box.left) / box.width, y: (e.clientY - box.top) / box.height }
  }
  function schicken(n, sofort) {
    const jetzt = Date.now()
    if (!sofort && jetzt - zuletzt.current < 90) return
    zuletzt.current = jetzt
    befehl({ befehl: 'setzen', l: n.l, t: n.t })
  }
  function setzen(e) {
    if (!r || !zug.current) return
    const p = position(e)
    const n = { ...r, l: Math.min(1 - r.b, Math.max(0, p.x - zug.current.dx)), t: Math.min(1 - r.h, Math.max(0, p.y - zug.current.dy)) }
    setLokal(n)
    schicken(n, e.type === 'pointerup')
  }
  function runter(e) {
    if (!r || ganzSichtbar) return
    const p = position(e)
    const drin = p.x >= r.l && p.x <= r.l + r.b && p.y >= r.t && p.y <= r.t + r.h
    // Tippen außerhalb des Rahmens: Rahmen dorthin mittig setzen
    zug.current = drin ? { dx: p.x - r.l, dy: p.y - r.t } : { dx: r.b / 2, dy: r.h / 2 }
    e.currentTarget.setPointerCapture(e.pointerId)
    setzen(e)
  }
  function hoch(e) {
    if (!zug.current) return
    setzen(e)
    zug.current = null
    setTimeout(() => setLokal(null), 400)
  }

  return (
    <div ref={boxRef} onPointerDown={runter} onPointerMove={setzen} onPointerUp={hoch} onPointerCancel={hoch}
      aria-label={T('nbn_vorschau')} role="img"
      style={{ position: 'relative', alignSelf: 'center', width: '100%', maxWidth: 340, borderRadius: 10, overflow: 'hidden', background: '#FFFFFF', touchAction: 'none', minHeight: bereit ? 0 : 200, cursor: ganzSichtbar ? 'default' : 'grab' }}>
      <canvas ref={canvasRef} style={{ display: 'block' }} />
      {r && !ganzSichtbar && (
        <div aria-hidden="true" style={{
          position: 'absolute', left: `${r.l * 100}%`, top: `${r.t * 100}%`, width: `${r.b * 100}%`, height: `${r.h * 100}%`,
          border: `3px solid ${F.akzent}`, borderRadius: 6, boxShadow: '0 0 0 9999px rgba(0,0,0,0.38)', boxSizing: 'border-box', pointerEvents: 'none',
        }} />
      )}
    </div>
  )
}

const knopf = { minHeight: 48, padding: '0 10px', borderRadius: 14, border: 'none', background: F.linie, color: F.text, fontFamily: 'inherit', fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }
const chip = { minHeight: 40, padding: '0 14px', borderRadius: 20, border: 'none', fontFamily: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize' }
