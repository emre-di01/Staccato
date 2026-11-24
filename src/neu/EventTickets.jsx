// Tickets für Mitglieder, bewusst einfach gehalten: ein Schritt, ein Hauptknopf je Ansicht
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CircleCheck, Minus, Plus, Ticket } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { Blatt, Knopf, Laden, FehlerText } from '../ui'
import { useNeuLaden } from './daten'
import { useTicketVerkauf, useMeineBestellungen, useMeineTickets, useTicketInfo, ticketsNachEvent, preisBerechnen, aktiveBestellungen, geldKurz, tagAusgeschrieben } from './tickets'

const GRUENDE = ['nicht_verfuegbar', 'kein_mitglied', 'noch_nicht', 'beendet', 'ausverkauft', 'obergrenze', 'zu_wenig_frei', 'preis_geaendert', 'anzahl']

// „Bitte 24 € bar bezahlen bis Freitag, 4. Dezember.“
export function BezahlenHinweis({ betrag, frist, tz, style }) {
  const { T, lang, zeitzone } = useApp()
  return (
    <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.4, color: 'var(--primary)', ...style }}>
      {T('tk_bezahlen_bis').replace('{betrag}', geldKurz(betrag, lang)).replace('{zeit}', tagAusgeschrieben(frist, tz ?? zeitzone, lang))}
    </div>
  )
}

// Auf der Terminkarte: entweder „Tickets reservieren“ oder der Weg zu den eigenen Tickets
export function EventTickets({ ev }) {
  const { T } = useApp()
  const navigate = useNavigate()
  const [offen, setOffen] = useState(false)
  const { data: verkauf = [] } = useTicketVerkauf()
  const { data: alle } = useMeineBestellungen()
  const meine = aktiveBestellungen(alle?.filter(b => b.event_id === ev.id))
  if (!verkauf.includes(ev.id) && !meine.length && !offen) return null

  const offene = meine.filter(b => b.status === 'reserviert')
  const bereit = meine.filter(b => b.status === 'bezahlt').reduce((s, b) => s + b.anzahl, 0)
  return (
    <>
      {offene.map(b => <BezahlenHinweis key={b.id} betrag={b.betrag} frist={b.frist} />)}
      {meine.length === 0
        ? <Knopf voll variante="tint" icon={Ticket} onClick={() => setOffen(true)}>{T('tk_reservieren')}</Knopf>
        : <Knopf voll variante="tint" icon={Ticket} onClick={() => navigate(`/tickets?event=${ev.id}`)}>{T(bereit === 1 ? 'tk_mein_ticket' : 'tk_meine_tickets')}</Knopf>}
      {offen && <ReservierenBlatt ev={ev} onClose={() => setOffen(false)} />}
    </>
  )
}

