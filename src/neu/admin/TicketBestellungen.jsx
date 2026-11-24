// Ticketbestellungen einer Veranstaltung: Geldeingang bestätigen, stornieren, Erstattung festhalten (nur Admins)
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Banknote, Mail, Undo2, XCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { Blatt, Feld, Knopf, Segment, Suchfeld, Gruppe, Trenner, Zeile, Leer, Laden, FehlerText, eingabeStil } from '../../ui'
import { useNeuLaden } from '../daten'
import { tagLabel, uhrzeit } from '../zeit'
import { alleBestellungenLaden, bestellungenAuswerten, betragAus, euro, ticketMailSenden } from '../tickets'
import { Avatar } from './ListeDetail'

const FILTER = ['offen', 'bezahlt', 'erledigt']
const STATUS_FARBE = { gueltig: 'var(--success)', eingeloest: 'var(--success)', reserviert: 'var(--primary)', storniert: 'var(--danger)', verfallen: 'var(--text-2)' }

export function useBestellungen(eventId) {
  return useQuery({ queryKey: ['na-ticket-bestellungen', eventId], enabled: !!eventId, queryFn: () => alleBestellungenLaden(eventId) })
}

function useTexte() {
  const { T, lang, zeitzone } = useApp()
  return {
    zeitpunkt: iso => `${tagLabel(iso, zeitzone, lang, T)}, ${uhrzeit(iso, zeitzone, lang)}`,
    anzahl: n => n === 1 ? T('tk_1_ticket') : T('tk_x_tickets').replace('{n}', n),
    geld: betrag => euro(betrag, lang),
    // „16,00“ für Eingabefelder
    eingabe: betrag => Number(betrag).toFixed(2).replace('.', ','),
    name: b => b.kaeufer?.voller_name ?? b.kaeufer_name ?? T(b.herkunft === 'abendkasse' ? 'tk_abendkasse' : 'tk_konto_geloescht'),
  }
}

export default function TicketBestellungen({ ev, kapazitaet, onClose }) {
  const { T } = useApp()
  const texte = useTexte()
  const { data: bestellungen, isLoading, isError } = useBestellungen(ev.id)
  const [filter, setFilter] = useState('offen')
  const [suche, setSuche] = useState('')
  const [offenId, setOffenId] = useState(null)

  const { liste, stand } = bestellungenAuswerten(bestellungen)
  const offen = liste.find(b => b.id === offenId)
  if (offen) return <BestellungBlatt b={offen} onClose={() => setOffenId(null)} />

  const q = suche.trim().toLowerCase()
  const sichtbar = liste.filter(b => b.gruppe === filter && (!q || texte.name(b).toLowerCase().includes(q)))
  return (
    <Blatt titel={T('tk_bestellungen')} onClose={onClose}>
      {isLoading ? <Laden hoehe={240} /> : isError ? <FehlerText>{T('tk_laden_fehler')}</FehlerText> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Gruppe style={{ margin: 0 }}>
            <Zeile titel={T('tk_belegt')} untertitel={T('tk_belegt_davon').replace('{bezahlt}', stand.gueltig).replace('{offen}', stand.reserviert)} wert={`${stand.gueltig + stand.reserviert} / ${kapazitaet}`} wertFarbe="var(--text)" />
            <Trenner />
            <Zeile titel={T('tk_bar_eingenommen')} untertitel={stand.erstattet > 0 ? T('tk_davon_erstattet').replace('{betrag}', texte.geld(stand.erstattet)) : null} wert={texte.geld(stand.eingenommen)} wertFarbe="var(--text)" />
          </Gruppe>
          <Segment label={T('n_filter')} wert={filter} onChange={setFilter}
            optionen={FILTER.map(f => [f, `${T(`tk_filter_${f}`)} (${liste.filter(b => b.gruppe === f).length})`])} />
          <div style={{ margin: '0 -20px' }}><Suchfeld wert={suche} onChange={setSuche} label={T('nm_suchen')} placeholder={T('nm_suchen_platzhalter')} /></div>
          {sichtbar.length === 0 ? <Leer text={T('tk_keine_bestellungen')} /> : (
            <Gruppe style={{ margin: 0 }}>
              {sichtbar.map((b, i) => (
                <div key={b.id}>
                  {i > 0 && <Trenner />}
                  <Zeile bild={<Avatar name={texte.name(b)} bild={b.kaeufer?.avatar_url} />} titel={texte.name(b)} wert={texte.geld(b.betrag)} wertFarbe="var(--text)" onClick={() => setOffenId(b.id)}
                    untertitel={[texte.anzahl(b.anzahl), b.zustand === 'reserviert' ? T('tk_bis').replace('{zeit}', texte.zeitpunkt(b.frist)) : T(`tk_zustand_${b.zustand}`)].join(' · ')} />
                </div>
              ))}
            </Gruppe>
          )}
        </div>
      )}
    </Blatt>
  )
}

