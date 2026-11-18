import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import QRCode from 'qrcode'
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, DoorOpen, QrCode, Download, RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { Seite, Chips, Gruppe, Trenner, Zeile, Knopf, Leer, Laden, Blatt, Feld, SchalterZeile, eingabeStil } from '../../ui'
import { useNeuLaden } from '../daten'
import { schulZeitZuIso, tagKey, uhrzeit, plusTage, montagVon, kalenderFormat } from '../zeit'
import { useBreit, ListeDetail, DetailTitel, DetailGruppe, Info } from './ListeDetail'
import { raumQrInhalt } from '../einchecken'
import { schulfarbenTokens } from '../schulfarbe'

export const FARBEN = ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#14b8a6']

function useRaeume() {
  const { schule } = useApp()
  return useQuery({
    queryKey: ['na-raeume', schule?.id],
    enabled: !!schule?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('raeume').select('*').eq('schule_id', schule.id).order('name')
      if (error) throw error
      return data ?? []
    },
  })
}

// Stunden und Veranstaltungen eines Raums in einer Woche
function useBelegung(raumId, montag) {
  const { zeitzone } = useApp()
  return useQuery({
    queryKey: ['na-raum-belegung', raumId, montag],
    enabled: !!raumId,
    queryFn: async () => {
      const von = schulZeitZuIso(montag, '00:00', zeitzone)
      const bis = schulZeitZuIso(plusTage(montag, 7), '00:00', zeitzone)
      const [st, ev] = await Promise.all([
        supabase.from('stunden').select('id, beginn, ende, status, unterricht(name)')
          .eq('raum_id', raumId).neq('status', 'abgesagt').gte('beginn', von).lt('beginn', bis).order('beginn'),
        supabase.from('events').select('id, titel, beginn, ende').eq('raum_id', raumId).gte('beginn', von).lt('beginn', bis).order('beginn'),
      ])
      return [
        ...(st.data ?? []).map(s => ({ id: s.id, titel: s.unterricht?.name, beginn: s.beginn, ende: s.ende })),
        ...(ev.data ?? []).map(e => ({ id: 'e' + e.id, titel: e.titel, beginn: e.beginn, ende: e.ende, event: true })),
      ].sort((a, b) => new Date(a.beginn) - new Date(b.beginn))
    },
  })
}

function Farbpunkt({ farbe, groesse = 14 }) {
  return <span aria-hidden="true" style={{ width: groesse, height: groesse, borderRadius: groesse / 2, background: farbe ?? FARBEN[0], flexShrink: 0, display: 'inline-block' }} />
}

function Belegung({ raum }) {
  const { T, lang, zeitzone } = useApp()
  const heute = tagKey(new Date().toISOString(), zeitzone)
  const [montag, setMontag] = useState(() => montagVon(heute))
  const { data = [], isLoading } = useBelegung(raum.id, montag)
  const tage = Array.from({ length: 7 }, (_, i) => plusTage(montag, i))
  const belegt = tage.map(t => [t, data.filter(e => tagKey(e.beginn, zeitzone) === t)]).filter(([, l]) => l.length)
  const pfeil = { width: 44, height: 44, borderRadius: 22, border: 'none', background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }

  return (
    <>
      <DetailTitel>{T('nv_belegung')}</DetailTitel>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <button onClick={() => setMontag(m => plusTage(m, -7))} aria-label={T('nl_woche_vorher')} style={pfeil}><ChevronLeft aria-hidden="true" size={22} /></button>
        <div aria-live="polite" style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: 700 }}>
          {kalenderFormat(montag, lang, { day: 'numeric', month: 'short' })} – {kalenderFormat(plusTage(montag, 6), lang, { day: 'numeric', month: 'short' })}
        </div>
        <button onClick={() => setMontag(m => plusTage(m, 7))} aria-label={T('nl_woche_nachher')} style={pfeil}><ChevronRight aria-hidden="true" size={22} /></button>
      </div>
      {isLoading ? <Laden hoehe={120} /> : belegt.length === 0 ? (
        <div style={{ fontSize: 16, color: 'var(--text-2)' }}>{T('nv_raum_frei')}</div>
      ) : belegt.map(([t, liste]) => (
        <div key={t} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700, margin: '0 0 6px', color: t === heute ? 'var(--primary)' : 'var(--text-2)' }}>
            {kalenderFormat(t, lang, { weekday: 'long', day: 'numeric', month: 'short' })}
          </div>
          <DetailGruppe>
            {liste.map((e, i) => (
              <div key={e.id}>
                {i > 0 && <Trenner />}
                <div style={{ padding: '10px 16px', display: 'flex', gap: 12, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: e.event ? '#2563EB' : 'var(--text)' }}>
                    {uhrzeit(e.beginn, zeitzone, lang)}{e.ende ? `–${uhrzeit(e.ende, zeitzone, lang)}` : ''}
                  </span>
                  <span style={{ fontSize: 16, overflowWrap: 'anywhere' }}>{e.titel}</span>
                </div>
              </div>
            ))}
          </DetailGruppe>
        </div>
      ))}
    </>
  )
}

