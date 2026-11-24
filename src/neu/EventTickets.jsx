// Tickets einer Veranstaltung für Mitglieder: Knopf auf der Terminkarte und Blatt zum Reservieren
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Minus, Plus, QrCode, Ticket } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { Blatt, Knopf, Gruppe, Trenner, Zeile, Laden, FehlerText } from '../ui'
import { useNeuLaden } from './daten'
import { tagLabel, uhrzeit } from './zeit'
import { useTicketVerkauf, useMeineBestellungen, useTicketInfo, preisBerechnen, aktiveBestellungen, euro } from './tickets'

const GRUENDE = ['nicht_verfuegbar', 'kein_mitglied', 'noch_nicht', 'beendet', 'ausverkauft', 'obergrenze', 'zu_wenig_frei', 'preis_geaendert', 'anzahl']

function useTexte() {
  const { T, lang, zeitzone } = useApp()
  return {
    zeitpunkt: iso => `${tagLabel(iso, zeitzone, lang, T)}, ${uhrzeit(iso, zeitzone, lang)}`,
    anzahl: n => n === 1 ? T('tk_1_ticket') : T('tk_x_tickets').replace('{n}', n),
    geld: betrag => euro(betrag, lang),
  }
}

export function EventTickets({ ev }) {
  const { T } = useApp()
  const texte = useTexte()
  const [offen, setOffen] = useState(false)
  const { data: verkauf = [] } = useTicketVerkauf()
  const { data: alle } = useMeineBestellungen()
  const meine = aktiveBestellungen(alle?.filter(b => b.event_id === ev.id))
  if (!verkauf.includes(ev.id) && !meine.length) return null

  const anzahl = meine.reduce((s, b) => s + b.anzahl, 0)
  const unbezahlt = meine.some(b => b.status === 'reserviert')
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Knopf klein variante="tint" icon={Ticket} onClick={() => setOffen(true)}>{T(anzahl ? 'tk_meine_tickets' : 'tk_reservieren')}</Knopf>
        {anzahl > 0 && (
          <span style={{ fontSize: 15, fontWeight: 600, color: unbezahlt ? 'var(--primary)' : 'var(--success)' }}>
            {texte.anzahl(anzahl)} · {T(unbezahlt ? 'tk_noch_bezahlen' : 'tk_bezahlt')}
          </span>
        )}
      </div>
      {offen && <ReservierenBlatt ev={ev} meine={meine} onClose={() => setOffen(false)} />}
    </>
  )
}