function BestellungBlatt({ b, onClose }) {
  const { T, confirm, toast } = useApp()
  const texte = useTexte()
  const neuLaden = useNeuLaden()
  const [modus, setModus] = useState(null)      // null | 'storno' | 'erstattung'
  const [auswahl, setAuswahl] = useState([])
  const [betrag, setBetrag] = useState('')
  const [sendet, setSendet] = useState(false)
  const [fehler, setFehler] = useState('')

  const stornierbar = b.tickets.filter(t => (b.zustand === 'reserviert' && t.status === 'reserviert') || t.status === 'gueltig' || (t.status === 'eingeloest' && t.an_kasse))
  const summe = ids => b.tickets.filter(t => ids.includes(t.id)).reduce((s, t) => s + Math.round(t.preis * 100), 0) / 100

  async function senden(name, werte, meldung) {
    setSendet(true)
    setFehler('')
    const { data, error } = await supabase.rpc(name, { p_bestellung_id: b.id, ...werte })
    setSendet(false)
    neuLaden('na-ticket-bestellungen', 'n-ticket-bestellungen', 'n-ticket-info', 'n-meine-tickets')
    if (error || !data.ok) { setFehler(error ? error.message : T(`tk_kasse_${data.grund}`)); return false }
    setModus(null)
    toast(T(meldung), 'success')
    return true
  }

  async function mailen() {
    setSendet(true)
    const ok = await ticketMailSenden(b.id)
    setSendet(false)
    toast(T(ok ? 'tk_mail_gesendet' : 'tk_mail_fehler'), ok ? 'success' : 'warning')
  }

  async function bezahlt() {
    const frage = T('tk_geld_frage').replace('{betrag}', texte.geld(b.betrag)).replace('{name}', texte.name(b))
    if (!await confirm(frage, { confirmLabel: T('tk_geld_ja'), dangerous: false })) return
    if (await senden('ticket_zahlung_bestaetigen', { p_betrag: b.betrag }, 'tk_geld_bestaetigt') && b.kaeufer) await mailen()
  }

  function stornoStarten() {
    const ids = stornierbar.map(t => t.id)
    setAuswahl(ids)
    setBetrag(b.zahlung ? texte.eingabe(summe(ids)) : '')
    setFehler('')
    setModus('storno')
  }

  function umschalten(id) {
    const neu = auswahl.includes(id) ? auswahl.filter(x => x !== id) : [...auswahl, id]
    setAuswahl(neu)
    if (b.zahlung) setBetrag(texte.eingabe(summe(neu)))
  }

  async function stornieren() {
    const erstattung = b.zahlung ? betragAus(betrag) ?? 0 : 0
    if (Number.isNaN(erstattung) || erstattung > summe(auswahl)) { setFehler(T('tk_kasse_erstattung')); return }
    if (!auswahl.length) { setFehler(T('tk_kasse_auswahl')); return }
    const frage = T(b.zahlung ? 'tk_storno_frage_bezahlt' : 'tk_storno_frage').replace('{tickets}', texte.anzahl(auswahl.length)).replace('{betrag}', texte.geld(erstattung))
    if (!await confirm(frage, { confirmLabel: T('tk_stornieren') })) return
    senden('tickets_stornieren', { p_ticket_ids: auswahl, p_erstattung: erstattung }, 'tk_storniert')
  }

  async function erstatten() {
    const wert = betragAus(betrag)
    if (!(wert > 0) || wert > b.erstattbar) { setFehler(T('tk_kasse_erstattung')); return }
    senden('ticket_erstattung_erfassen', { p_betrag: wert }, 'tk_erstattung_erfasst')
  }

  return (
    <Blatt titel={texte.name(b)} onClose={modus ? () => { setModus(null); setFehler('') } : onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div style={{ fontSize: 19, fontWeight: 700 }}>{texte.anzahl(b.anzahl)} · {texte.geld(b.betrag)}</div>
          <div style={{ fontSize: 16, color: 'var(--text-2)' }}>
            {b.zustand === 'reserviert' ? T('tk_bar_bis').replace('{zeit}', texte.zeitpunkt(b.frist)) : T(`tk_zustand_${b.zustand}`)}
          </div>
          <div style={{ fontSize: 15, color: 'var(--text-2)' }}>{T('tk_bestellt_am').replace('{zeit}', texte.zeitpunkt(b.erstellt_am))}</div>
        </div>

        {modus !== 'erstattung' && (
          <Gruppe style={{ margin: 0 }}>
            {(modus === 'storno' ? stornierbar : b.tickets).map((t, i) => {
              const titel = T(t.verguenstigt ? 'tk_zeile_verguenstigt' : 'tk_zeile_normal')
              return (
                <div key={t.id}>
                  {i > 0 && <Trenner />}
                  {modus === 'storno' ? (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 56, padding: '0 16px', fontSize: 17, cursor: 'pointer' }}>
                      <input type="checkbox" checked={auswahl.includes(t.id)} onChange={() => umschalten(t.id)} style={{ width: 22, height: 22, accentColor: 'var(--primary)' }} />
                      <span style={{ flex: 1, fontWeight: 600 }}>{titel}</span>{texte.geld(t.preis)}
                    </label>
                  ) : <Zeile titel={titel} untertitel={<span style={{ color: STATUS_FARBE[t.status] }}>{T(`tk_ticket_${b.zustand === 'verfallen' && t.status === 'reserviert' ? 'verfallen' : t.status}`)}</span>} wert={texte.geld(t.preis)} />}
                </div>
              )
            })}
          </Gruppe>
        )}

        {!modus && (b.zahlung || b.erstattungen.length > 0) && (
          <Gruppe style={{ margin: 0 }}>
            {b.zahlung && <Zeile titel={T('tk_bar_erhalten')} untertitel={[texte.zeitpunkt(b.zahlung.zeitpunkt), b.zahlung.person?.voller_name].filter(Boolean).join(' · ')} wert={texte.geld(b.zahlung.betrag)} />}
            {b.erstattungen.map(r => (
              <div key={r.id}><Trenner /><Zeile titel={T('tk_bar_erstattet')} untertitel={[texte.zeitpunkt(r.zeitpunkt), r.person?.voller_name].filter(Boolean).join(' · ')} wert={`−${texte.geld(r.betrag)}`} wertFarbe="var(--danger)" /></div>
            ))}
          </Gruppe>
        )}

        {((modus === 'storno' && b.zahlung) || modus === 'erstattung') && (
          <Feld label={T('tk_erstattung_betrag')} hinweis={modus === 'storno' ? T('tk_erstattung_hinweis') : T('tk_erstattbar').replace('{betrag}', texte.geld(b.erstattbar))}>
            <input value={betrag} inputMode="decimal" onChange={e => setBetrag(e.target.value)} style={eingabeStil} />
          </Feld>
        )}
        {fehler && <div role="alert"><FehlerText>{fehler}</FehlerText></div>}

        {modus === 'storno' && <Knopf voll variante="gefahr" icon={XCircle} onClick={stornieren} disabled={sendet}>{T('tk_stornieren')}</Knopf>}
        {modus === 'erstattung' && <Knopf voll onClick={erstatten} disabled={sendet}>{T('save')}</Knopf>}
        {!modus && b.zustand === 'reserviert' && <Knopf voll icon={Banknote} onClick={bezahlt} disabled={sendet}>{T('tk_geld_erhalten').replace('{betrag}', texte.geld(b.betrag))}</Knopf>}
        {!modus && b.kaeufer && b.tickets.some(t => t.status === 'gueltig') && <Knopf voll variante="sekundaer" icon={Mail} onClick={mailen} disabled={sendet}>{T('tk_mail_senden')}</Knopf>}
        {!modus && b.erstattbar > 0 && (
          <Knopf voll variante="rahmen" icon={Undo2} disabled={sendet} onClick={() => { setBetrag(texte.eingabe(b.erstattbar)); setFehler(''); setModus('erstattung') }}>{T('tk_erstattung_erfassen')}</Knopf>
        )}
        {!modus && stornierbar.length > 0 && <Knopf voll variante="gefahr" icon={XCircle} onClick={stornoStarten} disabled={sendet}>{T('tk_stornieren')}</Knopf>}
      </div>
    </Blatt>
  )
}