function Detail({ raum, onBearbeiten, onLoeschen, onQr }) {
  const { T } = useApp()
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span aria-hidden="true" style={{ width: 64, height: 64, borderRadius: 18, background: raum.farbe ?? FARBEN[0], color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <DoorOpen size={30} />
        </span>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, overflowWrap: 'anywhere' }}>{raum.name}</h2>
          <div style={{ fontSize: 16, color: 'var(--text-2)' }}>
            {T('nv_personen_max').replace('{n}', raum.kapazitaet ?? 1)}
            {!raum.aktiv && <span style={{ color: 'var(--danger)', fontWeight: 600 }}> · {T('inactive')}</span>}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Knopf icon={Pencil} onClick={onBearbeiten} style={{ flex: '1 1 140px' }}>{T('edit')}</Knopf>
      </div>
      {(raum.ausstattung?.length > 0 || raum.notizen) && <>
        <DetailTitel>{T('nv_details')}</DetailTitel>
        <DetailGruppe>
          <Info label={T('nv_ausstattung')}>{raum.ausstattung?.join(', ')}</Info>
          {raum.ausstattung?.length > 0 && raum.notizen && <Trenner />}
          <Info label={T('notes')}>{raum.notizen}</Info>
        </DetailGruppe>
      </>}
      <DetailTitel>{T('ci_raum_titel')}</DetailTitel>
      <div style={{ fontSize: 16, lineHeight: 1.45, color: 'var(--text-2)', marginBottom: 10 }}>{T('ci_raum_hinweis')}</div>
      <Knopf variante="sekundaer" icon={QrCode} onClick={onQr}>{T('ci_qr_anzeigen')}</Knopf>
      <Belegung raum={raum} />
      <div style={{ marginTop: 24 }}>
        <Knopf voll variante="gefahr" icon={Trash2} onClick={onLoeschen}>{T('nv_raum_loeschen')}</Knopf>
      </div>
    </div>
  )
}

