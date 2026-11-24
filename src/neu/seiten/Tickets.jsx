import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { ChevronLeft, ChevronRight, CircleCheck, Clock, Download, QrCode, Share2 } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { Seite, Segment, Gruppe, Trenner, Zeile, Knopf, Leer, Laden, Blatt, FehlerText } from '../../ui'
import { useBasis } from '../rolle'
import { tagLabel, uhrzeit } from '../zeit'
import { EventBild } from '../eventBild'
import { dateiSpeichern } from '../dateiSpeichern'
import { useMeineTickets, ticketsNachEvent, ticketQrInhalt, ticketNummer, euro } from '../tickets'

// Eigene Tickets: je Veranstaltung QR-Codes, PDF und offene Reservierungen
export default function NeuTickets() {
  const { T } = useApp()
  const basis = useBasis()
  const [params, setParams] = useSearchParams()
  const { data, isLoading, isError } = useMeineTickets()
  const [ansicht, setAnsicht] = useState('kommend')

  const gruppen = ticketsNachEvent(data)
  const liste = gruppen.filter(g => g.vergangen === (ansicht === 'vergangen'))
  if (ansicht === 'vergangen') liste.reverse()
  const offen = gruppen.find(g => g.event.id === params.get('event') && g.tickets.length)

  return (
    <Seite titel={T('tk_meine_tickets')} zurueck={{ to: `${basis}/ich`, label: T('n_tab_ich') }}>
      <Segment label={T('n_filter')} wert={ansicht} onChange={setAnsicht} style={{ margin: '16px 20px 0' }}
        optionen={[['kommend', T('nv_kommend')], ['vergangen', T('nv_vergangen')]]} />
      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {isLoading ? <Laden hoehe={220} /> : isError ? <div style={{ margin: '0 20px' }}><FehlerText>{T('tk_laden_fehler')}</FehlerText></div>
          : liste.length === 0 ? <Leer text={T('tk_keine_tickets')} />
          : liste.map(g => <EventGruppe key={g.event.id} g={g} onOeffnen={() => setParams({ event: g.event.id })} />)}
      </div>
      {offen && <TicketAnsicht g={offen} onClose={() => setParams({}, { replace: true })} />}
    </Seite>
  )
}

function useTexte() {
  const { T, lang, zeitzone } = useApp()
  return {
    zeitpunkt: (iso, schule) => `${tagLabel(iso, schule?.zeitzone ?? zeitzone, lang, T)}, ${uhrzeit(iso, schule?.zeitzone ?? zeitzone, lang)}`,
    anzahl: n => n === 1 ? T('tk_1_ticket') : T('tk_x_tickets').replace('{n}', n),
    geld: betrag => euro(betrag, lang),
  }
}

function EventGruppe({ g, onOeffnen }) {
  const { T, schule } = useApp()
  const texte = useTexte()
  const eingeloest = g.tickets.filter(x => x.ticket.status === 'eingeloest').length
  const zeilen = [
    g.tickets.length > 0 && <Zeile key="qr" icon={QrCode} titel={T('tk_qr_zeigen')} untertitel={[texte.anzahl(g.tickets.length), eingeloest > 0 && T('tk_x_eingeloest').replace('{n}', eingeloest)].filter(Boolean).join(' · ')} onClick={onOeffnen} />,
    ...g.offen.map(o => <Zeile key={o.id} icon={Clock} titel={`${texte.anzahl(o.anzahl)} · ${texte.geld(o.betrag)}`} untertitel={T('tk_bar_bis').replace('{zeit}', texte.zeitpunkt(o.frist, g.schule))} />),
    g.storniert > 0 && <Zeile key="storno" titel={`${texte.anzahl(g.storniert)} · ${T('tk_ticket_storniert')}`} />,
  ].filter(Boolean)
  return (
    <section aria-label={g.event.titel}>
      <div style={{ margin: '0 20px 10px' }}>
        {g.event.bild_pfad && !g.vergangen && <EventBild pfad={g.event.bild_pfad} style={{ marginBottom: 12 }} />}
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, overflowWrap: 'anywhere' }}>{g.event.titel}</h2>
        <div style={{ fontSize: 16, color: 'var(--text-2)' }}>
          {[texte.zeitpunkt(g.event.beginn, g.schule), g.event.ort, g.schule.name !== schule?.name && g.schule.name].filter(Boolean).join(' · ')}
        </div>
      </div>
      <Gruppe>{zeilen.map((z, i) => <div key={z.key}>{i > 0 && <Trenner />}{z}</div>)}</Gruppe>
    </section>
  )
}

