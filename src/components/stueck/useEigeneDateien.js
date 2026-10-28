import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'

export const EIGENE_BUCKET    = 'eigene-dateien'
export const EIGENE_MAX_BYTES = 50 * 1024 * 1024
export const SICHTBARKEITEN   = ['privat', 'lehrer', 'alle']

export function groesseText(bytes) {
  if (!bytes) return ''
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// Daten und Aktionen der eigenen Dateien (alte und neue Oberfläche).
// Mit `stueck`: Dateien dieses Stücks. Ohne: alle Dateien der Schule, die der Nutzer sehen darf.
export function useEigeneDateien(stueck) {
  const { profil, schule, T, toast, confirm } = useApp()
  const queryClient = useQueryClient()
  const istGlobal = !stueck

  const { data: dateien = [], isLoading } = useQuery({
    queryKey: ['eigene-dateien', stueck?.id ?? 'alle', profil?.id, schule?.id],
    enabled: !!profil?.id && !!schule?.id,
    queryFn: async () => {
      let q = supabase.from('stueck_eigene_dateien')
        .select('*, besitzer:profiles!stueck_eigene_dateien_besitzer_id_fkey(voller_name), stueck:stuecke(id, titel)')
        .order('hochgeladen_am', { ascending: false })
      q = istGlobal ? q.eq('schule_id', schule.id).limit(500) : q.eq('stueck_id', stueck.id)
      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
  })

  const meine   = dateien.filter(d => d.besitzer_id === profil?.id)
  const geteilt = dateien.filter(d => d.besitzer_id !== profil?.id)

  function neuLaden() { queryClient.invalidateQueries({ queryKey: ['eigene-dateien'] }) }

  // Datei prüfen, bevor sie zum Hochladen vorgemerkt wird
  function pruefen(datei) {
    if (datei.size > EIGENE_MAX_BYTES) { toast(T('eigene_zu_gross'), 'error'); return false }
    return true
  }

  async function hochladen(datei, { sichtbarkeit, notiz, stueckId }) {
    const sichererName = datei.name.replace(/[^\w.-]+/g, '_')
    const pfad = `${profil.id}/${stueckId ?? 'allgemein'}/${crypto.randomUUID()}-${sichererName}`
    const { error: upErr } = await supabase.storage.from(EIGENE_BUCKET).upload(pfad, datei, { contentType: datei.type || undefined })
    if (upErr) { toast(upErr.message, 'error'); return false }
    const { error } = await supabase.from('stueck_eigene_dateien').insert({
      stueck_id: stueckId ?? null, schule_id: schule.id, besitzer_id: profil.id,
      name: datei.name, bucket_pfad: pfad, mime_typ: datei.type || null, groesse: datei.size,
      sichtbarkeit, notiz: notiz?.trim() || null,
    })
    if (error) {
      await supabase.storage.from(EIGENE_BUCKET).remove([pfad])
      toast(error.message, 'error'); return false
    }
    toast(T('eigene_hochgeladen'), 'success')
    neuLaden()
    return true
  }

  async function oeffnen(d) {
    // Fenster sofort öffnen, sonst blockiert iOS das Popup nach dem await
    const fenster = window.open('', '_blank')
    const { data, error } = await supabase.storage.from(EIGENE_BUCKET).createSignedUrl(d.bucket_pfad, 3600)
    if (error || !data?.signedUrl) { fenster?.close(); toast(error?.message ?? 'Fehler', 'error'); return }
    if (fenster) fenster.location = data.signedUrl
    else window.location.href = data.signedUrl
  }

  async function sichtbarkeitAendern(d, wert) {
    const { error } = await supabase.from('stueck_eigene_dateien').update({ sichtbarkeit: wert }).eq('id', d.id)
    if (error) { toast(error.message, 'error'); return false }
    neuLaden()
    return true
  }

  async function loeschen(d) {
    const ok = await confirm(T('eigene_loeschen_confirm'), { confirmLabel: T('delete') })
    if (!ok) return false
    // Erst Storage (dessen Policy prüft die Metadaten-Zeile), dann die Zeile
    const { error: stErr } = await supabase.storage.from(EIGENE_BUCKET).remove([d.bucket_pfad])
    if (stErr) { toast(stErr.message, 'error'); return false }
    const { error } = await supabase.from('stueck_eigene_dateien').delete().eq('id', d.id)
    if (error) { toast(error.message, 'error'); return false }
    neuLaden()
    return true
  }

  return { dateien, isLoading, meine, geteilt, pruefen, hochladen, oeffnen, sichtbarkeitAendern, loeschen }
}

// Stückauswahl beim Hochladen ohne festes Stück
export function useStueckAuswahl(aktiv) {
  const { schule } = useApp()
  return useQuery({
    queryKey: ['eigene-dateien-stuecke', schule?.id],
    enabled: aktiv && !!schule?.id,
    queryFn: async () => {
      const { data } = await supabase.from('stuecke').select('id, titel').eq('schule_id', schule.id).order('titel')
      return data ?? []
    },
  })
}