// Startseite: eigene Tickets für kommende Veranstaltungen, ein Tipp bis zum QR-Code
export function TicketStart() {
  const { T, lang } = useApp()
  const { data } = useMeineTickets()
  const gruppen = ticketsNachEvent(data).filter(g => !g.vergangen && (g.offen.length || g.tickets.some(x => x.ticket.status === 'gueltig'))).slice(0, 3)
  return gruppen.map(g => {
    const bereit = g.tickets.filter(x => x.ticket.status === 'gueltig').length
    return (
      <section key={g.event.id} aria-label={`${T('tk_tickets')}: ${g.event.titel}`} style={{ margin: '16px 20px 0', padding: 22, borderRadius: 24, background: 'var(--n-fill)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2, overflowWrap: 'anywhere' }}>{g.event.titel}</div>
          <div style={{ marginTop: 4, fontSize: 17, color: 'var(--text-2)' }}>{tagAusgeschrieben(g.event.beginn, g.schule.zeitzone, lang)}</div>
        </div>
        {g.offen.map(o => <BezahlenHinweis key={o.id} betrag={o.betrag} frist={o.frist} tz={g.schule.zeitzone} />)}
        {bereit > 0 && (
          <Link to={`/tickets?event=${g.event.id}`} style={{ height: 60, borderRadius: 16, background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 19, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, textDecoration: 'none' }}>
            <Ticket aria-hidden="true" size={24} />{bereit === 1 ? T('tk_mein_ticket') : T('tk_meine_x').replace('{n}', bereit)}
          </Link>
        )}
      </section>
    )
  })
}

export function ReservierenBlatt({ ev, onClose }) {
  const { T, lang, zeitzone } = useApp()
  const neuLaden = useNeuLaden()
  const navigate = useNavigate()
  const { data: info, isLoading, isError } = useTicketInfo(ev.id)
  const [gewaehlt, setGewaehlt] = useState(1)
  const [sendet, setSendet] = useState(false)
  const [fehler, setFehler] = useState('')
  const [fertig, setFertig] = useState(null)   // Ergebnis der Reservierung

  const anzahl = Math.max(1, Math.min(gewaehlt, info?.max ?? 1))
  const preis = info?.ok ? preisBerechnen(info, anzahl) : null
  const geld = betrag => geldKurz(betrag, lang)
  const grundText = grund => grund === 'noch_nicht' && info?.verkauf_von
    ? T('tk_grund_noch_nicht').replace('{zeit}', tagAusgeschrieben(info.verkauf_von, zeitzone, lang))
    : T(`tk_grund_${GRUENDE.includes(grund) ? grund : 'nicht_verfuegbar'}`)

  async function reservieren() {
    setSendet(true)
    setFehler('')
    const { data, error } = await supabase.rpc('tickets_reservieren', { p_event_id: ev.id, p_anzahl: anzahl, p_betrag: preis.betrag })
    setSendet(false)
    neuLaden('n-ticket-info', 'n-ticket-bestellungen', 'n-meine-tickets')
    if (error || !data.ok) { setFehler(error ? error.message : grundText(data.grund)); return }
    setFertig(data)
  }

  if (fertig) return (
    <Blatt titel={ev.titel} onClose={onClose}>
      <div role="status" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14, padding: '8px 0' }}>
        <CircleCheck aria-hidden="true" size={64} color="var(--success)" />
        <div style={{ fontSize: 28, fontWeight: 800 }}>{T(fertig.frist ? 'tk_reserviert_titel' : 'tk_fertig_titel')}</div>
        {fertig.frist && <>
          <BezahlenHinweis betrag={fertig.betrag} frist={fertig.frist} style={{ fontSize: 21 }} />
          <div style={{ fontSize: 17, color: 'var(--text-2)' }}>{T('tk_reserviert_danach')}</div>
        </>}
        {fertig.frist
          ? <Knopf voll onClick={onClose}>{T('tk_fertig')}</Knopf>
          : <Knopf voll icon={Ticket} onClick={() => { onClose(); navigate(`/tickets?event=${ev.id}`) }}>{T('tk_mein_ticket')}</Knopf>}
      </div>
    </Blatt>
  )

  return (
    <Blatt titel={ev.titel} onClose={onClose}>
      {isLoading ? <Laden hoehe={220} /> : isError ? <FehlerText>{T('tk_laden_fehler')}</FehlerText>
        : !info.ok ? <p role="status" style={{ margin: '8px 0', fontSize: 19, fontWeight: 600 }}>{grundText(info.grund)}</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 18 }}>
            <div style={{ fontSize: 21, fontWeight: 700 }}>{T('tk_wie_viele')}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <Knopf variante="sekundaer" aria-label={T('tk_weniger')} style={rund} disabled={anzahl <= 1} onClick={() => setGewaehlt(anzahl - 1)}><Minus aria-hidden="true" size={30} /></Knopf>
              <span aria-live="polite" style={{ minWidth: 64, fontSize: 44, fontWeight: 800 }}>{anzahl}</span>
              <Knopf variante="sekundaer" aria-label={T('tk_mehr')} style={rund} disabled={anzahl >= info.max} onClick={() => setGewaehlt(anzahl + 1)}><Plus aria-hidden="true" size={30} /></Knopf>
            </div>
            {anzahl >= info.max && info.max > 1 && <div style={{ fontSize: 16, color: 'var(--text-2)' }}>{T('tk_mehr_geht_nicht')}</div>}
            <div>
              <div style={{ fontSize: 26, fontWeight: 800 }}>{T('tk_zusammen').replace('{betrag}', geld(preis.betrag))}</div>
              {preis.verguenstigt > 0 && preis.normal > 0 && (
                <div style={{ marginTop: 4, fontSize: 16, color: 'var(--text-2)' }}>{preis.verguenstigt} × {geld(info.preis_verguenstigt)} + {preis.normal} × {geld(info.preis_normal)}</div>
              )}
            </div>
            {fehler && <div role="alert"><FehlerText>{fehler}</FehlerText></div>}
            <Knopf voll onClick={reservieren} disabled={sendet} style={{ height: 60, fontSize: 19 }}>{T('tk_jetzt_reservieren')}</Knopf>
          </div>
        )}
    </Blatt>
  )
}

const rund = { width: 64, height: 64, borderRadius: 32, padding: 0 }
