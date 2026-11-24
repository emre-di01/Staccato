// Bestellung über den persönlichen Link (/shop/bestellung/:zugang): Rückkehr von Stripe, Tickets ansehen
import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CircleCheck, Printer } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { Knopf, Laden, Leer } from '../../ui'
import { geldKurz, tagAusgeschrieben } from '../tickets'
import { TicketKarte, useTicketBilder, useTicketDruck } from '../ticketKarte'
import ShopRahmen, { h1 } from './Rahmen'
import { shopAufruf } from './daten'

const nutzbar = t => t.status === 'gueltig' || t.status === 'demo'
const ABSTAND = 3000
const VERSUCHE = 20   // rund eine Minute auf die Bestätigung warten

// Nie eine Rückzahlung versprechen, die es nicht gibt
function stornoText(o, T, lang) {
  if (o.zurueck > 0) return T('shop_zurueck').replace('{betrag}', geldKurz(o.zurueck, lang))
  return o.automatisch ? T('shop_storniert_text') : T('shop_storniert_frage').replace('{schule}', () => o.schule.name)
}

export default function Bestellung() {
  const { T, lang } = useApp()
  const { zugang } = useParams()
  const [params, setParams] = useSearchParams()
  const abbruch = params.get('abbruch') === '1'
  const [o, setO] = useState(null)
  const [versuch, setVersuch] = useState(0)
  const [neu, setNeu] = useState(0)   // von Hand erneut laden

  // Abgebrochen: Plätze sofort freigeben. Sonst laden, bis die Zahlung bestätigt ist.
  useEffect(() => {
    let aktuell = true
    let uhr
    const laden = async i => {
      const r = await shopAufruf(abbruch && i === 0 ? 'abbrechen' : 'bestellung', { zugang })
      if (!aktuell) return
      setO(alt => r.ok || !alt?.ok ? r : alt)
      setVersuch(i)
      if ((r.status === 'reserviert' || r.grund === 'netz' || r.grund === 'fehler') && i < VERSUCHE) uhr = setTimeout(() => laden(i + 1), ABSTAND)
    }
    laden(0)
    return () => { aktuell = false; clearTimeout(uhr) }
  }, [zugang, abbruch, neu])

  if (!o) return <ShopRahmen><Laden hoehe={320} /></ShopRahmen>
  if (!o.ok) {
    if (o.grund === 'nicht_gefunden') return <ShopRahmen><Leer text={T('shop_bestellung_unbekannt')} /></ShopRahmen>
    return <ShopRahmen><Leer text={T('shop_fehler_netz')}><Knopf onClick={() => { setO(null); setNeu(x => x + 1) }}>{T('shop_nochmal')}</Knopf></Leer></ShopRahmen>
  }
  return (
    <ShopRahmen schule={o.schule} testmodus={o.demo} titel={[o.event.titel, o.schule.name].join(' – ')}>
      {o.status === 'bezahlt' ? <Bezahlt o={o} />
        : o.status === 'reserviert' ? (versuch < VERSUCHE
          ? <Meldung titel={T('shop_pruefen')} text={T('shop_pruefen_text')} laedt />
          : <Meldung titel={T('shop_offen')} text={T('shop_offen_text')}>
              <Knopf voll onClick={() => { setVersuch(0); setNeu(x => x + 1) }}>{T('shop_nochmal')}</Knopf>
              <Knopf voll variante="sekundaer" onClick={() => setParams({ abbruch: '1' }, { replace: true })}>{T('shop_abbrechen')}</Knopf>
            </Meldung>)
        : o.status === 'storniert' ? <Meldung titel={T('shop_storniert')} text={stornoText(o, T, lang)}><Zurueck o={o} /></Meldung>
        : <Meldung titel={T(abbruch ? 'shop_abgebrochen' : 'shop_abgelaufen')} text={T('shop_nichts_bezahlt')}><Zurueck o={o} /></Meldung>}
    </ShopRahmen>
  )
}

function Zurueck({ o }) {
  const { T } = useApp()
  const navigate = useNavigate()
  return o.slug && <Knopf voll onClick={() => navigate(`/shop/${o.slug}?event=${o.event.id}`)}>{T('shop_zum_shop')}</Knopf>
}

function Meldung({ titel, text, laedt, children }) {
  return (
    <section role="status" style={{ padding: 24, borderRadius: 24, background: 'var(--n-fill)', textAlign: 'center' }}>
      <h1 style={{ ...h1, fontSize: 26 }}>{titel}</h1>
      <p style={{ margin: '10px 0 0', fontSize: 18, lineHeight: 1.45, color: 'var(--text-2)' }}>{text}</p>
      {laedt && <div style={{ marginTop: 18 }}><Laden hoehe={12} /></div>}
      {children && <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>}
    </section>
  )
}

function Bezahlt({ o }) {
  const { T, lang } = useApp()
  const alle = o.tickets.filter(t => t.code).map((ticket, i) => ({ ticket, nr: i + 1 }))
  const gueltige = alle.filter(x => nutzbar(x.ticket))
  const storniert = o.tickets.filter(t => t.status === 'storniert').length
  const rest = { anzahl: alle.length, event: o.event, schule: o.schule }
  const bilder = useTicketBilder(gueltige, rest)
  const { druckt, drucken } = useTicketDruck(gueltige, rest)
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <CircleCheck aria-hidden="true" size={40} color="var(--success)" style={{ flexShrink: 0 }} />
        <h1 style={h1}>{T('shop_bezahlt')}</h1>
      </div>
      <p style={{ margin: '10px 0 0', fontSize: 18, lineHeight: 1.45 }}>{T('shop_bezahlt_text').replace('{email}', () => o.email)}</p>
      <div style={{ marginTop: 18, fontSize: 22, fontWeight: 800, overflowWrap: 'anywhere' }}>{o.event.titel}</div>
      <div style={{ marginTop: 4, fontSize: 18, lineHeight: 1.4, color: 'var(--text-2)' }}>{tagAusgeschrieben(o.event.beginn, o.schule.zeitzone, lang)}{o.event.ort && <><br />{o.event.ort}</>}</div>
      {gueltige.length > 0 && <Knopf voll variante="sekundaer" icon={Printer} onClick={drucken} disabled={druckt} style={{ marginTop: 16 }}>{T(gueltige.length === 1 ? 'tk_drucken_1' : 'tk_drucken')}</Knopf>}
      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {alle.map(x => <TicketKarte key={x.ticket.id} x={x} anzahl={alle.length} schule={o.schule} bild={bilder[x.ticket.id]} nutzbar={nutzbar(x.ticket)} />)}
        {storniert > 0 && <div style={{ textAlign: 'center', fontSize: 16, color: 'var(--text-2)' }}>{T('tk_x_storniert').replace('{n}', storniert)}{o.zurueck > 0 && <><br />{T('shop_zurueck').replace('{betrag}', geldKurz(o.zurueck, lang))}</>}</div>}
      </div>
    </>
  )
}
