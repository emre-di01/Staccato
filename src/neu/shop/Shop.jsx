// Öffentlicher Ticketshop einer Schule (/shop/:slug): Veranstaltung wählen, kaufen, weiter zu Stripe oder SumUp
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, Minus, Plus, Ticket } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { Feld, FehlerText, Knopf, Laden, Leer, eingabeStil } from '../../ui'
import { geldKurz, tagAusgeschrieben } from '../tickets'
import { ANBIETER } from '../ticketshop'
import LangerText from '../LangerText'
import ShopRahmen, { h1, textKnopf } from './Rahmen'
import { bildAdresse, emailGueltig, fehlerText, nameGueltig, shopAufruf, summe } from './daten'

const INFOS = ['impressum', 'agb', 'datenschutz']
const ANSICHTEN = [...INFOS, 'nochmal']

export default function Shop() {
  const { T } = useApp()
  const { slug } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { data: d, isLoading, refetch } = useQuery({ queryKey: ['shop', slug], queryFn: () => shopAufruf('info', { slug }), staleTime: 0, gcTime: 0 })

  const eventId = params.get('event')
  const info = ANSICHTEN.includes(params.get('info')) ? params.get('info') : null
  const gehe = werte => setParams(Object.fromEntries(Object.entries({ event: eventId, ...werte }).filter(([, w]) => w)))
  const zurueck = werte => window.history.state?.idx > 0 ? navigate(-1) : gehe(werte)
  useEffect(() => { window.scrollTo?.(0, 0) }, [eventId, info])

  if (isLoading) return <ShopRahmen><Laden hoehe={320} /></ShopRahmen>
  if (!d?.ok) {
    return (
      <ShopRahmen>
        {d?.grund === 'nicht_gefunden' ? <Leer text={T('shop_nicht_gefunden')} /> : <Leer text={T('shop_fehler_netz')}><Knopf onClick={() => refetch()}>{T('shop_nochmal')}</Knopf></Leer>}
      </ShopRahmen>
    )
  }
  const einziges = d.events.length === 1 ? d.events[0] : null
  const ev = d.events.find(e => e.id === eventId) ?? einziges
  return (
    <ShopRahmen schule={d.schule} testmodus={d.testmodus} titel={[ev?.titel ?? T('tk_tickets'), d.schule.name].join(' – ')}
      fuss={['nochmal', ...INFOS].map(i => <button key={i} onClick={() => gehe({ info: i })} style={textKnopf}>{T(i === 'nochmal' ? 'shop_erneut' : `shop_${i}`)}</button>)}>
      {info && (
        <section>
          <Zurueck onClick={() => zurueck({ info: null })}>{T('back')}</Zurueck>
          <h1 style={h1}>{T(info === 'nochmal' ? 'shop_erneut' : `shop_${info}`)}</h1>
          {info === 'nochmal' ? <Nochmal slug={slug} /> : <div style={{ marginTop: 16, fontSize: 17, lineHeight: 1.6, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{d[info]}</div>}
        </section>
      )}
      {/* bleibt beim Lesen der Rechtstexte erhalten, damit keine Eingaben verloren gehen */}
      <div hidden={!!info}>
        {ev ? (
          <>
            {!einziges && <Zurueck onClick={() => zurueck({ event: null })}>{T('shop_alle')}</Zurueck>}
            <Kauf key={ev.id} ev={ev} demo={d.testmodus} anbieter={d.anbieter} tz={d.schule.zeitzone} onInfo={i => gehe({ info: i })} onNeuLaden={refetch} />
          </>
        ) : <EventListe events={d.events} tz={d.schule.zeitzone} onWahl={id => gehe({ event: id })} />}
      </div>
    </ShopRahmen>
  )
}

function Zurueck({ onClick, children }) {
  return (
    <button onClick={onClick} style={{ ...textKnopf, display: 'inline-flex', alignItems: 'center', gap: 2, minHeight: 44, margin: '-8px 0 4px -6px', fontSize: 17, fontWeight: 600, color: 'var(--primary)' }}>
      <ChevronLeft aria-hidden="true" size={24} />{children}
    </button>
  )
}

// Mail verloren: Tickets nochmal an die beim Kauf angegebene Adresse
function Nochmal({ slug }) {
  const { T } = useApp()
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')
  const [stand, setStand] = useState(null)   // null | 'sendet' | 'fertig'
  const [fehler, setFehler] = useState('')
  async function senden(e) {
    e.preventDefault()
    if (stand === 'sendet') return
    if (!emailGueltig(email)) { setFehler(T('shop_fehler_email')); return }
    setFehler('')
    setStand('sendet')
    const r = await shopAufruf('nochmal', { slug, email: email.trim(), website })
    setStand(r?.ok ? 'fertig' : null)
    if (!r?.ok) setFehler(r?.grund === 'kein_mailversand' ? T('shop_kein_mailversand') : fehlerText(T, r?.grund === 'fehler' ? 'allgemein' : r?.grund))
  }
  // Absichtlich gleich, ob es Tickets gibt oder nicht
  if (stand === 'fertig') return <div role="status" style={{ marginTop: 16, padding: 20, borderRadius: 18, background: 'var(--n-fill)', fontSize: 18, lineHeight: 1.5 }}>{T('shop_erneut_fertig')}</div>
  return (
    <form onSubmit={senden} noValidate style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Feld label={T('shop_email')} hinweis={T('shop_erneut_hinweis')}>
        <input value={email} onChange={e => setEmail(e.target.value)} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" maxLength={200} style={eingabeStil} />
      </Feld>
      <Falle wert={website} onChange={setWebsite} />
      {fehler && <FehlerText>{fehler}</FehlerText>}
      <Knopf voll type="submit" disabled={stand === 'sendet'} style={{ height: 56 }}>{T(stand === 'sendet' ? 'shop_moment' : 'shop_erneut_senden')}</Knopf>
    </form>
  )
}

// unsichtbares Feld, nur Bots füllen es aus
function Falle({ wert, onChange }) {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', left: -9999, width: 1, height: 1, overflow: 'hidden' }}>
      <input tabIndex={-1} autoComplete="off" name="website" value={wert} onChange={e => onChange(e.target.value)} />
    </div>
  )
}

// Titelbild; lässt es sich nicht laden, bleibt die Stelle leer. `ganz`: ungekürzt, damit man ein Plakat lesen kann
function Plakat({ url, ganz, style }) {
  const src = bildAdresse(url)
  const [kaputt, setKaputt] = useState(null)
  if (!src || kaputt === src) return null
  return <img src={src} alt="" onError={() => setKaputt(src)} style={{ display: 'block', borderRadius: 20, ...(ganz ? { maxWidth: '100%', maxHeight: 560, margin: '0 auto' } : { width: '100%', objectFit: 'cover' }), ...style }} />
}

// null = kaufbar
function hinweis(lage, tz, lang, T) {
  if (lage.grund === 'noch_nicht') return T('shop_ab').replace('{zeit}', tagAusgeschrieben(lage.verkauf_von, tz, lang))
  return lage.ok ? null : T(lage.grund === 'ausverkauft' ? 'shop_ausverkauft' : 'shop_beendet')
}

function EventListe({ events, tz, onWahl }) {
  const { T, lang } = useApp()
  if (!events.length) return <Leer text={T('shop_leer')} />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {events.map(ev => {
        const zu = hinweis(ev.lage, tz, lang, T)
        return (
          <article key={ev.id} style={{ borderRadius: 24, background: 'var(--n-fill)', overflow: 'hidden' }}>
            <Plakat url={ev.bild_url} style={{ borderRadius: 0, maxHeight: 320 }} />
            <div style={{ padding: 20 }}>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, lineHeight: 1.2, overflowWrap: 'anywhere' }}>{ev.titel}</h2>
              <div style={{ marginTop: 6, fontSize: 17, lineHeight: 1.4, color: 'var(--text-2)' }}>{tagAusgeschrieben(ev.beginn, tz, lang)}{ev.ort && <><br />{ev.ort}</>}</div>
              <LangerText text={ev.beschreibung} zeilen={3} style={{ marginTop: 10 }} />
              <div style={{ marginTop: 14 }}>
                {zu ? <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-2)' }}>{zu}</div>
                  : <Knopf voll icon={Ticket} onClick={() => onWahl(ev.id)} style={{ height: 56 }}>{T('shop_tickets_ab').replace('{preis}', geldKurz(ev.lage.preis, lang))}</Knopf>}
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}

function Kauf({ ev, demo, anbieter, tz, onInfo, onNeuLaden }) {
  const { T, lang } = useApp()
  const max = ev.lage.max ?? 0
  const [anzahl, setAnzahl] = useState(1)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [agb, setAgb] = useState(false)
  const [website, setWebsite] = useState('')
  const [fehler, setFehler] = useState('')
  const [sendet, setSendet] = useState(false)
  const laeuft = useRef(false)
  const zu = hinweis(ev.lage, tz, lang, T)
  const n = Math.max(1, Math.min(anzahl, max))
  const betrag = summe(n, ev.lage.preis)

  // Mit „Zurück“ von der Bezahlseite gekommen: Knopf wieder freigeben
  useEffect(() => {
    const zeigen = e => { if (e.persisted) { laeuft.current = false; setSendet(false); onNeuLaden() } }
    window.addEventListener('pageshow', zeigen)
    return () => window.removeEventListener('pageshow', zeigen)
  }, [onNeuLaden])

  async function kaufen(e) {
    e.preventDefault()
    if (laeuft.current) return
    if (!nameGueltig(name)) { setFehler(T('shop_fehler_name')); return }
    if (!emailGueltig(email)) { setFehler(T('shop_fehler_email')); return }
    if (!agb) { setFehler(T('shop_fehler_agb')); return }
    laeuft.current = true
    setFehler('')
    setSendet(true)
    const r = await shopAufruf('kaufen', { event_id: ev.id, anzahl: n, betrag, name: name.trim(), email: email.trim(), sprache: lang, agb, website })
    if (r?.ok && r.url) { window.location.assign(r.url); return }
    laeuft.current = false
    setSendet(false)
    setFehler(fehlerText(T, r?.grund))
    if (!['angaben', 'netz', 'fehler', 'zu_viele'].includes(r?.grund)) onNeuLaden()   // Preis oder freie Plätze haben sich geändert
  }

  const rund = { width: 60, height: 60, borderRadius: 30, border: 'none', background: 'var(--bg)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }
  return (
    <div>
      <Plakat url={ev.bild_url} ganz style={{ marginBottom: 18 }} />
      <h1 style={h1}>{ev.titel}</h1>
      <div style={{ marginTop: 8, fontSize: 18, lineHeight: 1.4, color: 'var(--text-2)' }}>{tagAusgeschrieben(ev.beginn, tz, lang)}{ev.ort && <><br />{ev.ort}</>}</div>
      <LangerText text={ev.beschreibung} zeilen={8} style={{ marginTop: 14 }} />
      {zu ? <div role="status" style={{ marginTop: 20, padding: 20, borderRadius: 18, background: 'var(--n-fill)', fontSize: 19, fontWeight: 700, textAlign: 'center' }}>{zu}</div> : (
        <form onSubmit={kaufen} noValidate style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ padding: 20, borderRadius: 24, background: 'var(--n-fill)', textAlign: 'center' }}>
            <div style={{ fontSize: 19, fontWeight: 700 }}>{T('shop_wie_viele')}</div>
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
              <button type="button" aria-label={T('shop_weniger')} disabled={n <= 1} onClick={() => setAnzahl(n - 1)} style={{ ...rund, opacity: n <= 1 ? 0.4 : 1 }}><Minus size={28} /></button>
              <output aria-live="polite" style={{ minWidth: 56, fontSize: 40, fontWeight: 800 }}>{n}</output>
              <button type="button" aria-label={T('shop_mehr')} disabled={n >= max} onClick={() => setAnzahl(n + 1)} style={{ ...rund, opacity: n >= max ? 0.4 : 1 }}><Plus size={28} /></button>
            </div>
            <div style={{ marginTop: 12, fontSize: 19 }}>{T('shop_zusammen')} <b>{geldKurz(betrag, lang)}</b></div>
            {ev.lage.knapp && <div style={{ marginTop: 6, fontSize: 16, color: 'var(--text-2)' }}>{T(ev.lage.knapp === 1 ? 'shop_noch_1' : 'shop_noch').replace('{n}', ev.lage.knapp)}</div>}
          </div>
          <Feld label={T('shop_name')}><input value={name} onChange={e => setName(e.target.value)} autoComplete="name" maxLength={80} style={eingabeStil} /></Feld>
          <Feld label={T('shop_email')} hinweis={T('shop_email_hinweis')}>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" maxLength={200} style={eingabeStil} />
          </Feld>
          <Falle wert={website} onChange={setWebsite} />
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <input id="shop-agb" type="checkbox" checked={agb} onChange={e => setAgb(e.target.checked)} style={{ width: 28, height: 28, flexShrink: 0, accentColor: 'var(--primary)' }} />
            <div style={{ fontSize: 17, lineHeight: 1.45 }}>
              <label htmlFor="shop-agb">{T('shop_agb_text')}</label>{' '}
              <button type="button" onClick={() => onInfo('agb')} style={linkKnopf}>{T('shop_agb_lesen')}</button>{' · '}
              <button type="button" onClick={() => onInfo('datenschutz')} style={linkKnopf}>{T('shop_datenschutz_lesen')}</button>
            </div>
          </div>
          {fehler && <FehlerText>{fehler}</FehlerText>}
          {/* „kaufen“: eindeutige Bezeichnung nach § 312j BGB */}
          <Knopf voll type="submit" disabled={sendet} style={{ height: 60, fontSize: 19 }}>{sendet ? T('shop_moment') : T('shop_kaufen').replace('{betrag}', geldKurz(betrag, lang))}</Knopf>
          <div style={{ fontSize: 15, color: 'var(--text-2)', textAlign: 'center' }}>{T('shop_stripe_hinweis').replaceAll('{anbieter}', ANBIETER[anbieter] ?? ANBIETER.stripe)}</div>
          {demo && <div style={{ padding: 14, borderRadius: 14, background: '#FDE68A', color: '#422006', fontSize: 16, lineHeight: 1.45 }}>{T(anbieter === 'sumup' ? 'shop_demo_karte_sumup' : 'shop_demo_karte')}</div>}
        </form>
      )}
    </div>
  )
}

const linkKnopf = { background: 'none', border: 'none', padding: 0, fontFamily: 'inherit', fontSize: 17, color: 'var(--primary)', textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer' }