function ReservierenBlatt({ ev, meine, onClose }) {
  const { T, toast } = useApp()
  const texte = useTexte()
  const neuLaden = useNeuLaden()
  const navigate = useNavigate()
  const { data: info, isLoading, isError } = useTicketInfo(ev.id)
  const [gewaehlt, setGewaehlt] = useState(1)
  const [sendet, setSendet] = useState(false)
  const [fehler, setFehler] = useState('')

  const anzahl = Math.max(1, Math.min(gewaehlt, info?.max ?? 1))
  const preis = info?.ok ? preisBerechnen(info, anzahl) : null
  const grundText = grund => grund === 'noch_nicht' && info?.verkauf_von
    ? T('tk_grund_noch_nicht').replace('{zeit}', texte.zeitpunkt(info.verkauf_von))
    : T(`tk_grund_${GRUENDE.includes(grund) ? grund : 'nicht_verfuegbar'}`)

  async function reservieren() {
    setSendet(true)
    setFehler('')
    const { data, error } = await supabase.rpc('tickets_reservieren', { p_event_id: ev.id, p_anzahl: anzahl, p_betrag: preis.betrag })
    setSendet(false)
    neuLaden('n-ticket-info', 'n-ticket-bestellungen', 'n-meine-tickets')
    if (error || !data.ok) { setFehler(error ? error.message : grundText(data.grund)); return }
    setGewaehlt(1)
    toast(T(data.status === 'bezahlt' ? 'tk_sofort_gueltig' : 'tk_reserviert'), 'success')
  }

  return (
    <Blatt titel={T('tk_tickets')} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div style={{ fontSize: 19, fontWeight: 700, overflowWrap: 'anywhere' }}>{ev.titel}</div>
          <div style={{ fontSize: 16, color: 'var(--text-2)' }}>{texte.zeitpunkt(ev.beginn)}</div>
        </div>

        {meine.length > 0 && (
          <Gruppe style={{ margin: 0 }}>
            {meine.map((b, i) => (
              <div key={b.id}>
                {i > 0 && <Trenner />}
                <Zeile icon={Ticket} chevron={false} titel={texte.anzahl(b.anzahl)} wert={texte.geld(b.betrag)}
                  untertitel={b.status === 'bezahlt' ? T('tk_bezahlt') : T('tk_bar_bis').replace('{zeit}', texte.zeitpunkt(b.frist))} />
              </div>
            ))}
          </Gruppe>
        )}

        {meine.some(b => b.status === 'bezahlt') && <Knopf voll variante="sekundaer" icon={QrCode} onClick={() => navigate(`/tickets?event=${ev.id}`)}>{T('tk_qr_zeigen')}</Knopf>}

        {isLoading ? <Laden hoehe={160} /> : isError ? <FehlerText>{T('tk_laden_fehler')}</FehlerText>
          : !info.ok ? <p role="status" style={{ margin: 0, fontSize: 17, color: 'var(--text-2)' }}>{grundText(info.grund)}</p> : <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 600 }}>{T('tk_anzahl')}</div>
                <div style={{ fontSize: 15, color: 'var(--text-2)' }}>{T('tk_noch_frei').replace('{n}', info.frei)} · {T('tk_hoechstens').replace('{n}', info.max)}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Knopf klein variante="rahmen" icon={Minus} aria-label={T('tk_weniger')} style={rund} disabled={anzahl <= 1} onClick={() => setGewaehlt(anzahl - 1)} />
                <span aria-live="polite" style={{ minWidth: 36, textAlign: 'center', fontSize: 22, fontWeight: 800 }}>{anzahl}</span>
                <Knopf klein variante="rahmen" icon={Plus} aria-label={T('tk_mehr')} style={rund} disabled={anzahl >= info.max} onClick={() => setGewaehlt(anzahl + 1)} />
              </div>
            </div>

            <Gruppe style={{ margin: 0 }}>
              {preis.verguenstigt > 0 && <>
                <Zeile titel={T('tk_zeile_verguenstigt')} untertitel={`${preis.verguenstigt} × ${texte.geld(info.preis_verguenstigt)}`} wert={texte.geld(preis.verguenstigt * info.preis_verguenstigt)} />
                <Trenner />
              </>}
              {preis.normal > 0 && <>
                <Zeile titel={T('tk_zeile_normal')} untertitel={`${preis.normal} × ${texte.geld(info.preis_normal)}`} wert={texte.geld(preis.normal * info.preis_normal)} />
                <Trenner />
              </>}
              <Zeile titel={T('tk_summe')} wert={texte.geld(preis.betrag)} wertFarbe="var(--text)" />
            </Gruppe>

            {preis.betrag > 0 && <p style={{ margin: 0, fontSize: 16, color: 'var(--text-2)' }}>{T('tk_frist_hinweis').replace('{zeit}', texte.zeitpunkt(info.frist))}</p>}
            <Knopf voll onClick={reservieren} disabled={sendet}>
              {preis.betrag > 0 ? T('tk_fuer_reservieren').replace('{betrag}', texte.geld(preis.betrag)) : T('tk_kostenlos_holen')}
            </Knopf>
          </>}
        {fehler && <div role="alert"><FehlerText>{fehler}</FehlerText></div>}
      </div>
    </Blatt>
  )
}

const rund = { width: 44, padding: 0 }
