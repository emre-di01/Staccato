// Abendkasse: neu verkaufen (ohne Namen) oder per Namen kassieren bzw. bezahlte Tickets einlassen
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Banknote, CircleCheck, Minus, Plus, Ticket, UserSearch } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { Seite, Segment, Suchfeld, Gruppe, Trenner, Zeile, Knopf, Leer, Laden, Blatt, FehlerText } from '../../ui'
import { useBasis } from '../rolle'
import { useNeuLaden } from '../daten'
import { useKassenEvents, sicherAusfuehren, geldKurz, tagAusgeschrieben } from '../tickets'

const GRUENDE = ['schon_drin', 'geschlossen', 'anzahl', 'zu_wenig_frei', 'betrag', 'nicht_offen', 'verfallen', 'verboten', 'netz']

export default function Kasse() {
  const { T, lang } = useApp()
  const basis = useBasis()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { data: events = [], isLoading, isError } = useKassenEvents()
  const offene = events.filter(e => e.offen)
  const ev = params.get('event') ? events.find(e => e.id === params.get('event')) : (events.length === 1 ? events[0] : offene.length === 1 ? offene[0] : null)
  const zurueck = params.get('event') ? { onClick: () => window.history.state?.idx > 0 ? navigate(-1) : navigate(basis), label: T('back') } : { to: basis, label: T('n_tab_start') }

  if (isLoading) return <Seite titel={T('ka_titel')} zurueck={zurueck}><div style={{ marginTop: 20 }}><Laden hoehe={240} /></div></Seite>
  if (isError) return <Seite titel={T('ka_titel')} zurueck={zurueck}><div style={{ margin: 20 }}><FehlerText>{T('tk_laden_fehler')}</FehlerText></div></Seite>
  if (!ev) return (
    <Seite titel={T('ka_titel')} zurueck={zurueck}>
      <div style={{ marginTop: 20 }}>
        {events.length === 0 ? <Leer text={T('ka_keine')} /> : (
          <Gruppe>{events.map((e, i) => <div key={e.id}>{i > 0 && <Trenner />}<Zeile icon={Banknote} titel={e.titel} untertitel={tagAusgeschrieben(e.beginn, e.zeitzone, lang)} to={`/kasse?event=${e.id}`} /></div>)}</Gruppe>
        )}
      </div>
    </Seite>
  )
  return <KasseEvent key={ev.id} ev={ev} zurueck={zurueck} />
}

function KasseEvent({ ev, zurueck }) {
  const { T, lang } = useApp()
  const neuLaden = useNeuLaden()
  const [ansicht, setAnsicht] = useState(ev.offen ? 'neu' : 'reserviert')
  const [erfolg, setErfolg] = useState(null)   // { anzahl, eingelassen }
  const fertig = r => { setErfolg(r); neuLaden('n-kassen-events', 'n-kasse-reservierungen', 'n-scan-events', 'na-ticket-bestellungen') }

  if (erfolg) return <Erfolg r={erfolg} onWeiter={() => setErfolg(null)} />
  return (
    <Seite titel={ev.titel} zurueck={zurueck}>
      <div style={{ margin: '6px 20px 0', fontSize: 18, color: 'var(--text-2)' }}>{T('ka_titel')} · {T('ka_noch_frei').replace('{n}', ev.frei)}</div>
      <Segment label={T('ka_titel')} wert={ansicht} onChange={setAnsicht} style={{ margin: '18px 20px 0' }} optionen={[['neu', T('ka_neu')], ['reserviert', T('ka_reserviert')]]} />
      <div style={{ marginTop: 20 }}>
        {ansicht === 'reserviert' ? <Reserviert ev={ev} onFertig={fertig} />
          : ev.offen ? <NeuVerkaufen ev={ev} onFertig={fertig} />
          : <p role="status" style={{ margin: '8px 20px', fontSize: 18, fontWeight: 600 }}>{T('ka_offen_ab').replace('{zeit}', tagAusgeschrieben(ev.ab, ev.zeitzone, lang))}</p>}
      </div>
      {ev.kassiert > 0 && <div style={{ margin: '28px 20px 0', textAlign: 'center', fontSize: 16, color: 'var(--text-2)' }}>{T('ka_kassiert').replace('{betrag}', geldKurz(ev.kassiert, lang))}</div>}
    </Seite>
  )
}

function useKassenAktion() {
  const { T } = useApp()
  const [sendet, setSendet] = useState(false)
  const [fehler, setFehler] = useState('')
  const [netz, setNetz] = useState(false)
  async function ausfuehren(name, werte) {
    setSendet(true)
    setFehler('')
    const r = await sicherAusfuehren(name, werte)
    setSendet(false)
    setNetz(r.grund === 'netz')
    if (r.ok) return r
    setFehler(T(`ka_fehler_${GRUENDE.includes(r.grund) ? r.grund : 'netz'}`))
    return null
  }
  return { sendet, fehler, netz, ausfuehren, setFehler }
}

