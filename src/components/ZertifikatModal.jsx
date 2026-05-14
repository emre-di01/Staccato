import { createPortal } from 'react-dom'
import { useApp } from '../context/AppContext'

export default function ZertifikatModal({ schueler, kurs, onClose }) {
  const { schule } = useApp()
  const heute = new Date().toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })

  function drucken() {
    const logoHtml = schule?.logo_url
      ? `<img src="${schule.logo_url}" style="height:48px;object-fit:contain;display:block;margin:0 auto 6px;" />`
      : `<div style="font-size:24px;text-align:center;margin-bottom:6px;">🎵</div>`

    const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <title>Zertifikat</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { height: 100%; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      background: #fff;
      height: calc(297mm - 24mm);
      display: flex;
      align-items: stretch;
    }
    .cert {
      flex: 1;
      border: 2px solid #b8a07a;
      position: relative;
      padding: 10mm 14mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .cert::after {
      content: '';
      position: absolute;
      inset: 4mm;
      border: 1px solid #d4b896;
      pointer-events: none;
    }
    .top { text-align: center; }
    .school-name { font-size: 9pt; color: #64748b; letter-spacing: 0.1em; text-transform: uppercase; margin-top: 3mm; }
    .mid { text-align: center; }
    .verleiht { font-size: 8pt; letter-spacing: 0.15em; text-transform: uppercase; color: #94a3b8; margin-bottom: 2mm; }
    .title { font-size: 24pt; font-weight: 900; color: #1e293b; }
    .an { font-size: 9pt; color: #94a3b8; margin-bottom: 3mm; }
    .name {
      font-size: 18pt;
      font-weight: 700;
      color: #1e293b;
      border-bottom: 2px solid #b8a07a;
      display: inline-block;
      padding-bottom: 2mm;
      min-width: 80mm;
    }
    .kurs-label { font-size: 9pt; color: #64748b; margin: 4mm 0 1mm; }
    .kurs-name { font-size: 13pt; font-weight: 700; color: #1e293b; }
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-top: 1px solid #e2e8f0;
      padding-top: 4mm;
    }
    .sig { text-align: center; }
    .sig-space { height: 10mm; }
    .sig-line {
      border-top: 1px solid #94a3b8;
      padding-top: 2mm;
      font-size: 7pt;
      color: #94a3b8;
      min-width: 50mm;
    }
    .sig-val { font-size: 8pt; color: #475569; margin-top: 1mm; }
  </style>
</head>
<body>
<div class="cert">
  <div class="top">
    ${logoHtml}
    <div class="school-name">${schule?.name ?? 'Musikschule'}</div>
  </div>

  <div class="mid">
    <div class="verleiht">verleiht das</div>
    <div class="title">Teilnahmezertifikat</div>
  </div>

  <div class="mid">
    <div class="an">an</div>
    <div class="name">${schueler?.voller_name ?? ''}</div>
    <div class="kurs-label">für die erfolgreiche Teilnahme am Kurs</div>
    <div class="kurs-name">„${kurs?.name ?? ''}"</div>
  </div>

  <div class="footer">
    <div class="sig">
      <div class="sig-space"></div>
      <div class="sig-line">Datum</div>
      <div class="sig-val">${heute}</div>
    </div>
    <div class="sig">
      <div class="sig-space"></div>
      <div class="sig-line" style="min-width:65mm;">Unterschrift / Stempel</div>
    </div>
  </div>
</div>
<script>
  window.onload = function() {
    window.print();
    window.onafterprint = function() { window.close(); };
  };
<\/script>
</body>
</html>`

    const win = window.open('', '_blank', 'width=820,height=700')
    if (win) { win.document.write(html); win.document.close() }
  }

  return createPortal(
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', width:'100%', maxWidth:560, boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)' }}>

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid var(--border)' }}>
          <span style={{ fontWeight:700, fontSize:15, color:'var(--text)' }}>🎓 Zertifikat erstellen</span>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={drucken} style={{ padding:'8px 18px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg)', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              🖨 Als PDF speichern
            </button>
            <button onClick={onClose} style={{ padding:'8px 12px', borderRadius:'var(--radius)', border:'1px solid var(--border)', background:'transparent', color:'var(--text)', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>✕</button>
          </div>
        </div>

        <div style={{ padding:'20px 24px' }}>
          <div style={{ background:'#f8f6f2', borderRadius:'var(--radius)', border:'1px solid #d4c5a9', padding:'16px 20px', fontSize:13, color:'#475569', lineHeight:1.7 }}>
            <div style={{ fontWeight:700, color:'#1e293b', marginBottom:6 }}>{schueler?.voller_name}</div>
            <div>Kurs: <strong>{kurs?.name}</strong></div>
            <div>Datum: {heute}</div>
            <div>Schule: {schule?.name}</div>
          </div>
          <p style={{ fontSize:12, color:'var(--text-3)', marginTop:12 }}>
            Ein neues Fenster öffnet sich mit dem druckfertigen A4-Zertifikat. Im Browser-Druckdialog „Als PDF speichern" wählen.
          </p>
        </div>
      </div>
    </div>,
    document.body
  )
}
