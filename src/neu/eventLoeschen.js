import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { useSchulweit } from './rolle'
import { eventBildLoeschen } from './eventBild'

// Lieder, die nur in dieser Veranstaltung vorkommen, mit ihren Dateien entfernen (vor dem Löschen des Events)
async function verwaisteLiederLoeschen(eventId) {
  const { data } = await supabase.from('event_stuecke').select('stueck_id').eq('event_id', eventId)
  for (const { stueck_id } of data ?? []) {
    const [k, e] = await Promise.all([
      supabase.from('unterricht_stuecke').select('*', { count: 'exact', head: true }).eq('stueck_id', stueck_id),
      supabase.from('event_stuecke').select('*', { count: 'exact', head: true }).eq('stueck_id', stueck_id).neq('event_id', eventId),
    ])
    if ((k.count ?? 0) > 0 || (e.count ?? 0) > 0) continue
    const { data: dateien } = await supabase.from('stueck_dateien').select('bucket_pfad').eq('stueck_id', stueck_id)
    if (dateien?.length) await supabase.storage.from('stueck-dateien').remove(dateien.map(d => d.bucket_pfad))
    await supabase.from('stuecke').delete().eq('id', stueck_id)
  }
}

// Veranstaltung nach Rückfrage löschen; true = gelöscht.
// Mit Ticketbestellungen nur, wenn sie vorbei ist (event_loeschen): bezahlte bleiben als Beleg in der Datenbank.
export function useEventLoeschen() {
  const { T, toast, confirm } = useApp()
  const schulweit = useSchulweit()

  return async function loeschen(ev) {
    const { data: hatTickets, error: pruefFehler } = await supabase.rpc('event_hat_tickets', { p_event_id: ev.id })
    if (pruefFehler) { toast(pruefFehler.message, 'error'); return false }

    let ausblenden = false
    if (hatTickets) {
      const { data: p, error } = await supabase.rpc('event_loeschen', { p_event_id: ev.id, p_nur_pruefen: true })
      if (error || !p.ok) { toast(error ? error.message : T(`tk_loeschen_${p.grund}`), 'error'); return false }
      ausblenden = p.art === 'ausblenden'
    }
    const sub = hatTickets ? T(ausblenden ? 'tk_loeschen_bezahlt' : 'tk_loeschen_bestellungen') : undefined
    if (!await confirm(T('nl_event_loeschen_frage'), { sub, confirmLabel: T('delete') })) return false

    if (!ausblenden) {
      if (schulweit) await verwaisteLiederLoeschen(ev.id)
      await eventBildLoeschen(ev.bild_pfad)   // vor dem Event, sonst greift die Storage-Policy nicht mehr
    }
    const { data, error } = hatTickets
      ? await supabase.rpc('event_loeschen', { p_event_id: ev.id })
      : await supabase.from('events').delete().eq('id', ev.id)
    if (error || data?.ok === false) { toast(error ? error.message : T(`tk_loeschen_${data.grund}`), 'error'); return false }
    toast(T('nl_event_geloescht'), 'success')
    return true
  }
}