function NeuVerkaufen({ ev, onFertig }) {
  const { T, lang } = useApp()
  const neuLaden = useNeuLaden()
  const { sendet, fehler, netz, ausfuehren, setFehler } = useKassenAktion()
  const [gewaehlt, setGewaehlt] = useState(1)
  // bleibt bei Wiederholung nach Netzfehler gleich, damit nichts doppelt verkauft wird
  const [vorgang, setVorgang] = useState(() => crypto.randomUUID())
  const [unklar, setUnklar] = useState(false)      // Netzfehler: Anzahl erst nach Klärung änderbar
  const max = Math.min(ev.frei, 50)
  const anzahl = unklar ? gewaehlt : Math.max(1, Math.min(gewaehlt, max))
  const betrag = Math.round(ev.preis * 100) * anzahl / 100

  if (max < 1 && !unklar) return <p role="status" style={{ margin: '8px 20px', fontSize: 21, fontWeight: 700, textAlign: 'center' }}>{T('tk_grund_ausverkauft')}</p>

  async function verkaufen() {
    setGewaehlt(anzahl)
    setUnklar(true)
    const r = await ausfuehren('abendkasse_verkaufen', { p_event_id: ev.id, p_anzahl: anzahl, p_betrag: betrag, p_vorgang: vorgang })
    if (r) { setUnklar(false); setVorgang(crypto.randomUUID()); setGewaehlt(1); onFertig({ anzahl: r.anzahl, eingelassen: true }) }
  }
  function aendern(n) {
    setFehler('')
    setGewaehlt(n)
  }
  // Der Server hat abgelehnt, es wurde nichts gebucht
  function neuBeginnen() {
    setUnklar(false); setFehler(''); setGewaehlt(1); setVorgang(crypto.randomUUID())
    neuLaden('n-kassen-events')
  }

  return (
    <div style={{ margin: '0 20px', padding: 24, borderRadius: 24, background: 'var(--n-fill)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <Knopf variante="rahmen" aria-label={T('tk_weniger')} style={rund} disabled={unklar || anzahl <= 1} onClick={() => aendern(anzahl - 1)}><Minus aria-hidden="true" size={30} /></Knopf>
        <span aria-live="polite" style={{ minWidth: 64, textAlign: 'center', fontSize: 44, fontWeight: 800 }}>{anzahl}</span>
        <Knopf variante="rahmen" aria-label={T('tk_mehr')} style={rund} disabled={unklar || anzahl >= max} onClick={() => aendern(anzahl + 1)}><Plus aria-hidden="true" size={30} /></Knopf>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800 }}>{T('tk_zusammen').replace('{betrag}', geldKurz(betrag, lang))}</div>
      {fehler && <div role="alert"><FehlerText>{fehler}</FehlerText></div>}
      <Knopf voll icon={Banknote} onClick={verkaufen} disabled={sendet} style={{ height: 64, fontSize: 20 }}>{T(betrag > 0 ? 'tk_geld_erhalten' : 'ka_einlassen').replace('{betrag}', geldKurz(betrag, lang))}</Knopf>
      {/* Nach einem Netzfehler ist offen, ob gebucht wurde: dann nur derselbe Vorgang nochmal */}
      {unklar && !sendet && fehler && !netz && <Knopf voll variante="rahmen" onClick={neuBeginnen}>{T('ka_neu_beginnen')}</Knopf>}
    </div>
  )
}

function Reserviert({ ev, onFertig }) {
  const { T, lang } = useApp()
  const [suche, setSuche] = useState('')
  const [gewaehlt, setGewaehlt] = useState(null)
  const { data: liste = [], isLoading, isError } = useQuery({
    queryKey: ['n-kasse-reservierungen', ev.id],
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('abendkasse_reservierungen', { p_event_id: ev.id })
      if (error) throw error
      return data
    },
  })
  const q = suche.trim().toLowerCase()
  const treffer = liste.filter(r => !q || r.name.toLowerCase().includes(q))
  return (
    <>
      <Suchfeld wert={suche} onChange={setSuche} label={T('nm_suchen')} placeholder={T('nm_suchen_platzhalter')} />
      <div style={{ marginTop: 14 }}>
        {isLoading ? <Laden hoehe={200} /> : isError ? <div style={{ margin: '0 20px' }}><FehlerText>{T('tk_laden_fehler')}</FehlerText></div>
          : treffer.length === 0 ? <Leer text={T('ka_keine_reservierung')} /> : (
            <Gruppe>
              {treffer.map((r, i) => (
                <div key={r.id}>
                  {i > 0 && <Trenner />}
                  <Zeile icon={UserSearch} titel={r.name} untertitel={r.anzahl === 1 ? T('tk_1_ticket') : T('tk_x_tickets').replace('{n}', r.anzahl)} onClick={() => setGewaehlt(r)}
                    wert={r.status === 'bezahlt' ? T('tk_filter_bezahlt') : geldKurz(r.betrag, lang)} wertFarbe={r.status === 'bezahlt' ? 'var(--success)' : 'var(--text)'} />
                </div>
              ))}
            </Gruppe>
          )}
      </div>
      {gewaehlt && (gewaehlt.status === 'bezahlt'
        ? <EinlassenBlatt r={gewaehlt} ev={ev} onClose={() => setGewaehlt(null)} onFertig={x => { setGewaehlt(null); onFertig(x) }} />
        : <KassierenBlatt r={gewaehlt} offen={ev.offen} onClose={() => setGewaehlt(null)} onFertig={x => { setGewaehlt(null); onFertig(x) }} />)}
    </>
  )
}

