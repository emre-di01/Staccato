import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import Modal from '../../components/Modal'

// ─── Responsive ───────────────────────────────────────────────────────────────
function useIsMobile() {
  const [v, setV] = useState(window.innerWidth < 640)
  useEffect(() => {
    const fn = () => setV(window.innerWidth < 640)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return v
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtD  = str => str
  ? new Date(str + 'T00:00:00').toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric' })
  : '–'
const fmtTs = ts => ts
  ? new Date(ts).toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric' })
  : '–'
const fmtE  = v => Number(v || 0).toLocaleString('de-DE', { minimumFractionDigits:2, maximumFractionDigits:2 }) + ' €'

function calcTotals(positionen, steuersatz) {
  const netto = (positionen || []).reduce((s, p) => s + (Number(p.menge) || 0) * (Number(p.einzelpreis) || 0), 0)
  const mwst  = netto * (Number(steuersatz) || 0) / 100
  return { netto, mwst, brutto: netto + mwst }
}

function empfName(r) {
  return r.empfaenger_snapshot?.name ?? r.empfaenger_name ?? '–'
}

// ─── PDF §14 UStG ─────────────────────────────────────────────────────────────
function druckeRechnung(r, schule) {
  const snap = r.schule_snapshot ?? {}
  const empf = r.empfaenger_snapshot ?? {}

  const schuleName  = snap.name         ?? schule?.name         ?? ''
  const schuleAdr   = snap.adresse      ?? schule?.adresse      ?? ''
  const schuleEmail = snap.email        ?? schule?.email        ?? ''
  const schuleTel   = snap.telefon      ?? schule?.telefon      ?? ''
  const steuernr    = snap.steuernummer ?? schule?.steuernummer ?? ''
  const ustid       = snap.ustid        ?? schule?.ustid        ?? ''
  const logoUrl     = snap.logo_url     ?? schule?.logo_url     ?? ''
  const steuerHweis = r.steuer_hinweis_snapshot ?? snap.steuer_hinweis ?? schule?.steuer_hinweis ?? ''
  const rechtsform  = snap.rechtsform   ?? schule?.rechtsform   ?? ''
  const vereinsNr   = snap.vereinsreg_nr      ?? schule?.vereinsreg_nr      ?? ''
  const vereinsGer  = snap.vereinsreg_gericht ?? schule?.vereinsreg_gericht ?? ''
  const RF = { gbr:'GbR', ev:'e.V.', ggmbh:'gGmbH', gmbh:'GmbH', ug:'UG (haftungsbeschränkt)' }

  const eN = empf.name    ?? r.empfaenger_name    ?? ''
  const eA = empf.adresse ?? r.empfaenger_adresse ?? ''

  const steuersatz = Number(r.steuersatz ?? 0)
  const pos        = r.positionen ?? []
  const { netto, mwst, brutto } = calcTotals(pos, steuersatz)

  const rows = pos.map(p => {
    const g = (Number(p.menge)||0) * (Number(p.einzelpreis)||0)
    return `<tr>
      <td style="padding:3mm 4mm 3mm 0;border-bottom:.5px solid #e2e8f0">${p.beschreibung??''}</td>
      <td style="text-align:center;padding:3mm;border-bottom:.5px solid #e2e8f0">${p.menge}</td>
      <td style="text-align:right;padding:3mm;border-bottom:.5px solid #e2e8f0">${Number(p.einzelpreis||0).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})} €</td>
      <td style="text-align:right;padding:3mm 0 3mm 4mm;border-bottom:.5px solid #e2e8f0">${g.toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})} €</td>
    </tr>`
  }).join('')

  const summe = steuersatz > 0 ? `
    <tr><td colspan="3" style="text-align:right;padding:2mm 4mm 2mm 0;font-size:9pt;color:#475569">Nettobetrag</td>
        <td style="text-align:right;padding:2mm 0">${netto.toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})} €</td></tr>
    <tr><td colspan="3" style="text-align:right;padding:2mm 4mm 2mm 0;font-size:9pt;color:#475569">zzgl. ${steuersatz} % MwSt.</td>
        <td style="text-align:right;padding:2mm 0">${mwst.toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})} €</td></tr>
    <tr style="font-weight:700;border-top:2px solid #1e293b">
        <td colspan="3" style="text-align:right;padding:3mm 4mm 0 0">Gesamtbetrag</td>
        <td style="text-align:right;padding:3mm 0 0">${brutto.toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})} €</td></tr>`
  : `<tr style="font-weight:700;border-top:2px solid #1e293b">
        <td colspan="3" style="text-align:right;padding:3mm 4mm 0 0">Gesamtbetrag</td>
        <td style="text-align:right;padding:3mm 0 0">${brutto.toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})} €</td></tr>`

  // §14 Abs. 4 Nr. 2 UStG: Steuernummer oder USt-IdNr. zwingend erforderlich
  if (!steuernr && !ustid) {
    const weiter = window.confirm(
      '⚠️ Hinweis: In den Schuleinstellungen ist weder eine Steuernummer noch eine USt-IdNr. hinterlegt.\n\n' +
      'Ohne diese Angabe ist die Rechnung nach §14 Abs. 4 Nr. 2 UStG nicht rechtsgültig.\n\n' +
      'Trotzdem drucken?'
    )
    if (!weiter) return
  }

  const fussTeile = []
  if (steuerHweis) fussTeile.push(steuerHweis)
  else if (steuersatz === 0) fussTeile.push('Gemäß §4 Nr. 21 UStG umsatzsteuerfrei.')
  const steuerZeile = [steuernr && `Steuernummer: ${steuernr}`, ustid && `USt-IdNr.: ${ustid}`].filter(Boolean).join(' · ')
  if (steuerZeile) fussTeile.push(steuerZeile)
  if (RF[rechtsform] && vereinsNr && vereinsGer) fussTeile.push(`${RF[rechtsform]} · ${vereinsNr} · ${vereinsGer}`)

  const html = `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">
  <title>Rechnung ${r.rechnungsnummer??''}</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;font-size:10pt;color:#1e293b;padding:18mm 20mm}
  @media print{body{padding:0}@page{margin:18mm 20mm}}table{border-collapse:collapse;width:100%}</style>
  </head><body>

  <table style="width:100%;margin-bottom:12mm"><tr>
    <td style="vertical-align:top">
      ${logoUrl?`<img src="${logoUrl}" style="max-height:48px;max-width:180px;object-fit:contain;margin-bottom:4mm" onerror="this.style.display='none'">`:''}
      <div style="font-size:13pt;font-weight:700;margin-bottom:1mm">${schuleName}</div>
      <div style="font-size:9pt;color:#475569;line-height:1.6">${[schuleAdr,schuleEmail,schuleTel].filter(Boolean).join(' · ')}</div>
    </td>
    <td style="text-align:right;vertical-align:top">
      <div style="font-size:18pt;font-weight:800;color:#1e293b">Rechnung</div>
      <div style="font-size:11pt;font-weight:700;margin-top:1mm">${r.rechnungsnummer??''}</div>
    </td>
  </tr></table>

  <table style="width:100%;margin-bottom:12mm"><tr>
    <td style="vertical-align:top;width:55%">
      <div style="font-size:8pt;color:#64748b;text-transform:uppercase;letter-spacing:.07em;margin-bottom:2mm">Rechnungsempfänger</div>
      <div style="font-weight:600">${eN}</div>
      <div style="white-space:pre-line;color:#475569;font-size:9pt;margin-top:1mm">${eA}</div>
    </td>
    <td style="text-align:right;vertical-align:top;font-size:9pt;color:#475569;line-height:2">
      <div><strong>Datum:</strong> ${fmtTs(r.ausgestellt_am)}</div>
      <div><strong>Fällig:</strong> ${fmtD(r.faellig_am)}</div>
    </td>
  </tr></table>

  <table>
    <thead><tr style="border-bottom:2px solid #1e293b;font-size:8pt;color:#64748b;text-transform:uppercase;letter-spacing:.06em">
      <th style="text-align:left;padding:0 0 2mm">Leistung</th>
      <th style="text-align:center;padding:0 0 2mm;width:14mm">Menge</th>
      <th style="text-align:right;padding:0 0 2mm;width:28mm">Einzelpreis</th>
      <th style="text-align:right;padding:0 0 2mm;width:28mm">Betrag</th>
    </tr></thead>
    <tbody>${rows}</tbody>
    <tfoot style="font-size:10pt">${summe}</tfoot>
  </table>

  ${r.notizen?`<div style="margin-top:10mm;padding:4mm;background:#f8fafc;border-left:3px solid #cbd5e1;font-size:9pt;color:#475569">${r.notizen}</div>`:''}

  <div style="margin-top:14mm;padding-top:4mm;border-top:1px solid #e2e8f0;font-size:8pt;color:#64748b;line-height:1.8">
    ${fussTeile.join('<br>')}
  </div>
  <script>window.onload=()=>window.print()</script>
  </body></html>`

  const w = window.open('', '_blank')
  if (w) { w.document.write(html); w.document.close() }
}

// ─── Positions-Editor ─────────────────────────────────────────────────────────
function PositionenEditor({ positionen, onChange, isMobile }) {
  const upd = (i, f, v) => onChange(positionen.map((p, idx) => idx === i ? { ...p, [f]: v } : p))
  const add  = () => onChange([...positionen, { beschreibung:'', menge:1, einzelpreis:'' }])
  const del  = i  => onChange(positionen.filter((_, idx) => idx !== i))

  return (
    <div>
      {!isMobile && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 72px 110px 80px 28px', gap:8, marginBottom:4 }}>
          {['Beschreibung','Menge','Einzelpreis (€)','Gesamt',''].map((h,i) => (
            <div key={i} style={{ fontSize:11, fontWeight:600, color:'var(--text-3)', textAlign: i>=2?'right':'left' }}>{h}</div>
          ))}
        </div>
      )}

      {positionen.map((p, i) => {
        const ges = (Number(p.menge)||0) * (Number(p.einzelpreis)||0)
        return isMobile ? (
          <div key={i} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:12, marginBottom:8, position:'relative' }}>
            {positionen.length > 1 && (
              <button onClick={() => del(i)} style={{ position:'absolute', top:8, right:8, background:'none', border:'none', color:'var(--danger)', cursor:'pointer', fontSize:20, lineHeight:1, padding:0 }}>×</button>
            )}
            <input value={p.beschreibung} onChange={e => upd(i,'beschreibung',e.target.value)}
              placeholder="Leistungsbeschreibung"
              style={{ ...s.input, marginBottom:8, paddingRight: positionen.length>1 ? 28 : undefined }} />
            <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:3 }}>Menge</div>
                <input type="number" min="0" step="0.01" value={p.menge} onChange={e => upd(i,'menge',e.target.value)} style={s.input} />
              </div>
              <div style={{ flex:2 }}>
                <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:3 }}>Einzelpreis (€)</div>
                <input type="number" min="0" step="0.01" value={p.einzelpreis} onChange={e => upd(i,'einzelpreis',e.target.value)} style={s.input} />
              </div>
              <div style={{ flex:1, textAlign:'right', paddingBottom:10 }}>
                <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:3 }}>Gesamt</div>
                <div style={{ fontWeight:700, fontSize:15 }}>{fmtE(ges)}</div>
              </div>
            </div>
          </div>
        ) : (
          <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 72px 110px 80px 28px', gap:8, marginBottom:6, alignItems:'center' }}>
            <input value={p.beschreibung} onChange={e => upd(i,'beschreibung',e.target.value)}
              placeholder="Leistungsbeschreibung" style={s.input} />
            <input type="number" min="0" step="0.01" value={p.menge}
              onChange={e => upd(i,'menge',e.target.value)} style={{ ...s.input, textAlign:'center' }} />
            <input type="number" min="0" step="0.01" value={p.einzelpreis}
              onChange={e => upd(i,'einzelpreis',e.target.value)} style={{ ...s.input, textAlign:'right' }} />
            <div style={{ textAlign:'right', fontWeight:700, fontSize:14 }}>{fmtE(ges)}</div>
            <button onClick={() => del(i)} disabled={positionen.length <= 1}
              style={{ background:'none', border:'none', color: positionen.length>1?'var(--danger)':'var(--border)', cursor: positionen.length>1?'pointer':'default', fontSize:20, lineHeight:1, padding:0 }}>
              ×
            </button>
          </div>
        )
      })}

      <button onClick={add} style={{ width:'100%', marginTop:6, padding:'8px 0', background:'none', border:'1.5px dashed var(--border)', borderRadius:'var(--radius)', color:'var(--primary)', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
        + Zeile hinzufügen
      </button>
    </div>
  )
}

