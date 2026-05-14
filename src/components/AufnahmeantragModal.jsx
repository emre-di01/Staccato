import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../context/AppContext'

function SignaturCanvas({ canvasRef, label }) {
  const [zeichnet, setZeichnet] = useState(false)
  const letzterPunkt = useRef(null)

  function getPos(e, canvas) {
    const r = canvas.getBoundingClientRect()
    const src = e.touches ? e.touches[0] : e
    return {
      x: (src.clientX - r.left) * (canvas.width  / r.width),
      y: (src.clientY - r.top)  * (canvas.height / r.height),
    }
  }

  function start(e) {
    e.preventDefault()
    setZeichnet(true)
    letzterPunkt.current = getPos(e, canvasRef.current)
  }

  function draw(e) {
    e.preventDefault()
    if (!zeichnet) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const pos = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(letzterPunkt.current.x, letzterPunkt.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
    letzterPunkt.current = pos
  }

  function stop() { setZeichnet(false) }

  function loeschen() {
    const canvas = canvasRef.current
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
  }

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>{label}</div>
      <div style={{ border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', background: '#fff', position: 'relative' }}>
        <canvas ref={canvasRef} width={600} height={160}
          style={{ display: 'block', width: '100%', height: 160, cursor: 'crosshair', touchAction: 'none' }}
          onMouseDown={start} onMouseMove={draw} onMouseUp={stop} onMouseLeave={stop}
          onTouchStart={start} onTouchMove={draw} onTouchEnd={stop} />
        <button type="button" onClick={loeschen} style={{
          position: 'absolute', top: 8, right: 10,
          background: 'rgba(255,255,255,0.85)', border: '1px solid #e2e8f0',
          borderRadius: 6, fontSize: 11, color: '#64748b', cursor: 'pointer',
          fontFamily: 'inherit', padding: '3px 8px',
        }}>
          Löschen
        </button>
      </div>
    </div>
  )
}

export default function AufnahmeantragModal({ mitglied, onClose }) {
  const { schule } = useApp()
  const sigMitgliedRef      = useRef(null)
  const sigErziehungRef     = useRef(null)
  const sigVerantwortlichRef = useRef(null)
  const heute = new Date().toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })

  const hatErziehungsberechtigten = !!mitglied.erziehungsberechtigter_name

  const RHYTHMUS_LABEL = {
    monatlich: 'Monatlich', quartalsweise: 'Quartalsweise',
    halbjaehrlich: 'Halbjährlich', jaehrlich: 'Jährlich',
  }
  const WEISE_LABEL = { sepa: 'SEPA-Lastschrift', ueberweisung: 'Überweisung', bar: 'Barzahlung' }

  function drucken() {
    const sigMitglied       = sigMitgliedRef.current?.toDataURL('image/png') ?? ''
    const sigErziehung      = sigErziehungRef.current?.toDataURL('image/png') ?? ''
    const sigVerantwortlich = sigVerantwortlichRef.current?.toDataURL('image/png') ?? ''

    const logoHtml = schule?.logo_url
      ? `<img src="${schule.logo_url}" style="height:48px;object-fit:contain;" />`
      : ''

    const schulInfo = [schule?.adresse, schule?.telefon, schule?.email].filter(Boolean).join(' · ')

    const sepaBlock = mitglied.zahlungsweise === 'sepa' ? `
      <div class="section">
        <div class="section-title">SEPA-Lastschriftmandat</div>
        <p class="small">Ich ermächtige ${schule?.name ?? 'die Musikschule'}, Zahlungen von meinem Konto mittels Lastschrift einzuziehen. Zugleich weise ich mein Kreditinstitut an, die von ${schule?.name ?? 'der Musikschule'} auf mein Konto gezogenen Lastschriften einzulösen.</p>
        <div class="row-3">
          <div class="field"><span class="label">Kontoinhaber</span><span class="val">${mitglied.kontoinhaber || mitglied.voller_name}</span></div>
          <div class="field"><span class="label">IBAN</span><span class="val">${mitglied.iban ?? ''}</span></div>
          <div class="field"><span class="label">BIC</span><span class="val">${mitglied.bic ?? ''}</span></div>
        </div>
      </div>` : ''

    const erziehungBlock = hatErziehungsberechtigten ? `
      <div class="section">
        <div class="section-title">Erziehungsberechtigte/r</div>
        <div class="row-3">
          <div class="field"><span class="label">Name</span><span class="val">${mitglied.erziehungsberechtigter_name ?? ''}</span></div>
          <div class="field"><span class="label">Telefon</span><span class="val">${mitglied.erziehungsberechtigter_telefon ?? ''}</span></div>
          <div class="field"><span class="label">E-Mail</span><span class="val">${mitglied.erziehungsberechtigter_email ?? ''}</span></div>
        </div>
      </div>` : ''

    const sigErziehungBlock = hatErziehungsberechtigten ? `
      <div class="sig-block">
        <div class="sig-label">Unterschrift Erziehungsberechtigte/r</div>
        <img src="${sigErziehung}" class="sig-img" />
        <div class="sig-line">${heute}, ${mitglied.erziehungsberechtigter_name ?? ''}</div>
      </div>` : ''

    const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <title>Aufnahmeantrag – ${mitglied.voller_name}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { font-family: Arial, Helvetica, sans-serif; font-size: 9pt; color: #1e293b; background: #fff; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1e293b; padding-bottom: 5mm; margin-bottom: 5mm; }
    .header-left { display: flex; flex-direction: column; gap: 1mm; }
    .header-title { font-size: 18pt; font-weight: 900; color: #1e293b; }
    .header-school { font-size: 9pt; font-weight: 700; color: #334155; margin-top: 1mm; }
    .header-info { font-size: 7.5pt; color: #64748b; margin-top: 1mm; }
    .section { margin-bottom: 4mm; }
    .section-title { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; border-bottom: 1px solid #e2e8f0; padding-bottom: 1.5mm; margin-bottom: 3mm; }
    .row   { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; margin-bottom: 3mm; }
    .row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 3mm; margin-bottom: 3mm; }
    .row-4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 3mm; margin-bottom: 3mm; }
    .field { display: flex; flex-direction: column; gap: 1mm; }
    .label { font-size: 7pt; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
    .val { font-size: 9pt; border-bottom: 1px solid #cbd5e1; padding-bottom: 1mm; min-height: 5mm; }
    .small { font-size: 7.5pt; color: #475569; line-height: 1.5; margin-bottom: 3mm; }
    .consent { font-size: 7.5pt; color: #475569; line-height: 1.5; border: 1px solid #e2e8f0; padding: 3mm; border-radius: 2mm; margin-bottom: 4mm; }
    .sig-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 5mm; margin-top: 4mm; }
    .sig-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; margin-top: 4mm; }
    .sig-block { display: flex; flex-direction: column; gap: 2mm; }
    .sig-label { font-size: 7pt; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em; }
    .sig-img { width: 100%; height: 20mm; object-fit: contain; border: 1px solid #e2e8f0; background: #f8fafc; }
    .sig-line { font-size: 7pt; color: #64748b; border-top: 1px solid #94a3b8; padding-top: 1mm; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <div class="header-title">Aufnahmeantrag</div>
      <div class="header-school">${schule?.name ?? 'Musikschule'}</div>
      ${schulInfo ? `<div class="header-info">${schulInfo}</div>` : ''}
    </div>
    <div>${logoHtml}</div>
  </div>

  <div class="section">
    <div class="section-title">Persönliche Daten</div>
    <div class="row-3">
      <div class="field"><span class="label">Vor- und Nachname</span><span class="val">${mitglied.voller_name ?? ''}</span></div>
      <div class="field"><span class="label">Geburtsdatum</span><span class="val">${mitglied.geburtsdatum ? new Date(mitglied.geburtsdatum).toLocaleDateString('de-DE') : ''}</span></div>
      <div class="field"><span class="label">Telefon</span><span class="val">${mitglied.telefon ?? ''}</span></div>
    </div>
    <div class="row">
      <div class="field"><span class="label">Adresse</span><span class="val">${mitglied.adresse ?? ''}</span></div>
      <div class="field"><span class="label">E-Mail</span><span class="val">${mitglied.email ?? ''}</span></div>
    </div>
  </div>

  ${erziehungBlock}

  <div class="section">
    <div class="section-title">Mitgliedschaft &amp; Beitrag</div>
    <div class="row-3">
      <div class="field"><span class="label">Mitgliedsbeitrag</span><span class="val">${mitglied.mitgliedsbeitrag ? `${Number(mitglied.mitgliedsbeitrag).toFixed(2)} €` : ''}</span></div>
      <div class="field"><span class="label">Zahlungsrhythmus</span><span class="val">${RHYTHMUS_LABEL[mitglied.zahlungsrhythmus] ?? ''}</span></div>
      <div class="field"><span class="label">Zahlungsweise</span><span class="val">${WEISE_LABEL[mitglied.zahlungsweise] ?? ''}</span></div>
    </div>
  </div>

  ${sepaBlock}

  <div class="consent">
    <strong>Einwilligung Datenschutz:</strong> Ich erkläre mich damit einverstanden, dass meine personenbezogenen Daten zum Zweck der Mitgliederverwaltung und Unterrichtsorganisation gemäß der Datenschutzerklärung von ${schule?.name ?? 'der Musikschule'} elektronisch verarbeitet und gespeichert werden. Die Daten werden nicht an Dritte weitergegeben. Die Einwilligung kann jederzeit widerrufen werden.${schule?.kuendigungsfrist ? ` Eine Kündigung der Mitgliedschaft ist mit einer Frist von ${schule.kuendigungsfrist} möglich.` : ''}
  </div>

  ${hatErziehungsberechtigten ? `
  <div class="sig-grid">
    <div class="sig-block">
      <div class="sig-label">Unterschrift Mitglied / Schüler</div>
      <img src="${sigMitglied}" class="sig-img" />
      <div class="sig-line">${heute}, ${mitglied.voller_name ?? ''}</div>
    </div>
    ${sigErziehungBlock}
    <div class="sig-block">
      <div class="sig-label">Unterschrift Verantwortliche/r</div>
      <img src="${sigVerantwortlich}" class="sig-img" />
      <div class="sig-line">${heute}, ${schule?.name ?? ''}</div>
    </div>
  </div>` : `
  <div class="sig-grid-2">
    <div class="sig-block">
      <div class="sig-label">Unterschrift Mitglied / Schüler</div>
      <img src="${sigMitglied}" class="sig-img" />
      <div class="sig-line">${heute}, ${mitglied.voller_name ?? ''}</div>
    </div>
    <div class="sig-block">
      <div class="sig-label">Unterschrift Verantwortliche/r</div>
      <img src="${sigVerantwortlich}" class="sig-img" />
      <div class="sig-line">${heute}, ${schule?.name ?? ''}</div>
    </div>
  </div>`}

  <script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};};<\/script>
</body>
</html>`

    const win = window.open('', '_blank', 'width=820,height=900')
    if (win) { win.document.write(html); win.document.close() }
  }

  return createPortal(
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', width:'100%', maxWidth:600, maxHeight:'92vh', display:'flex', flexDirection:'column', boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)' }}>

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          <span style={{ fontWeight:700, fontSize:15, color:'var(--text)' }}>📋 Aufnahmeantrag</span>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={drucken} style={{ padding:'8px 18px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg)', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              🖨 Als PDF speichern
            </button>
            <button onClick={onClose} style={{ padding:'8px 12px', borderRadius:'var(--radius)', border:'1px solid var(--border)', background:'transparent', color:'var(--text)', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>✕</button>
          </div>
        </div>

        <div style={{ overflowY:'auto', padding:'20px 24px', display:'flex', flexDirection:'column', gap:20 }}>

          {/* Datenvorschau */}
          <div style={{ background:'var(--bg)', borderRadius:'var(--radius)', padding:'12px 16px', fontSize:13, color:'var(--text-2)', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px 20px' }}>
            <div><span style={{ color:'var(--text-3)' }}>Name: </span>{mitglied.voller_name}</div>
            <div><span style={{ color:'var(--text-3)' }}>Geburtsdatum: </span>{mitglied.geburtsdatum ? new Date(mitglied.geburtsdatum).toLocaleDateString('de-DE') : '–'}</div>
            <div><span style={{ color:'var(--text-3)' }}>Telefon: </span>{mitglied.telefon || '–'}</div>
            <div><span style={{ color:'var(--text-3)' }}>E-Mail: </span>{mitglied.email || '–'}</div>
            <div style={{ gridColumn:'1/-1' }}><span style={{ color:'var(--text-3)' }}>Adresse: </span>{mitglied.adresse || '–'}</div>
            <div><span style={{ color:'var(--text-3)' }}>Beitrag: </span>{mitglied.mitgliedsbeitrag ? `${Number(mitglied.mitgliedsbeitrag).toFixed(2)} €` : '–'}</div>
            <div><span style={{ color:'var(--text-3)' }}>Zahlung: </span>{WEISE_LABEL[mitglied.zahlungsweise] ?? '–'}</div>
            {mitglied.zahlungsweise === 'sepa' && <div style={{ gridColumn:'1/-1' }}><span style={{ color:'var(--text-3)' }}>IBAN: </span>{mitglied.iban ?? '–'}</div>}
          </div>

          {/* Unterschrift Mitglied */}
          <SignaturCanvas canvasRef={sigMitgliedRef} label="Unterschrift Mitglied / Schüler" />

          {/* Unterschrift Erziehungsberechtigte */}
          {hatErziehungsberechtigten && (
            <SignaturCanvas canvasRef={sigErziehungRef}
              label={`Unterschrift Erziehungsberechtigte/r (${mitglied.erziehungsberechtigter_name})`} />
          )}

          {/* Unterschrift Verantwortliche/r */}
          <SignaturCanvas canvasRef={sigVerantwortlichRef} label="Unterschrift Verantwortliche/r (Schule)" />

          <p style={{ fontSize:12, color:'var(--text-3)', marginTop:-4 }}>
            Mit Maus oder Finger unterschreiben, dann „Als PDF speichern" klicken.
          </p>
        </div>
      </div>
    </div>,
    document.body
  )
}
