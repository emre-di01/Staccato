// Datenzugriff der neuen Lehrer-Oberfläche (react-query, Query-Keys mit Präfix 'nl-')

import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { useSchulweit } from './rolle'

const TAG = 24 * 60 * 60 * 1000

// Kurse, in denen ich unterrichte (inkl. aktiver Teilnehmerzahl) – im Admin-Bereich alle Kurse der Schule
export function useLehrerKurse() {
  const { profil, schule } = useApp()
  const schulweit = useSchulweit()
  return useQuery({
    queryKey: ['nl-kurse', profil?.id, schule?.id, schulweit],
    enabled: !!profil?.id && (!schulweit || !!schule?.id),
    queryFn: async () => {
      const felder = 'id, name, typ, wochentag, uhrzeit_von, uhrzeit_bis, aktiv, raeume(name), unterricht_schueler(schueler_id, status)'
      let kurse
      if (schulweit) {
        const { data, error } = await supabase.from('unterricht')
          .select(`${felder}, unterricht_lehrer(rolle, profiles!unterricht_lehrer_lehrer_id_fkey(voller_name))`)
          .eq('schule_id', schule.id)
        if (error) throw error
        kurse = (data ?? []).map(k => ({ ...k, lehrer: (k.unterricht_lehrer ?? []).map(l => l.profiles?.voller_name).filter(Boolean) }))
      } else {
        const { data, error } = await supabase.from('unterricht_lehrer').select(`rolle, unterricht(${felder})`).eq('lehrer_id', profil.id)
        if (error) throw error
        kurse = (data ?? []).map(u => u.unterricht).filter(Boolean)
      }
      return kurse
        .map(k => ({ ...k, teilnehmer: (k.unterricht_schueler ?? []).filter(s => s.status === 'aktiv').length }))
        .sort((a, b) => a.name.localeCompare(b.name))
    },
  })
}

// Stunden meiner Kurse im Zeitraum (vor `zurueck` Tagen bis +`tage`), mit Anwesenheit.
// `kursId` schränkt auf einen Kurs ein.
export function useLehrerStunden({ zurueck = 1, tage = 1, kursId } = {}) {
  const { profil, schule } = useApp()
  const schulweit = useSchulweit()
  const { data: kurse } = useLehrerKurse()
  return useQuery({
    queryKey: ['nl-stunden', profil?.id, schule?.id, schulweit, zurueck, tage, kursId ?? null, kurse?.length],
    enabled: !!profil?.id && !!kurse,
    queryFn: async () => {
      const ids = kursId ? [kursId] : kurse.map(k => k.id)
      if (!ids.length) return []
      const jetzt = Date.now()
      const { data, error } = await supabase.from('stunden')
        .select('id, beginn, ende, status, notizen, hausaufgaben, unterricht_id, unterricht(name, typ, raeume(name), unterricht_schueler(schueler_id, status)), raeume(name), anwesenheit(status, schueler_id)')
        .in('unterricht_id', ids)
        .gte('beginn', new Date(jetzt - zurueck * TAG).toISOString())
        .lte('beginn', new Date(jetzt + tage * TAG).toISOString())
        .order('beginn')
      if (error) throw error
      return (data ?? []).map(anreichern)
    },
  })
}

function anreichern(st) {
  const anw = st.anwesenheit ?? []
  return {
    ...st,
    raum: st.raeume?.name ?? st.unterricht?.raeume?.name ?? null,
    teilnehmer: (st.unterricht?.unterricht_schueler ?? []).filter(s => s.status === 'aktiv').length,
    da: anw.filter(a => a.status === 'anwesend' || a.status === 'zu_spaet').length,
    entschuldigt: anw.filter(a => a.status === 'entschuldigt').length,
  }
}

// Vergangene Stunden ohne erfasste Anwesenheit (letzte 30 Tage)
export function istOffen(st) {
  return st.status === 'geplant' && new Date(st.ende) < Date.now()
}

// Eine Stunde mit Kurs, Teilnehmern und bisheriger Anwesenheit (für „Stunde abschließen“)
export function useStunde(id) {
  return useQuery({
    queryKey: ['nl-stunde', id],
    enabled: !!id,
    queryFn: async () => {
      const { data: st, error } = await supabase.from('stunden')
        .select('id, beginn, ende, status, notizen, hausaufgaben, unterricht_id, unterricht(id, name), anwesenheit(status, schueler_id)')
        .eq('id', id).single()
      if (error) throw error
      const { data: tn } = await supabase.from('unterricht_schueler')
        .select('schueler_id, profiles!unterricht_schueler_schueler_id_fkey(id, voller_name, avatar_url)')
        .eq('unterricht_id', st.unterricht_id).eq('status', 'aktiv')
      const teilnehmer = (tn ?? []).map(t => ({ id: t.schueler_id, name: t.profiles?.voller_name ?? '?', avatar: t.profiles?.avatar_url }))
        .sort((a, b) => a.name.localeCompare(b.name))
      return { ...st, teilnehmer }
    },
  })
}

// Kursdetail: Kurs, Teilnehmer mit Anwesenheitsquote, Lieder
export function useLehrerKurs(id) {
  return useQuery({
    queryKey: ['nl-kurs', id],
    enabled: !!id,
    queryFn: async () => {
      const [k, tn, st, li] = await Promise.all([
        supabase.from('unterricht').select('id, name, typ, wochentag, uhrzeit_von, uhrzeit_bis, raeume(name)').eq('id', id).single(),
        supabase.from('unterricht_schueler')
          .select('schueler_id, profiles!unterricht_schueler_schueler_id_fkey(id, voller_name, avatar_url)')
          .eq('unterricht_id', id).eq('status', 'aktiv'),
        supabase.from('stunden').select('id, anwesenheit(status, schueler_id)').eq('unterricht_id', id).eq('status', 'stattgefunden'),
        supabase.from('unterricht_stuecke').select('status, reihenfolge, stuecke(id, titel, komponist)').eq('unterricht_id', id),
      ])
      if (k.error) throw k.error
      const gehalten = st.data ?? []
      const teilnehmer = (tn.data ?? []).map(t => {
        const eigene = gehalten.map(s => (s.anwesenheit ?? []).find(a => a.schueler_id === t.schueler_id)).filter(Boolean)
        const da = eigene.filter(a => a.status === 'anwesend' || a.status === 'zu_spaet').length
        return {
          id: t.schueler_id, name: t.profiles?.voller_name ?? '?', avatar: t.profiles?.avatar_url,
          quote: eigene.length ? Math.round(100 * da / eigene.length) : null,
        }
      }).sort((a, b) => a.name.localeCompare(b.name))
      const lieder = (li.data ?? []).filter(l => l.stuecke && l.status !== 'archiviert')
        .sort((a, b) => (a.reihenfolge ?? 0) - (b.reihenfolge ?? 0) || a.stuecke.titel.localeCompare(b.stuecke.titel))
      return { kurs: k.data, teilnehmer, lieder }
    },
  })
}