// ─── Steuersatz-Wähler ────────────────────────────────────────────────────────
function SteuersatzPills({ value, onChange }) {
  return (
    <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
      {[['0','Steuerbefreit'],['7','7 %'],['19','19 %']].map(([v,l]) => (
        <button key={v} type="button" onClick={() => onChange(v)}
          style={{ padding:'5px 14px', borderRadius:20, border:'1.5px solid', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
            borderColor: value===v?'var(--primary)':'var(--border)',
            background:  value===v?'color-mix(in srgb, var(--primary) 12%, var(--bg))':'var(--bg)',
            color:       value===v?'var(--primary)':'var(--text-2)' }}>
          {l}
        </button>
      ))}
    </div>
  )
}

// ─── Summen-Block ─────────────────────────────────────────────────────────────
function Summe({ positionen, steuersatz, style }) {
  const { netto, mwst, brutto } = calcTotals(positionen, steuersatz)
  const st = Number(steuersatz)
  return (
    <div style={{ ...style }}>
      {st > 0 && (
        <>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'var(--text-2)', marginBottom:3 }}>
            <span>Nettobetrag</span><span>{fmtE(netto)}</span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'var(--text-2)', marginBottom:6 }}>
            <span>zzgl. {steuersatz} % MwSt.</span><span>{fmtE(mwst)}</span>
          </div>
        </>
      )}
      <div style={{ display:'flex', justifyContent:'space-between', fontWeight:800, fontSize:18, borderTop: st>0?'1px solid var(--border)':'none', paddingTop: st>0?8:0 }}>
        <span>Gesamt</span><span>{fmtE(brutto)}</span>
      </div>
    </div>
  )
}

