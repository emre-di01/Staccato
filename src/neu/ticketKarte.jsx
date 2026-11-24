// Ticket mit QR-Code zum Vorzeigen, Verschicken und Drucken (Mitglieder und Shop-Gäste)
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { CircleCheck, Download, Send } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { Knopf, Laden } from '../ui'
import { uhrzeit } from './zeit'
import { dateiSpeichern } from './dateiSpeichern'
import { ticketQrInhalt } from './tickets'

// Bilder schon beim Öffnen erzeugen: Handys erlauben „Teilen“ nur unmittelbar nach dem Tippen.
// tickets: [{ ticket, nr }]; Ergebnis: ticketId → Bilddatei (null: Erzeugen fehlgeschlagen)
export function useTicketBilder(tickets, { anzahl, event, schule }) {
  const { T, lang } = useApp()
  const [bilder, setBilder] = useState({})
  const schluessel = tickets.map(x => x.ticket.id + x.nr).join()
  useEffect(() => {
    if (!schluessel) return
    let aktuell = true
    const setze = neu => { if (aktuell) setBilder(b => ({ ...b, ...neu })) }
    import('./ticketPdf')
      .then(m => m.ticketBilder({ tickets, fertig: (id, datei) => setze({ [id]: datei }), anzahl, event, schule, T, lang }))
      .catch(() => setze(Object.fromEntries(tickets.map(x => [x.ticket.id, null]))))
    return () => { aktuell = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schluessel, anzahl, lang])
  return bilder
}

// PDF mit allen Tickets speichern
export function useTicketDruck(tickets, { anzahl, event, schule }) {
  const { T, lang, toast } = useApp()
  const [druckt, setDruckt] = useState(false)
  async function drucken() {
    setDruckt(true)
    try {
      const { ticketPdf } = await import('./ticketPdf')
      dateiSpeichern(await ticketPdf({ tickets, anzahl, event, schule, T, lang }))
      toast(T('tk_gespeichert_pdf'), 'success')
    } catch { toast(T('tk_pdf_fehler'), 'error') }
    setDruckt(false)
  }
  return { druckt, drucken }
}

export function TicketKarte({ x: { ticket, nr }, anzahl, schule, bild, nutzbar }) {
  const { T, lang, toast } = useApp()
  const [qr, setQr] = useState(null)
  const benutzt = ticket.status === 'eingeloest'
  const titel = anzahl === 1 ? T('tk_dein_ticket') : T('tk_nr_von').replace('{nr}', nr).replace('{n}', anzahl)

  useEffect(() => {
    if (!nutzbar) return
    let aktuell = true
    QRCode.toDataURL(ticketQrInhalt(ticket.code), { width: 800, margin: 1, color: { dark: '#111114', light: '#FFFFFF' } }).then(b => { if (aktuell) setQr(b) })
    return () => { aktuell = false }
  }, [ticket.code, nutzbar])

  const teilbar = !!bild && !!navigator.canShare?.({ files: [bild] })
  function speichern() {
    dateiSpeichern(bild)
    toast(T('tk_bild_gespeichert'), 'success')
  }
  // Kein await vor navigator.share, sonst verweigert der Browser das Teilen
  function verschicken() {
    if (!bild) { toast(T('tk_pdf_fehler'), 'error'); return }
    if (!teilbar) { speichern(); return }
    navigator.share({ files: [bild] }).catch(e => { if (e?.name !== 'AbortError') speichern() })   // AbortError: abgebrochen
  }

  return (
    <article aria-label={titel} style={{ padding: 22, borderRadius: 24, background: 'var(--n-fill)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div style={{ fontSize: 22, fontWeight: 800 }}>{titel}</div>
      {benutzt ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 19, fontWeight: 700, color: 'var(--text-2)' }}>
          <CircleCheck aria-hidden="true" size={26} />{T('tk_status_benutzt')}, {uhrzeit(ticket.eingeloest_am, schule.zeitzone ?? 'Europe/Berlin', lang)}
        </div>
      ) : nutzbar && <>
        <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--success)' }}>{T('tk_status_bereit')}</div>
        <div style={{ width: 'min(340px, 100%)', aspectRatio: '1', borderRadius: 18, background: '#FFFFFF', padding: 14, boxSizing: 'border-box' }}>
          {qr ? <img src={qr} alt={`${T('tk_qr_code')}, ${titel}`} style={{ width: '100%', height: '100%', display: 'block' }} /> : <Laden hoehe={280} />}
        </div>
        <Knopf voll variante="sekundaer" icon={bild && !teilbar ? Download : Send} disabled={bild === undefined} onClick={verschicken} style={{ height: 56, background: 'var(--bg)' }}>
          {T(bild && !teilbar ? 'tk_bild_speichern' : 'tk_verschicken')}
        </Knopf>
      </>}
    </article>
  )
}
