// Helfer: Personen je Veranstaltung für „Scannen“ und „Kasse“ freigeben (nur Admins)
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { QrCode } from 'lucide-react'
import { Blatt, Suchfeld, Gruppe, Trenner, Zeile, Leer, Laden, FehlerText, Knopf } from '../../ui'
import { ProbeQr } from '../einlass/ProbeCode'
import { useNeuLaden } from '../daten'
import { Avatar } from './ListeDetail'

export function useTicketHelfer(eventId) {
  return useQuery({
    queryKey: ['na-ticket-helfer', eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase.from('ticket_freigaben').select('profil_id, scannen, kasse').eq('event_id', eventId)
      if (error) throw error
      return data
    },
  })
}

export default function TicketHelfer({ ev, onClose }) {
  const { T, schule, toast } = useApp()
  const neuLaden = useNeuLaden()
  const [suche, setSuche] = useState('')
  const [sendet, setSendet] = useState(false)
  const [probe, setProbe] = useState(false)
  const { data: helfer = [], isLoadingError: isError } = useTicketHelfer(ev.id)
  const { data: personen = [], isLoading } = useQuery({
    queryKey: ['na-schulmitglieder', schule?.id],
    enabled: !!schule?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('schul_mitgliedschaften')
        .select('rolle, person:profiles!schul_mitgliedschaften_user_id_fkey(id, voller_name, avatar_url)').eq('schule_id', schule.id).eq('aktiv', true)
      if (error) throw error
      return data.filter(m => m.person).map(m => ({ ...m.person, rolle: m.rolle })).sort((a, b) => a.voller_name.localeCompare(b.voller_name))
    },
  })
  const rechte = new Map(helfer.map(h => [h.profil_id, { scannen: h.scannen, kasse: h.kasse }]))
  const dabei = personen.filter(p => rechte.has(p.id))
  const q = suche.trim().toLowerCase()
  const weitere = personen.filter(p => !rechte.has(p.id) && (!q || p.voller_name.toLowerCase().includes(q)))

  async function ausfuehren(anfrage) {
    setSendet(true)
    const { error } = await anfrage
    setSendet(false)
    if (error) toast(error.message, 'error')
    neuLaden('na-ticket-helfer', 'n-scan-events', 'n-kassen-events')
  }
  const tabelle = () => supabase.from('ticket_freigaben')
  const dazu = p => ausfuehren(tabelle().insert({ event_id: ev.id, profil_id: p.id, scannen: true, kasse: false }))
  // Ohne Häkchen ist die Person kein Helfer mehr
  function setze(p, feld, an) {
    const neu = { ...rechte.get(p.id), [feld]: an }
    const zeile = neu.scannen || neu.kasse ? tabelle().update({ scannen: neu.scannen, kasse: neu.kasse }) : tabelle().delete()
    return ausfuehren(zeile.eq('event_id', ev.id).eq('profil_id', p.id))
  }

  return (
    <Blatt titel={T('ei_helfer')} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.45, color: 'var(--text-2)' }}>{T('ei_helfer_hinweis')}</p>
        <Knopf variante="sekundaer" icon={QrCode} aria-expanded={probe} onClick={() => setProbe(p => !p)} style={{ whiteSpace: 'normal' }}>{T('ei_probe_zeigen')}</Knopf>
        {probe && <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}><p style={{ margin: 0, fontSize: 16, lineHeight: 1.45, color: 'var(--text-2)' }}>{T('ei_probe_hinweis')}</p><ProbeQr /></div>}
        {isLoading ? <Laden hoehe={200} /> : isError ? <FehlerText>{T('tk_laden_fehler')}</FehlerText> : <>
          {dabei.length > 0 && (
            <Gruppe style={{ margin: 0 }}>
              {dabei.map((p, i) => (
                <div key={p.id}>
                  {i > 0 && <Trenner />}
                  <div style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Avatar name={p.voller_name} bild={p.avatar_url} groesse={36} />
                      <span style={{ flex: 1, minWidth: 0, fontSize: 17, fontWeight: 600, overflowWrap: 'anywhere' }}>{p.voller_name}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 24, marginTop: 4, paddingLeft: 48 }}>
                      {[['scannen', 'ei_recht_scannen'], ['kasse', 'ei_recht_kasse']].map(([feld, label]) => (
                        <label key={feld} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, fontSize: 17, cursor: 'pointer' }}>
                          <input type="checkbox" checked={rechte.get(p.id)[feld]} disabled={sendet} onChange={e => setze(p, feld, e.target.checked)} style={{ width: 22, height: 22, accentColor: 'var(--primary)' }} />
                          {T(label)}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </Gruppe>
          )}
          <div style={{ margin: '0 -20px' }}><Suchfeld wert={suche} onChange={setSuche} label={T('nm_suchen')} placeholder={T('nm_suchen_platzhalter')} /></div>
          {weitere.length === 0 ? <Leer text={T('member_none_found')} /> : (
            <Gruppe style={{ margin: 0 }}>
              {weitere.slice(0, 60).map((p, i) => (
                <div key={p.id}>
                  {i > 0 && <Trenner />}
                  <Zeile bild={<Avatar name={p.voller_name} bild={p.avatar_url} />} titel={p.voller_name} untertitel={T(p.rolle)} wert={T('ei_freigeben')} wertFarbe="var(--primary)" chevron={false} onClick={() => !sendet && dazu(p)} />
                </div>
              ))}
            </Gruppe>
          )}
        </>}
      </div>
    </Blatt>
  )
}