// Ein Ticket groß mit QR-Code, durchblättern, als PDF speichern oder weitergeben
function TicketAnsicht({ g, onClose }) {
  const { T, lang, toast } = useApp()
  const texte = useTexte()
  const [index, setIndex] = useState(() => Math.max(0, g.tickets.findIndex(x => x.ticket.status === 'gueltig')))
  const [qr, setQr] = useState(null)
  const [einzeln, setEinzeln] = useState(null)   // vorbereitetes PDF des angezeigten Tickets
  const [arbeitet, setArbeitet] = useState(false)
  const { ticket, nr } = g.tickets[Math.min(index, g.tickets.length - 1)]
  const eingeloest = ticket.status === 'eingeloest'
  const gueltige = g.tickets.filter(x => x.ticket.status === 'gueltig')

  useEffect(() => {
    let aktuell = true
    QRCode.toDataURL(ticketQrInhalt(ticket.code), { width: 800, margin: 1, color: { dark: '#111114', light: '#FFFFFF' } })
      .then(bild => { if (aktuell) setQr({ id: ticket.id, bild }) })
    return () => { aktuell = false }
  }, [ticket.id, ticket.code])

  // PDF schon beim Öffnen erzeugen: Handys erlauben „Teilen“ nur unmittelbar nach dem Tippen
  useEffect(() => {
    if (eingeloest) return
    let aktuell = true
    pdfErzeugen([{ ticket, nr }]).then(
      datei => { if (aktuell) setEinzeln({ id: ticket.id, datei }) },
      () => { if (aktuell) setEinzeln({ id: ticket.id, datei: null }) })
    return () => { aktuell = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket.id, nr, eingeloest, g.tickets.length, lang])

  async function pdfErzeugen(tickets) {
    const { ticketPdf } = await import('../ticketPdf')
    return ticketPdf({ tickets, anzahl: g.tickets.length, event: g.event, schule: g.schule, T, lang })
  }

  const bereit = einzeln?.id === ticket.id ? einzeln : null
  const teilbar = !!bereit?.datei && !!navigator.canShare?.({ files: [bereit.datei] })

  // Kein await vor navigator.share, sonst verweigert der Browser das Teilen
  function weitergeben() {
    if (!bereit?.datei) { toast(T('tk_pdf_fehler'), 'error'); return }
    if (!teilbar) { dateiSpeichern(bereit.datei); toast(T('tk_gespeichert_pdf'), 'success'); return }
    navigator.share({ files: [bereit.datei] }).catch(e => {
      if (e?.name === 'AbortError') return   // vom Nutzer abgebrochen
      dateiSpeichern(bereit.datei)
      toast(T('tk_gespeichert_pdf'), 'success')
    })
  }

  async function allesSpeichern() {
    setArbeitet(true)
    try {
      dateiSpeichern(await pdfErzeugen(gueltige))
      toast(T('tk_gespeichert_pdf'), 'success')
    } catch { toast(T('tk_pdf_fehler'), 'error') }
    setArbeitet(false)
  }

  return (
    <Blatt titel={g.event.titel} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ textAlign: 'center', fontSize: 16, color: 'var(--text-2)' }}>{[texte.zeitpunkt(g.event.beginn, g.schule), g.event.ort].filter(Boolean).join(' · ')}</div>
        <div style={{ position: 'relative', alignSelf: 'center', width: 'min(320px, 100%)', aspectRatio: '1', borderRadius: 18, background: '#FFFFFF', padding: 14, boxSizing: 'border-box' }}>
          {qr?.id === ticket.id ? <img src={qr.bild} alt={`${T('tk_qr_code')} ${ticketNummer(ticket)}`} style={{ width: '100%', height: '100%', display: 'block', opacity: eingeloest ? 0.12 : 1 }} /> : <Laden hoehe={280} />}
          {eingeloest && (
            <div role="status" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#166534', fontWeight: 800, fontSize: 20 }}>
              <CircleCheck aria-hidden="true" size={44} />{T('tk_ticket_eingeloest')}
              <span style={{ fontSize: 15, fontWeight: 600 }}>{texte.zeitpunkt(ticket.eingeloest_am, g.schule)}</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          {g.tickets.length > 1 && <Knopf klein variante="rahmen" icon={ChevronLeft} aria-label={T('tk_vorheriges')} style={rund} disabled={index === 0} onClick={() => setIndex(index - 1)} />}
          <div aria-live="polite" style={{ textAlign: 'center', minWidth: 150 }}>
            <div style={{ fontSize: 19, fontWeight: 800 }}>{T('tk_nr_von').replace('{nr}', nr).replace('{n}', g.tickets.length)}</div>
            <div style={{ fontSize: 15, color: 'var(--text-2)' }}>{texte.geld(ticket.preis)} · {T('tk_nummer')} {ticketNummer(ticket)}</div>
          </div>
          {g.tickets.length > 1 && <Knopf klein variante="rahmen" icon={ChevronRight} aria-label={T('tk_naechstes')} style={rund} disabled={index >= g.tickets.length - 1} onClick={() => setIndex(index + 1)} />}
        </div>
        {!eingeloest && <>
          <p style={{ margin: 0, textAlign: 'center', fontSize: 15, lineHeight: 1.45, color: 'var(--text-2)' }}>{T('tk_ticket_hinweis')}</p>
          <Knopf voll icon={teilbar || !bereit ? Share2 : Download} disabled={!bereit} onClick={weitergeben}>{T(bereit && !teilbar ? 'tk_pdf' : 'tk_weitergeben')}</Knopf>
        </>}
        {gueltige.length > 1 && (
          <Knopf voll variante="sekundaer" icon={Download} disabled={arbeitet} onClick={allesSpeichern}>
            {T('tk_pdf_alle').replace('{n}', gueltige.length)}
          </Knopf>
        )}
      </div>
    </Blatt>
  )
}

const rund = { width: 44, padding: 0, flexShrink: 0 }