// ─── Neue Rechnung erstellen ──────────────────────────────────────────────────
function NeueRechnungModal({ schuleId, onClose, onGespeichert, isMobile }) {
  const in14 = new Date(); in14.setDate(in14.getDate() + 14)

  const [form, setForm] = useState({
    empfaenger_name:    '',
    empfaenger_adresse: '',
    positionen:         [{ beschreibung:'', menge:1, einzelpreis:'' }],
    steuersatz:         '0',
    faellig_am:         in14.toISOString().slice(0, 10),
    notizen:            '',
  })
  const [laden,  setLaden]  = useState(false)
  const [fehler, setFehler] = useState('')

  const { brutto } = calcTotals(form.positionen, form.steuersatz)

  async function speichern() {
    if (!form.empfaenger_name.trim())
      return setFehler('Empfänger ist ein Pflichtfeld.')
    if (form.positionen.some(p => !p.beschreibung.trim() || !String(p.einzelpreis).trim()))
      return setFehler('Alle Positionen müssen Beschreibung und Preis haben.')
    if (brutto <= 0)
      return setFehler('Der Gesamtbetrag muss größer als 0 sein.')

    setLaden(true); setFehler('')
    const { error } = await supabase.from('rechnungen').insert({
      schule_id:          schuleId,
      empfaenger_name:    form.empfaenger_name.trim(),
      empfaenger_adresse: form.empfaenger_adresse.trim() || null,
      positionen:         form.positionen,
      betrag:             brutto,
      steuersatz:         Number(form.steuersatz),
      faellig_am:         form.faellig_am || null,
      notizen:            form.notizen.trim() || null,
      typ:                'freitext',
    })
    setLaden(false)
    if (error) return setFehler(error.message)
    onGespeichert()
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const inhalt = (
    <>
      {/* Empfänger */}
      <section style={{ marginBottom:22 }}>
        <div style={s.sectionLabel}>Empfänger</div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <div>
            <label style={s.label}>Name / Firma *</label>
            <input value={form.empfaenger_name} onChange={e => set('empfaenger_name', e.target.value)}
              placeholder="Max Mustermann oder Muster GmbH" style={s.input} />
          </div>
          <div>
            <label style={s.label}>Adresse</label>
            <textarea value={form.empfaenger_adresse} onChange={e => set('empfaenger_adresse', e.target.value)}
              rows={2} placeholder={'Musterstraße 1\n12345 Musterstadt'}
              style={{ ...s.input, resize:'vertical' }} />
          </div>
        </div>
      </section>

      {/* Positionen */}
      <section style={{ marginBottom:22 }}>
        <div style={s.sectionLabel}>Positionen</div>
        <PositionenEditor positionen={form.positionen} onChange={p => set('positionen', p)} isMobile={isMobile} />
      </section>

      {/* Steuersatz + Summe */}
      <section style={{ marginBottom:22, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:14 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12, flexWrap:'wrap' }}>
          <span style={s.label}>Steuersatz</span>
          <SteuersatzPills value={form.steuersatz} onChange={v => set('steuersatz', v)} />
        </div>
        <Summe positionen={form.positionen} steuersatz={form.steuersatz} />
      </section>

      {/* Fälligkeit + Notizen */}
      <section style={{ display:'grid', gridTemplateColumns: isMobile?'1fr':'160px 1fr', gap:12, marginBottom:22 }}>
        <div>
          <label style={s.label}>Fällig am</label>
          <input type="date" value={form.faellig_am} onChange={e => set('faellig_am', e.target.value)} style={s.input} />
        </div>
        <div>
          <label style={s.label}>Notizen (erscheinen auf der Rechnung)</label>
          <textarea value={form.notizen} onChange={e => set('notizen', e.target.value)}
            rows={2} placeholder="z.B. Zahlbar innerhalb 14 Tagen per Überweisung"
            style={{ ...s.input, resize:'vertical' }} />
        </div>
      </section>

      {fehler && <div style={{ color:'var(--danger)', fontSize:13, marginBottom:10 }}>{fehler}</div>}

      <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
        <button onClick={onClose} style={s.btnSek}>Abbrechen</button>
        <button onClick={speichern} disabled={laden} style={s.btnPrim}>
          {laden ? 'Erstelle …' : '💾 Rechnung erstellen'}
        </button>
      </div>
    </>
  )

  return (
    <Modal titel="Neue Rechnung" onClose={onClose} maxWidth={620}>
      {inhalt}
    </Modal>
  )
}

// ─── Bezahlt-Modal ────────────────────────────────────────────────────────────
function BezahltModal({ rechnung, onClose, onGespeichert }) {
  const [datum, setDatum] = useState(new Date().toISOString().slice(0, 10))
  const [weg,   setWeg]   = useState('ueberweisung')
  const [laden, setLaden] = useState(false)

  async function markieren() {
    setLaden(true)
    await supabase.from('rechnungen').update({ bezahlt_am: datum, zahlungsweg: weg }).eq('id', rechnung.id)
    setLaden(false)
    onGespeichert()
  }

  return (
    <Modal titel="Als bezahlt markieren" onClose={onClose} maxWidth={380}>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <div>
          <label style={s.label}>Eingangsdatum</label>
          <input type="date" value={datum} onChange={e => setDatum(e.target.value)} style={s.input} />
        </div>
        <div>
          <label style={s.label}>Zahlungsweg</label>
          <select value={weg} onChange={e => setWeg(e.target.value)} style={s.input}>
            <option value="ueberweisung">Überweisung</option>
            <option value="sepa">SEPA-Lastschrift</option>
            <option value="bar">Bar</option>
            <option value="sonstiges">Sonstiges</option>
          </select>
        </div>
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:4 }}>
          <button onClick={onClose} style={s.btnSek}>Abbrechen</button>
          <button onClick={markieren} disabled={laden} style={s.btnPrim}>
            {laden ? '…' : '✓ Bezahlt'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Detail-Modal ─────────────────────────────────────────────────────────────
function DetailModal({ rechnung: r, schule, onClose, onBezahlt, onStorno }) {
  const { netto, mwst, brutto } = calcTotals(r.positionen, r.steuersatz)
  const st = Number(r.steuersatz ?? 0)

  return (
    <Modal titel={r.rechnungsnummer ?? 'Rechnung'} onClose={onClose} maxWidth={520}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
        <div>
          <div style={{ fontWeight:700, fontSize:17 }}>{empfName(r)}</div>
          {(r.empfaenger_snapshot?.adresse || r.empfaenger_adresse) && (
            <div style={{ fontSize:12, color:'var(--text-2)', whiteSpace:'pre-line', marginTop:3 }}>
              {r.empfaenger_snapshot?.adresse ?? r.empfaenger_adresse}
            </div>
          )}
        </div>
        <StatusBadge r={r} />
      </div>

      <div style={{ display:'flex', gap:20, fontSize:12, color:'var(--text-3)', marginBottom:18, flexWrap:'wrap' }}>
        <span>Ausgestellt: <strong style={{ color:'var(--text-2)' }}>{fmtTs(r.ausgestellt_am)}</strong></span>
        <span>Fällig: <strong style={{ color:'var(--text-2)' }}>{fmtD(r.faellig_am)}</strong></span>
        {r.bezahlt_am && <span>Bezahlt: <strong style={{ color:'var(--success)' }}>{fmtD(r.bezahlt_am)}</strong></span>}
      </div>

      {/* Positionen */}
      <div style={{ border:'1px solid var(--border)', borderRadius:'var(--radius)', overflow:'hidden', marginBottom:16 }}>
        {(r.positionen ?? []).map((p, i) => {
          const g = (Number(p.menge)||0) * (Number(p.einzelpreis)||0)
          return (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 12px', borderBottom:'1px solid var(--border)', fontSize:13 }}>
              <div>
                <span style={{ color:'var(--text-3)', marginRight:6 }}>{p.menge}×</span>
                {p.beschreibung}
              </div>
              <span style={{ fontWeight:600, whiteSpace:'nowrap', marginLeft:12 }}>{fmtE(g)}</span>
            </div>
          )
        })}
        <div style={{ padding:'10px 12px', background:'var(--bg)' }}>
          {st > 0 && (
            <>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--text-2)', marginBottom:3 }}>
                <span>Netto</span><span>{fmtE(netto)}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--text-2)', marginBottom:6 }}>
                <span>{st} % MwSt.</span><span>{fmtE(mwst)}</span>
              </div>
            </>
          )}
          <div style={{ display:'flex', justifyContent:'space-between', fontWeight:800, fontSize:16 }}>
            <span>Gesamt</span><span>{fmtE(brutto)}</span>
          </div>
        </div>
      </div>

      {r.notizen && (
        <div style={{ fontSize:13, color:'var(--text-2)', padding:'8px 12px', background:'var(--surface)', borderRadius:'var(--radius)', borderLeft:'3px solid var(--border)', marginBottom:16 }}>
          {r.notizen}
        </div>
      )}

      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <button onClick={() => druckeRechnung(r, schule)} style={s.btnSek}>🖨️ Drucken</button>
        {!r.bezahlt_am && !r.storniert_am && (
          <button onClick={onBezahlt} style={s.btnPrim}>✓ Als bezahlt markieren</button>
        )}
        {!r.storniert_am && (
          <button onClick={onStorno} style={{ ...s.btnSek, color:'var(--danger)', borderColor:'var(--danger)' }}>
            Stornieren
          </button>
        )}
      </div>
    </Modal>
  )
}