function KassierenBlatt({ r, offen, onClose, onFertig }) {
  const { T, lang } = useApp()
  const { sendet, fehler, ausfuehren } = useKassenAktion()
  async function kassieren() {
    const x = await ausfuehren('abendkasse_kassieren', { p_bestellung_id: r.id, p_betrag: r.betrag })
    if (x) onFertig(x)
  }
  return (
    <Blatt titel={r.name} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14 }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>{r.anzahl === 1 ? T('tk_1_ticket') : T('tk_x_tickets').replace('{n}', r.anzahl)}</div>
        <div style={{ fontSize: 40, fontWeight: 800 }}>{geldKurz(r.betrag, lang)}</div>
        {!offen && <div style={{ fontSize: 16, color: 'var(--text-2)' }}>{T('ka_vorher_hinweis')}</div>}
        {fehler && <div role="alert"><FehlerText>{fehler}</FehlerText></div>}
        <Knopf voll icon={Banknote} onClick={kassieren} disabled={sendet} style={{ height: 64, fontSize: 20 }}>{T('tk_geld_erhalten').replace('{betrag}', geldKurz(r.betrag, lang))}</Knopf>
      </div>
    </Blatt>
  )
}

// Schon bezahlt, aber ohne Handy und Ausdruck
function EinlassenBlatt({ r, ev, onClose, onFertig }) {
  const { T, lang } = useApp()
  const neuLaden = useNeuLaden()
  const { sendet, fehler, netz, ausfuehren } = useKassenAktion()
  const [anzahl, setAnzahl] = useState(r.anzahl)
  const [versucht, setVersucht] = useState(false)   // nach einem Netzfehler dieselben Tickets wiederholen
  async function einlassen() {
    setVersucht(true)
    const x = await ausfuehren('abendkasse_einlassen', { p_bestellung_id: r.id, p_ticket_ids: r.ticket_ids.slice(0, anzahl) })
    if (x) onFertig({ anzahl: x.anzahl, eingelassen: true })
    else neuLaden('n-kasse-reservierungen')
  }
  return (
    <Blatt titel={r.name} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--success)' }}>{T('tk_filter_bezahlt')}</div>
        {!ev.offen ? <p role="status" style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{T('ka_offen_ab').replace('{zeit}', tagAusgeschrieben(ev.ab, ev.zeitzone, lang))}</p> : <>
          {r.anzahl > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <Knopf variante="rahmen" aria-label={T('tk_weniger')} style={rund} disabled={versucht || anzahl <= 1} onClick={() => setAnzahl(anzahl - 1)}><Minus aria-hidden="true" size={30} /></Knopf>
              <span aria-live="polite" style={{ minWidth: 64, fontSize: 44, fontWeight: 800 }}>{anzahl}</span>
              <Knopf variante="rahmen" aria-label={T('tk_mehr')} style={rund} disabled={versucht || anzahl >= r.anzahl} onClick={() => setAnzahl(anzahl + 1)}><Plus aria-hidden="true" size={30} /></Knopf>
            </div>
          )}
          {fehler && <div role="alert"><FehlerText>{fehler}</FehlerText></div>}
          <Knopf voll icon={CircleCheck} onClick={einlassen} disabled={sendet || (!!fehler && !netz)} style={{ height: 64, fontSize: 20 }}>{T(anzahl === 1 ? 'ka_einlassen_1' : 'ka_einlassen_n').replace('{n}', anzahl)}</Knopf>
        </>}
      </div>
    </Blatt>
  )
}

function Erfolg({ r, onWeiter }) {
  const { T } = useApp()
  const Icon = r.eingelassen ? CircleCheck : Ticket
  return (
    <div role="status" style={{ position: 'fixed', inset: 0, zIndex: 998, background: '#15803D', color: '#FFFFFF', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 18, padding: 24 }}>
      <Icon aria-hidden="true" size={140} strokeWidth={2.2} />
      <div style={{ fontSize: 38, fontWeight: 800, lineHeight: 1.15 }}>
        {r.eingelassen ? T(r.anzahl === 1 ? 'ka_einlassen_1' : 'ka_einlassen_n').replace('{n}', r.anzahl) : T('tk_geld_bestaetigt')}
      </div>
      <div style={{ fontSize: 22, fontWeight: 600 }}>{T(r.eingelassen ? 'ka_stempel' : 'ka_ticket_gueltig')}</div>
      <button onClick={onWeiter} autoFocus style={{ width: 'min(360px, 100%)', height: 64, marginTop: 20, borderRadius: 16, border: 'none', background: '#FFFFFF', color: '#111114', fontFamily: 'inherit', fontSize: 20, fontWeight: 800, cursor: 'pointer' }}>{T('ei_weiter')}</button>
    </div>
  )
}

const rund = { width: 64, height: 64, borderRadius: 32, padding: 0 }
