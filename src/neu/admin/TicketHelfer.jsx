// Helfer am Einlass: Personen je Veranstaltung zum Scannen freigeben (nur Admins)
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { Blatt, Suchfeld, Gruppe, Trenner, Zeile, Leer, Laden, FehlerText } from '../../ui'
import { useNeuLaden } from '../daten'
import { Avatar } from './ListeDetail'

export function useTicketHelfer(eventId) {
  return useQuery({
    queryKey: ['na-ticket-helfer', eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase.from('ticket_freigaben').select('profil_id, scannen, kasse').eq('event_id', eventId).eq('scannen', true)
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
  const { data: helfer = [], isError } = useTicketHelfer(ev.id)
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
  const ids = new Set(helfer.map(h => h.profil_id))
  const dabei = personen.filter(p => ids.has(p.id))
  const q = suche.trim().toLowerCase()
  const weitere = personen.filter(p => !ids.has(p.id) && (!q || p.voller_name.toLowerCase().includes(q)))

  async function ausfuehren(anfrage) {
    setSendet(true)
    const { error } = await anfrage
    setSendet(false)
    if (error) toast(error.message, 'error')
    neuLaden('na-ticket-helfer', 'n-scan-events')
  }
  // kasse nicht mitsenden: eine vorhandene Kassen-Freigabe bleibt erhalten
  const dazu = p => ausfuehren(supabase.from('ticket_freigaben').upsert({ event_id: ev.id, profil_id: p.id, scannen: true }, { onConflict: 'event_id,profil_id' }))
  const weg = p => {
    const zeile = helfer.find(h => h.profil_id === p.id)
    const tabelle = supabase.from('ticket_freigaben')
    return ausfuehren((zeile?.kasse ? tabelle.update({ scannen: false }) : tabelle.delete()).eq('event_id', ev.id).eq('profil_id', p.id))
  }

  return (
    <Blatt titel={T('ei_helfer')} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.45, color: 'var(--text-2)' }}>{T('ei_helfer_hinweis')}</p>
        {isLoading ? <Laden hoehe={200} /> : isError ? <FehlerText>{T('tk_laden_fehler')}</FehlerText> : <>
          {dabei.length > 0 && (
            <Gruppe style={{ margin: 0 }}>
              {dabei.map((p, i) => (
                <div key={p.id}>
                  {i > 0 && <Trenner />}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 8px 8px 16px', minHeight: 56 }}>
                    <Avatar name={p.voller_name} bild={p.avatar_url} groesse={36} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 17, fontWeight: 600, overflowWrap: 'anywhere' }}>{p.voller_name}</span>
                    <button onClick={() => weg(p)} disabled={sendet} aria-label={`${T('nv_entfernen')}: ${p.voller_name}`} style={{ width: 44, height: 44, borderRadius: 22, border: 'none', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X aria-hidden="true" size={20} /></button>
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
