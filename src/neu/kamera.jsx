import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import jsQR from 'jsqr'
import { X } from 'lucide-react'
import { useApp } from '../context/AppContext'

// ─── Kamera-Scan (QR/Barcode) ─────────────────────────────────
// Startet die Rückkamera und meldet den ersten erkannten Code; ohne BarcodeDetector per jsQR (nur QR).
// `dauerhaft`: Kamera läuft weiter und meldet jeden erkannten Code (Aufrufer filtert Wiederholungen).
const JSQR_KANTE = 960   // jsQR erkennt sehr große Bilder schlecht und langsam
export function useKameraScan(onErkannt, formate, { dauerhaft = false } = {}) {
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
    let hatNativ = typeof BarcodeDetector !== 'undefined'
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
            const faktor = Math.min(1, JSQR_KANTE / Math.max(vid.videoWidth, vid.videoHeight, 1))
            const w = Math.round(vid.videoWidth * faktor), h = Math.round(vid.videoHeight * faktor)
            if (w && h) {
              cvs.width = w; cvs.height = h
              const ctx = cvs.getContext('2d')
              ctx.drawImage(vid, 0, 0, w, h)
              const res = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' })
              if (res) erkannt = res.data
            }
          }
        } catch {
          // einzelnes Bild nicht lesbar – weiter; meldet der Browser-Leser Fehler, QR-Codes künftig per jsQR
          if (formate.includes('qr_code')) hatNativ = false
        }
        if (erkannt && aktiv.current) {
          if (!dauerhaft) { stop(); meldenRef.current(erkannt); return }
          meldenRef.current(erkannt)
        }
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
  }, [formate, dauerhaft, stop, T])

  useEffect(() => {
    aktiv.current = true
    start()
    return () => { aktiv.current = false; stop() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { videoRef, canvasRef, fehler, start, stop }
}

// Vollbild mit Kamerabild und Sucher-Rahmen (dunkel, unabhängig vom Farbmodus)
export function KameraVollbild({ titel, hinweis, rahmen, onClose, videoRef, canvasRef, fehler, zeigeKamera = true, children, unten }) {
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