// ─── Status-Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ r }) {
  if (r.storniert_am)
    return <span style={badge('#fee2e2','#b91c1c')}>Storniert</span>
  if (r.bezahlt_am)
    return <span style={badge('#dcfce7','#166534')}>Bezahlt</span>
  if (r.faellig_am && new Date(r.faellig_am + 'T00:00:00') < new Date())
    return <span style={badge('#fff7ed','#c2410c')}>Überfällig</span>
  return <span style={badge('#eff6ff','#1d4ed8')}>Offen</span>
}
const badge = (bg, color) => ({ background:bg, color, borderRadius:20, padding:'2px 10px', fontSize:12, fontWeight:700, whiteSpace:'nowrap' })

// ─── Hauptkomponente ──────────────────────────────────────────────────────────
export default function Rechnungen() {
  const { profil, schule, confirm, toast } = useApp()
  const isMobile = useIsMobile()

  const [rechnungen, setRechnungen] = useState([])
  const [filter,     setFilter]     = useState('alle')
  const [suchtext,   setSuchtext]   = useState('')
  const [laden,      setLaden]      = useState(true)

  const [neueModal,    setNeueModal]    = useState(false)
  const [detailModal,  setDetailModal]  = useState(null)
  const [bezahltModal, setBezahltModal] = useState(null)

  const ladeAlles = useCallback(async () => {
    setLaden(true)
    const { data } = await supabase
      .from('rechnungen')
      .select('*')
      .eq('schule_id', profil.schule_id)
      .order('erstellt_am', { ascending: false })
    setRechnungen(data ?? [])
    setLaden(false)
  }, [profil.schule_id])

  useEffect(() => { ladeAlles() }, [ladeAlles])

  async function stornieren(r) {
    const ok = await confirm(`Rechnung ${r.rechnungsnummer} wirklich stornieren? Diese Aktion kann nicht rückgängig gemacht werden.`)
    if (!ok) return
    await supabase.from('rechnungen').update({
      storniert_am:  new Date().toISOString(),
      storniert_von: profil.id,
    }).eq('id', r.id)
    toast('Rechnung storniert', 'info')
    setDetailModal(null)
    ladeAlles()
  }

  // Filtern & Suchen
  const heute = new Date()
  const gefiltert = rechnungen
    .filter(r => {
      if (filter === 'offen')        return !r.bezahlt_am && !r.storniert_am && !(r.faellig_am && new Date(r.faellig_am+'T00:00:00') < heute)
      if (filter === 'bezahlt')      return !!r.bezahlt_am
      if (filter === 'ueberfaellig') return !r.bezahlt_am && !r.storniert_am && r.faellig_am && new Date(r.faellig_am+'T00:00:00') < heute
      return true
    })
    .filter(r => {
      if (!suchtext) return true
      const q = suchtext.toLowerCase()
      return empfName(r).toLowerCase().includes(q) || (r.rechnungsnummer ?? '').toLowerCase().includes(q)
    })

  // KPIs
  const kpiOffen        = rechnungen.filter(r => !r.bezahlt_am && !r.storniert_am).length
  const kpiUeberfaellig = rechnungen.filter(r => !r.bezahlt_am && !r.storniert_am && r.faellig_am && new Date(r.faellig_am+'T00:00:00') < heute).length
  const kpiVolumen      = rechnungen.filter(r => !r.storniert_am).reduce((s, r) => s + Number(r.betrag || 0), 0)

  return (
    <div style={{ maxWidth:860 }}>

      {/* Header */}
      <div style={{ display:'flex', flexDirection: isMobile?'column':'row', alignItems: isMobile?'stretch':'center', gap:12, marginBottom:24 }}>
        <h1 style={{ fontSize:22, fontWeight:800, color:'var(--text)', margin:0, flex:1 }}>Rechnungen</h1>
        <button onClick={() => setNeueModal(true)} style={s.btnPrim}>+ Neue Rechnung</button>
      </div>

      {/* Setup-Banner: Steuerpflichtangaben unvollständig */}
      {(!schule?.steuernummer && !schule?.ustid) && (
        <div style={{ background:'#fffbeb', border:'1.5px solid #f59e0b', borderRadius:'var(--radius-lg)', padding:'14px 18px', marginBottom:20, display:'flex', flexDirection: isMobile?'column':'row', alignItems: isMobile?'flex-start':'center', gap:12 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:700, fontSize:14, color:'#92400e', marginBottom:3 }}>⚠️ Steuerliche Pflichtangaben fehlen</div>
            <div style={{ fontSize:13, color:'#78350f', lineHeight:1.5 }}>
              Rechnungen ohne Steuernummer oder USt-IdNr. sind nach §14 Abs. 4 Nr. 2 UStG ungültig.
              Trage diese Angaben einmalig in den Schuleinstellungen ein.
            </div>
          </div>
          <a href="/admin/einstellungen" style={{ padding:'8px 16px', borderRadius:'var(--radius)', background:'#f59e0b', color:'#fff', fontWeight:700, fontSize:13, textDecoration:'none', whiteSpace:'nowrap', flexShrink:0 }}>
            Einstellungen öffnen →
          </a>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns: isMobile?'1fr 1fr':'repeat(3,1fr)', gap:12, marginBottom:24 }}>
        {[
          { label:'Offen',         val:kpiOffen,         bg:'#eff6ff', color:'#1d4ed8' },
          { label:'Überfällig',    val:kpiUeberfaellig,  bg:'#fff7ed', color:'#c2410c' },
          { label:'Gesamtvolumen', val:fmtE(kpiVolumen), bg:'var(--surface)', color:'var(--text)' },
        ].map(k => (
          <div key={k.label} style={{ background:k.bg, border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'14px 18px' }}>
            <div style={{ fontSize:11, fontWeight:600, color:k.color, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:4 }}>{k.label}</div>
            <div style={{ fontSize:24, fontWeight:800, color:k.color }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Filter + Suche */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:16 }}>
        {[['alle','Alle'],['offen','Offen'],['bezahlt','Bezahlt'],['ueberfaellig','Überfällig']].map(([v,l]) => (
          <button key={v} onClick={() => setFilter(v)}
            style={{ padding:'6px 14px', borderRadius:20, border:'1.5px solid', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
              borderColor: filter===v?'var(--primary)':'var(--border)',
              background:  filter===v?'color-mix(in srgb, var(--primary) 12%, var(--bg))':'var(--bg)',
              color:       filter===v?'var(--primary)':'var(--text-2)' }}>
            {l}
          </button>
        ))}
        <input value={suchtext} onChange={e => setSuchtext(e.target.value)}
          placeholder="Suchen …"
          style={{ ...s.input, flex:1, minWidth:140, maxWidth:240, marginLeft:'auto' }} />
      </div>

      {/* Inhalt */}
      {laden ? (
        <div style={{ textAlign:'center', padding:64, color:'var(--text-3)', fontSize:14 }}>Lade …</div>
      ) : gefiltert.length === 0 ? (
        <div style={{ textAlign:'center', padding:64, color:'var(--text-3)', fontSize:14 }}>
          {rechnungen.length === 0 ? 'Noch keine Rechnungen. Erstelle deine erste Rechnung.' : 'Keine Rechnungen gefunden.'}
        </div>
      ) : isMobile ? (
        /* ── Mobile: Karten ── */
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {gefiltert.map(r => (
            <div key={r.id} onClick={() => setDetailModal(r)}
              style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:16, cursor:'pointer', opacity: r.storniert_am ? 0.55 : 1 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:15, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{empfName(r)}</div>
                  <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2, fontFamily:'monospace' }}>{r.rechnungsnummer}</div>
                </div>
                <StatusBadge r={r} />
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ fontSize:12, color:'var(--text-3)' }}>Fällig {fmtD(r.faellig_am)}</div>
                <div style={{ fontWeight:800, fontSize:17 }}>{fmtE(r.betrag)}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ── Desktop: Tabelle ── */
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'var(--bg)', borderBottom:'1px solid var(--border)' }}>
                {[['Nr.','left'],['Empfänger','left'],['Betrag','right'],['Ausgestellt','left'],['Fällig','left'],['Status','left'],['','right']].map(([h,a],i) => (
                  <th key={i} style={{ padding:'10px 14px', textAlign:a, fontSize:12, fontWeight:600, color:'var(--text-3)', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gefiltert.map(r => (
                <tr key={r.id}
                  onClick={() => setDetailModal(r)}
                  style={{ borderBottom:'1px solid var(--border)', cursor:'pointer', opacity: r.storniert_am ? 0.55 : 1, transition:'background .1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <td style={{ padding:'12px 14px', fontFamily:'monospace', fontSize:13, fontWeight:600, whiteSpace:'nowrap' }}>{r.rechnungsnummer}</td>
                  <td style={{ padding:'12px 14px', fontSize:14, maxWidth:220, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{empfName(r)}</td>
                  <td style={{ padding:'12px 14px', fontSize:14, fontWeight:700, textAlign:'right', whiteSpace:'nowrap' }}>{fmtE(r.betrag)}</td>
                  <td style={{ padding:'12px 14px', fontSize:13, color:'var(--text-2)', whiteSpace:'nowrap' }}>{fmtTs(r.ausgestellt_am)}</td>
                  <td style={{ padding:'12px 14px', fontSize:13, color:'var(--text-2)', whiteSpace:'nowrap' }}>{fmtD(r.faellig_am)}</td>
                  <td style={{ padding:'12px 14px' }}><StatusBadge r={r} /></td>
                  <td style={{ padding:'12px 14px' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
                      <button title="Drucken" onClick={() => druckeRechnung(r, schule)} style={s.iconBtn}>🖨️</button>
                      {!r.bezahlt_am && !r.storniert_am && (
                        <button title="Als bezahlt markieren" onClick={() => setBezahltModal(r)} style={{ ...s.iconBtn, color:'var(--success)' }}>✓</button>
                      )}
                      {!r.storniert_am && (
                        <button title="Stornieren" onClick={() => stornieren(r)} style={{ ...s.iconBtn, color:'var(--danger)' }}>✕</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {neueModal && (
        <NeueRechnungModal
          schuleId={profil.schule_id}
          isMobile={isMobile}
          onClose={() => setNeueModal(false)}
          onGespeichert={() => { setNeueModal(false); ladeAlles(); toast('Rechnung erstellt', 'success') }}
        />
      )}

      {detailModal && !bezahltModal && (
        <DetailModal
          rechnung={detailModal}
          schule={schule}
          onClose={() => setDetailModal(null)}
          onBezahlt={() => setBezahltModal(detailModal)}
          onStorno={() => stornieren(detailModal)}
        />
      )}

      {bezahltModal && (
        <BezahltModal
          rechnung={bezahltModal}
          onClose={() => setBezahltModal(null)}
          onGespeichert={() => {
            setBezahltModal(null); setDetailModal(null)
            ladeAlles(); toast('Als bezahlt markiert', 'success')
          }}
        />
      )}
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = {
  label:       { fontSize:13, fontWeight:600, color:'var(--text-2)', display:'block', marginBottom:5 },
  sectionLabel:{ fontSize:12, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:10 },
  input:       { width:'100%', boxSizing:'border-box', padding:'9px 12px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg)', color:'var(--text)', fontSize:14, fontFamily:'inherit', outline:'none' },
  btnPrim:     { padding:'9px 20px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  btnSek:      { padding:'9px 20px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg)', color:'var(--text)', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit' },
  iconBtn:     { background:'none', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'5px 9px', cursor:'pointer', fontSize:14, color:'var(--text-2)', fontFamily:'inherit' },
}