// Fester Einchecken-Code des Raums: anzeigen, als PDF zum Aushängen, neu erzeugen
function RaumQrBlatt({ raum, onClose }) {
  const { T, schule, toast, confirm } = useApp()
  const [erneuert, setErneuert] = useState(false)
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['na-raum-checkin', raum.id],
    gcTime: 0,
    queryFn: async () => {
      const { data: token, error } = await supabase.rpc('raum_checkin_token', { p_raum_id: raum.id, p_neu: false })
      if (error) throw error
      return { token, bild: await QRCode.toDataURL(raumQrInhalt(token), { width: 640, margin: 1 }) }
    },
  })
  const laedt = isLoading || erneuert
  const bild = data?.bild

  async function neuErzeugen() {
    if (!await confirm(T('ci_neu_frage'), { sub: T('ci_neu_hinweis'), confirmLabel: T('ci_neu_erzeugen') })) return
    setErneuert(true)
    const { error } = await supabase.rpc('raum_checkin_token', { p_raum_id: raum.id, p_neu: true })
    if (!error) await refetch()
    setErneuert(false)
    toast(error ? error.message : T('ci_neu_erzeugt'), error ? 'error' : 'success')
  }

  // A4-Aushang als Bild zeichnen (Canvas kann alle Schriftzeichen, auch ş/ğ/ı) und in ein PDF legen
  async function pdf() {
    let cvs
    try { cvs = await zeichneAushang({ schule, raum, token: data.token, T }) } catch (e) { toast(e?.message ?? String(e), 'error'); return }
    const { default: jsPDF } = await import('jspdf')
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    doc.addImage(cvs.toDataURL('image/png'), 'PNG', 0, 0, 210, 297)
    const url = URL.createObjectURL(doc.output('blob'))
    const a = document.createElement('a'); a.href = url
    a.download = `einchecken_${raum.name.replace(/[^a-z0-9]/gi, '_')}.pdf`; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <Blatt titel={`${T('ci_raum_titel')} · ${raum.name}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ alignSelf: 'center', width: 'min(280px, 100%)', aspectRatio: '1', borderRadius: 18, background: '#FFFFFF', padding: 12, boxSizing: 'border-box' }}>
          {isError ? <div role="alert" style={{ height: '100%', display: 'flex', alignItems: 'center', textAlign: 'center', color: '#B91C1C', fontSize: 16 }}>{T('ci_fehler')}</div> : bild && !laedt ? <img src={bild} alt={`${T('ci_raum_titel')}: ${raum.name}`} style={{ width: '100%', height: '100%', display: 'block' }} /> : <Laden hoehe={250} />}
        </div>
        <div style={{ fontSize: 16, lineHeight: 1.45, color: 'var(--text-2)', textAlign: 'center' }}>{T('ci_raum_hinweis')}</div>
        <Knopf voll icon={Download} onClick={pdf} disabled={!data || laedt}>{T('ci_pdf')}</Knopf>
        <Knopf voll variante="sekundaer" icon={RefreshCw} onClick={neuErzeugen} disabled={laedt}>{T('ci_neu_erzeugen')}</Knopf>
      </div>
    </Blatt>
  )
}

function bildLaden(src, cors) {
  return new Promise((ok, err) => {
    const i = new Image()
    if (cors) i.crossOrigin = 'anonymous'
    i.onload = () => ok(i); i.onerror = err; i.src = src
  })
}

// Größte Schrift (bis max), mit der der Text in die Breite passt
function passend(ctx, text, max, min, breite, gewicht) {
  let g = max
  do { ctx.font = `${gewicht} ${g}px Inter, system-ui, sans-serif`; g -= 2 } while (g > min && ctx.measureText(text).width > breite)
}

// A4-Aushang (150 dpi) in Schulfarbe: Kopf mit Logo + Schulname, Raum-Pill in Raumfarbe, QR-Karte, 3 Schritte
async function zeichneAushang({ schule, raum, token, T }) {
  const B = 1240, H = 1754, M = B / 2
  const f = schulfarbenTokens(schule?.farbe, false) ?? { '--n-hero': '#C2410C', '--n-hero-2': '#A3360A', '--n-hero-sub': '#FFE4D6', '--n-tint': '#FFEDD5', '--n-tint-fg': '#9A3412' }
  const akzent = f['--n-hero'], akzent2 = f['--n-hero-2'], sub = f['--n-hero-sub'], tint = f['--n-tint'], tintFg = f['--n-tint-fg']
  const TEXT = '#111114', TEXT3 = '#8E8E96'

  try { await document.fonts?.ready } catch { /* egal */ }
  const [qr, logo] = await Promise.all([
    QRCode.toDataURL(raumQrInhalt(token), { width: 1200, margin: 0, color: { dark: '#111114', light: '#FFFFFF' } }).then(u => bildLaden(u)),
    schule?.logo_url ? bildLaden(schule.logo_url, true).catch(() => null) : null,
  ])

  const cvs = document.createElement('canvas'); cvs.width = B; cvs.height = H
  const ctx = cvs.getContext('2d')
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, B, H)

  // Kopf: Verlauf in Schulfarbe mit geschwungener Unterkante + dezente Kreise
  const KOPF = 540
  ctx.save()
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(B, 0); ctx.lineTo(B, KOPF - 60)
  ctx.quadraticCurveTo(M, KOPF + 60, 0, KOPF - 60); ctx.closePath()
  const vl = ctx.createLinearGradient(0, 0, B, KOPF)
  vl.addColorStop(0, akzent); vl.addColorStop(1, akzent2)
  ctx.fillStyle = vl; ctx.fill(); ctx.clip()
  ctx.fillStyle = 'rgba(255,255,255,0.07)'
  ctx.beginPath(); ctx.arc(B - 80, 60, 260, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(60, KOPF - 40, 200, 0, Math.PI * 2); ctx.fill()
  ctx.restore()

  // Logo-Kachel (weiß, damit jedes Logo lesbar ist); ohne Logo: Anfangsbuchstabe
  const L = 150, ly = 56
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.18)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 8
  ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.roundRect(M - L / 2, ly, L, L, 38); ctx.fill()
  ctx.restore()
  if (logo) {
    const p = 20, max = L - 2 * p, s = Math.min(max / logo.width, max / logo.height)
    const w = logo.width * s, h = logo.height * s
    ctx.drawImage(logo, M - w / 2, ly + (L - h) / 2, w, h)
  } else {
    ctx.fillStyle = akzent; ctx.font = '800 96px Inter, system-ui, sans-serif'; ctx.textBaseline = 'middle'
    ctx.fillText((schule?.name ?? 'S').trim().charAt(0).toUpperCase(), M, ly + L / 2 + 4)
    ctx.textBaseline = 'alphabetic'
  }

  ctx.fillStyle = sub; passend(ctx, schule?.name ?? 'Staccato', 46, 28, B - 200, 600)
  ctx.fillText(schule?.name ?? 'Staccato', M, ly + L + 66)
  ctx.fillStyle = '#FFFFFF'; passend(ctx, T('ci_einchecken'), 132, 72, B - 160, 800)
  ctx.fillText(T('ci_einchecken'), M, ly + L + 200)

  // Raum-Pill über der Kante, Punkt in Raumfarbe
  ctx.font = '700 56px Inter, system-ui, sans-serif'
  passend(ctx, raum.name, 56, 30, B - 360, 700)
  const nameB = ctx.measureText(raum.name).width, PH = 108, PB = nameB + 160, py = KOPF - 16
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.16)'; ctx.shadowBlur = 36; ctx.shadowOffsetY = 10
  ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.roundRect(M - PB / 2, py - PH / 2, PB, PH, PH / 2); ctx.fill()
  ctx.restore()
  ctx.fillStyle = raum.farbe ?? FARBEN[0]; ctx.beginPath(); ctx.arc(M - PB / 2 + 62, py, 18, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = TEXT; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'
  ctx.fillText(raum.name, M - PB / 2 + 104, py + 2)
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'

  // QR-Karte mit Eckwinkeln in Akzentfarbe
  const K = 640, kx = M - K / 2, ky = 630
  ctx.fillStyle = tint; ctx.beginPath(); ctx.roundRect(kx - 14, ky - 14, K + 28, K + 28, 60); ctx.fill()
  ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.roundRect(kx, ky, K, K, 48); ctx.fill()
  const Q = 500; ctx.drawImage(qr, M - Q / 2, ky + (K - Q) / 2, Q, Q)
  ctx.strokeStyle = akzent; ctx.lineWidth = 14; ctx.lineCap = 'round'
  const e = 70, o = 34
  for (const [x, y, dx, dy] of [[kx + o, ky + o, 1, 1], [kx + K - o, ky + o, -1, 1], [kx + o, ky + K - o, 1, -1], [kx + K - o, ky + K - o, -1, -1]]) {
    ctx.beginPath(); ctx.moveTo(x, y + dy * e); ctx.lineTo(x, y); ctx.lineTo(x + dx * e, y); ctx.stroke()
  }

  // Drei Schritte
  const schritte = [T('ci_pdf_schritt1'), T('ci_pdf_schritt2'), T('ci_pdf_schritt3')]
  const sy = ky + K + 90, spalte = (B - 160) / 3
  let maxZeilen = 1
  schritte.forEach((txt, i) => {
    const cx = 80 + spalte * i + spalte / 2
    ctx.fillStyle = akzent; ctx.beginPath(); ctx.arc(cx, sy, 40, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#FFFFFF'; ctx.font = '800 44px Inter, system-ui, sans-serif'; ctx.textBaseline = 'middle'
    ctx.fillText(String(i + 1), cx, sy + 2); ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = TEXT; ctx.font = '600 32px Inter, system-ui, sans-serif'
    const zl = zeilen(ctx, txt, spalte - 16).slice(0, 3); maxZeilen = Math.max(maxZeilen, zl.length)
    zl.forEach((z, j) => ctx.fillText(z, cx, sy + 92 + j * 40))
  })

  // Zeitfenster-Hinweis als getönte Box
  ctx.font = '500 30px Inter, system-ui, sans-serif'
  const zz = zeilen(ctx, T('ci_pdf_zeitfenster'), B - 320), zy = sy + 92 + maxZeilen * 40 + 10, zh = 40 + zz.length * 40
  ctx.fillStyle = tint; ctx.beginPath(); ctx.roundRect(120, zy, B - 240, zh, 28); ctx.fill()
  ctx.fillStyle = tintFg; ctx.textBaseline = 'middle'
  zz.forEach((z, i) => ctx.fillText(z, M, zy + 20 + 20 + i * 40))
  ctx.textBaseline = 'alphabetic'

  // Fuß: Kontakt der Schule + Staccato
  const fuss = [schule?.website, schule?.adresse, 'Staccato'].filter(Boolean).join('  ·  ')
  ctx.strokeStyle = '#E5E5EA'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(120, H - 86); ctx.lineTo(B - 120, H - 86); ctx.stroke()
  ctx.fillStyle = TEXT3; passend(ctx, fuss, 24, 16, B - 240, 500); ctx.fillText(fuss, M, H - 42)
  return cvs
}

function zeilen(ctx, text, breite) {
  const out = []; let z = ''
  for (const w of text.split(' ')) {
    const t = z ? `${z} ${w}` : w
    if (ctx.measureText(t).width > breite && z) { out.push(z); z = w } else z = t
  }
  if (z) out.push(z)
  return out
}

function RaumBlatt({ raum, onClose, onFertig }) {
  const { T, schule, toast } = useApp()
  const istNeu = !raum?.id
  const [form, setForm] = useState({
    name: raum?.name ?? '', kapazitaet: raum?.kapazitaet ?? 1, ausstattung: raum?.ausstattung?.join(', ') ?? '',
    farbe: raum?.farbe ?? FARBEN[0], notizen: raum?.notizen ?? '', aktiv: raum?.aktiv ?? true,
  })
  const [sendet, setSendet] = useState(false)
  const setze = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function speichern() {
    if (!form.name.trim()) { toast(T('nv_name_pflicht'), 'error'); return }
    setSendet(true)
    const daten = {
      name: form.name.trim(), kapazitaet: parseInt(form.kapazitaet) || 1, farbe: form.farbe, notizen: form.notizen.trim() || null, aktiv: form.aktiv,
      ausstattung: form.ausstattung.split(',').map(x => x.trim()).filter(Boolean),
    }
    const { error } = istNeu
      ? await supabase.from('raeume').insert({ ...daten, schule_id: schule.id })
      : await supabase.from('raeume').update(daten).eq('id', raum.id)
    setSendet(false)
    if (error) { toast(error.message, 'error'); return }
    toast(T('nl_gespeichert'), 'success')
    onFertig()
  }

  return (
    <Blatt titel={istNeu ? T('nv_neuer_raum') : raum.name} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Feld label={T('name')}>
          <input value={form.name} onChange={e => setze('name', e.target.value)} placeholder={T('nv_raum_beispiel')} style={eingabeStil} />
        </Feld>
        <Feld label={T('nv_kapazitaet')}>
          <input type="number" inputMode="numeric" min={1} value={form.kapazitaet} onChange={e => setze('kapazitaet', e.target.value)} style={eingabeStil} />
        </Feld>
        <Feld label={T('nv_ausstattung')} hinweis={T('nv_ausstattung_hinweis')}>
          <input value={form.ausstattung} onChange={e => setze('ausstattung', e.target.value)} style={eingabeStil} />
        </Feld>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{T('nv_farbe')}</div>
          <div role="radiogroup" aria-label={T('nv_farbe')} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {FARBEN.map(f => (
              <button key={f} role="radio" aria-checked={form.farbe === f} aria-label={f} onClick={() => setze('farbe', f)}
                style={{ width: 44, height: 44, borderRadius: 22, background: f, cursor: 'pointer', border: `3px solid ${form.farbe === f ? 'var(--text)' : 'transparent'}` }} />
            ))}
          </div>
        </div>
        <Feld label={T('notes')}>
          <textarea rows={3} value={form.notizen} onChange={e => setze('notizen', e.target.value)} style={{ ...eingabeStil, resize: 'vertical' }} />
        </Feld>
        {!istNeu && (
          <Gruppe style={{ margin: 0 }}>
            <SchalterZeile titel={T('active')} untertitel={T('nv_raum_aktiv_hinweis')} an={form.aktiv} onChange={v => setze('aktiv', v)} />
          </Gruppe>
        )}
        <Knopf voll onClick={speichern} disabled={sendet}>{istNeu ? T('nv_raum_anlegen') : T('save')}</Knopf>
      </div>
    </Blatt>
  )
}

export default function AdminRaeume() {
  const { T, toast, confirm } = useApp()
  const breit = useBreit()
  const neuLaden = useNeuLaden()
  const { data: raeume = [], isLoading } = useRaeume()
  const [filter, setFilter] = useState('aktiv')
  const [gewaehltId, setGewaehltId] = useState(null)
  const [blatt, setBlatt] = useState(null)   // null | 'neu' | raum
  const [qrRaum, setQrRaum] = useState(null)

  const liste = raeume.filter(r => filter === 'alle' || (filter === 'aktiv') === !!r.aktiv)
  const gewaehlt = raeume.find(r => r.id === gewaehltId) ?? (breit ? liste[0] : null)
  const aktualisieren = () => neuLaden('na-raeume', 'na-raum-belegung', 'nl-kurs-optionen')

  async function loeschen(raum) {
    if (!await confirm(T('nv_loeschen_frage').replace('{name}', raum.name), { confirmLabel: T('delete') })) return
    const { error } = await supabase.from('raeume').delete().eq('id', raum.id)
    if (error) { toast(T('nv_raum_loeschen_fehler'), 'error'); return }
    setGewaehltId(null)
    aktualisieren()
  }

  return (
    <Seite breit titel={T('rooms')} rechts={<Knopf klein variante="tint" icon={Plus} onClick={() => setBlatt('neu')}>{T('nv_neu')}</Knopf>}>
      <ListeDetail breit={breit} detailLabel={gewaehlt?.name} blattTitel={T('rooms')}
        onSchliessen={() => setGewaehltId(null)} blattVerstecken={!!blatt || !!qrRaum}
        detail={gewaehlt && <Detail key={gewaehlt.id} raum={gewaehlt} onBearbeiten={() => setBlatt(gewaehlt)} onLoeschen={() => loeschen(gewaehlt)} onQr={() => setQrRaum(gewaehlt)} />}
        liste={<>
          <Chips label={T('status')} optionen={[['aktiv', T('active')], ['inaktiv', T('inactive')], ['alle', T('n_alle')]]} wert={filter} onChange={setFilter} />
          <div style={{ marginTop: 16 }}>
            {isLoading ? <Laden hoehe={240} /> : liste.length === 0 ? <Leer text={T('nv_keine_raeume')} /> : (
              <Gruppe>
                {liste.map((r, i) => (
                  <div key={r.id} style={{ background: breit && gewaehlt?.id === r.id ? 'var(--n-tint)' : undefined }}>
                    {i > 0 && <Trenner />}
                    <Zeile bild={<Farbpunkt farbe={r.farbe} />} titel={r.name} chevron={!breit}
                      untertitel={[T('nv_personen_max').replace('{n}', r.kapazitaet ?? 1), r.ausstattung?.join(', ')].filter(Boolean).join(' · ')}
                      wert={r.aktiv ? null : T('inactive')} onClick={() => setGewaehltId(r.id)} />
                  </div>
                ))}
              </Gruppe>
            )}
          </div>
        </>} />

      {qrRaum && <RaumQrBlatt raum={qrRaum} onClose={() => setQrRaum(null)} />}
      {blatt && <RaumBlatt raum={blatt === 'neu' ? null : blatt} onClose={() => setBlatt(null)} onFertig={() => { setBlatt(null); aktualisieren() }} />}
    </Seite>
  )
}
