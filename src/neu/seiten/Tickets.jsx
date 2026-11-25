import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Printer, Ticket } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { Seite, Abschnitt, Gruppe, Trenner, Zeile, Knopf, Leer, Laden, FehlerText } from '../../ui'
import { useBasis } from '../rolle'
import { BezahlenHinweis, ReservierenBlatt } from '../EventTickets'
import { TicketKarte, useTicketBilder, useTicketDruck } from '../ticketKarte'
import { useMeineTickets, useTicketVerkauf, ticketsNachEvent, tagAusgeschrieben } from '../tickets'

// Eigene Tickets. Gibt es nur eine kommende Veranstaltung, erscheinen ihre Tickets sofort.
export default function NeuTickets() {
  const { T, lang } = useApp()
  const basis = useBasis()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { data, isLoading, isLoadingError: isError } = useMeineTickets()

  const gruppen = ticketsNachEvent(data)
  const kommend = gruppen.filter(g => !g.vergangen)
  const vergangen = gruppen.filter(g => g.vergangen).reverse()
  const gewaehlt = params.get('event') ? gruppen.find(g => g.event.id === params.get('event')) : (gruppen.length === 1 ? gruppen[0] : null)

  if (gewaehlt) return <EventTicketSeite key={gewaehlt.event.id} g={gewaehlt}
    zurueck={params.get('event') ? { onClick: () => window.history.state?.idx > 0 ? navigate(-1) : navigate(basis), label: T('back') } : { to: `${basis}/ich`, label: T('n_tab_ich') }} />

  const zeile = g => {
    const [text, farbe] = zustand(g, T)
    return <Zeile icon={Ticket} titel={g.event.titel} untertitel={tagAusgeschrieben(g.event.beginn, g.schule.zeitzone, lang)} wert={text} wertFarbe={farbe} to={`/tickets?event=${g.event.id}`} />
  }
  const liste = l => <Gruppe>{l.map((g, i) => <div key={g.event.id}>{i > 0 && <Trenner />}{zeile(g)}</div>)}</Gruppe>
  return (
    <Seite titel={T('tk_meine_tickets')} zurueck={{ to: `${basis}/ich`, label: T('n_tab_ich') }}>
      <div style={{ marginTop: 20 }}>
        {isLoading ? <Laden hoehe={220} /> : isError ? <div style={{ margin: '0 20px' }}><FehlerText>{T('tk_laden_fehler')}</FehlerText></div>
          : kommend.length === 0 ? <Leer text={T('tk_keine_tickets')} /> : liste(kommend)}
      </div>
      {vergangen.length > 0 && <Abschnitt titel={T('tk_vergangene')}>{liste(vergangen)}</Abschnitt>}
    </Seite>
  )
}

function zustand(g, T) {
  if (g.offen.length) return [T('tk_status_bezahlen'), 'var(--primary)']
  if (g.vergangen || !g.tickets.length) return [null, null]
  return g.tickets.some(x => x.ticket.status === 'gueltig') ? [T('tk_status_bereit'), 'var(--success)'] : [T('tk_status_benutzt'), 'var(--text-2)']
}

// Alle Tickets einer Veranstaltung untereinander
function EventTicketSeite({ g, zurueck }) {
  const { T, lang } = useApp()
  const { data: verkauf = [] } = useTicketVerkauf()
  const [mehr, setMehr] = useState(false)
  const gueltige = g.vergangen ? [] : g.tickets.filter(x => x.ticket.status === 'gueltig')
  const sortiert = [...gueltige, ...g.tickets.filter(x => !gueltige.includes(x))]
  const rest = { anzahl: g.tickets.length, event: g.event, schule: g.schule }
  const nachkaufbar = !g.vergangen && verkauf.includes(g.event.id)
  const bilder = useTicketBilder(gueltige, rest)
  const { druckt, drucken } = useTicketDruck(gueltige, rest)

  return (
    <Seite titel={g.event.titel} zurueck={zurueck}>
      <div style={{ margin: '6px 20px 0', fontSize: 18, lineHeight: 1.4, color: 'var(--text-2)' }}>
        {tagAusgeschrieben(g.event.beginn, g.schule.zeitzone, lang)}{g.event.ort && <><br />{g.event.ort}</>}
      </div>
      {(nachkaufbar || gueltige.length > 0) && (
        <div style={{ margin: '16px 20px 0', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {nachkaufbar && <Knopf variante="tint" icon={Plus} onClick={() => setMehr(true)} style={obenKnopf}>{T('tk_weitere')}</Knopf>}
          {gueltige.length > 0 && <Knopf variante="sekundaer" icon={Printer} onClick={drucken} disabled={druckt} style={obenKnopf}>{T(gueltige.length === 1 ? 'tk_drucken_1' : 'tk_drucken')}</Knopf>}
        </div>
      )}
      <div style={{ margin: '20px 20px 0', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {g.offen.map(o => (
          <section key={o.id} style={{ padding: 22, borderRadius: 24, background: 'var(--n-fill)', textAlign: 'center' }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-2)' }}>{o.anzahl === 1 ? T('tk_1_ticket') : T('tk_x_tickets').replace('{n}', o.anzahl)}</div>
            <BezahlenHinweis betrag={o.betrag} frist={o.frist} tz={g.schule.zeitzone} style={{ marginTop: 6, fontSize: 21 }} />
          </section>
        ))}
        {sortiert.map(x => <TicketKarte key={x.ticket.id} x={x} anzahl={g.tickets.length} schule={g.schule} bild={bilder[x.ticket.id]} nutzbar={gueltige.includes(x)} />)}
        {g.storniert > 0 && <div style={{ textAlign: 'center', fontSize: 16, color: 'var(--text-2)' }}>{T('tk_x_storniert').replace('{n}', g.storniert)}</div>}
      </div>
      {mehr && <ReservierenBlatt ev={g.event} onClose={() => setMehr(false)} />}
    </Seite>
  )
}

const obenKnopf = { flex: '1 1 160px' }
