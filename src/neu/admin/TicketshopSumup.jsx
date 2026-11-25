// Rückkehr von der SumUp-Anmeldung (/admin/ticketshop/sumup?code=…&state=…): Verbindung abschließen
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { Seite, Knopf, FehlerText, Laden } from '../../ui'
import { useNeuLaden } from '../daten'
import { HaendlerWahl, kontoAufruf, sumupFehler } from './Ticketshop'

export default function TicketshopSumup() {
  const { T, toast } = useApp()
  const navigate = useNavigate()
  const neuLaden = useNeuLaden()
  const [liste, setListe] = useState(null)
  const [fehler, setFehler] = useState('')
  const [sendet, setSendet] = useState(false)
  const begonnen = useRef(null)

  async function abschliessen(werte) {
    setSendet(true)
    const r = await kontoAufruf({ aktion: 'sumup_fertig', state: begonnen.current, ...werte })
    setSendet(false)
    if (r.ok) {
      neuLaden('na-ticketshop')
      toast(T('sh_verbunden_jetzt').replaceAll('{anbieter}', 'SumUp'), 'success')
      navigate('/admin/ticketshop', { replace: true })
    } else if (r.grund === 'haendler') setListe(r.liste)
    else { setListe(null); setFehler(sumupFehler(T, r)) }
  }

  useEffect(() => {
    if (begonnen.current) return
    const p = new URLSearchParams(window.location.search)
    begonnen.current = p.get('state') ?? '-'
    window.history.replaceState(window.history.state, '', window.location.pathname)   // Code nicht in Verlauf und Adresszeile lassen
    if (p.get('error') || !p.get('code')) setFehler(T('sh_sumup_abgebrochen'))
    else abschliessen({ code: p.get('code') })
  }, [])

  return (
    <Seite titel="SumUp" zurueck={{ to: '/admin/ticketshop', label: T('sh_titel') }}>
      <div style={{ margin: '24px 20px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {liste && <HaendlerWahl liste={liste} sendet={sendet} onWahl={haendler => abschliessen({ haendler })} />}
        {fehler && <FehlerText>{fehler}</FehlerText>}
        {fehler && <Knopf voll onClick={() => navigate('/admin/ticketshop', { replace: true })}>{T('back')}</Knopf>}
      </div>
      {!liste && !fehler && <><div role="status" style={{ margin: '0 20px 12px', fontSize: 17 }}>{T('sh_prueft')}</div><Laden hoehe={140} /></>}
    </Seite>
  )
}
